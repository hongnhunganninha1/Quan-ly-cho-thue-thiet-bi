// API Bàn giao thiết bị (bảng handovers): giao từng máy trong hợp đồng cho khách
const express = require("express");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const nextCode = require("../utils/nextCode");
const withTransaction = require("../utils/transaction");
const { setEquipmentStatus } = require("../utils/equipmentStatus");
const { meterUpload, meterPhotoUrl, removeUploaded } = require("../utils/meterPhoto");
const { pick, required, maxLength, matches, nonNegativeNumber, parseId, toDateTime } = require("../utils/validate");

const router = express.Router();

// GET /api/handovers/pending – các máy chờ bàn giao (hợp đồng đã duyệt / đang thuê, máy chưa giao)
router.get("/pending", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT cd.id AS contract_detail_id, cd.planned_duration, rc.id AS contract_id, rc.contract_no, rc.status AS contract_status,
            rc.start_date, rc.end_date, rc.pricing_type, rc.delivery_address, rc.deposit_paid_at,
            cu.name AS customer_name, cu.representative, cu.phone AS customer_phone,
            e.id AS equipment_id, e.code, e.name, e.status AS equipment_status, e.operating_hours,
            e.warehouse_id, w.name AS warehouse_name
       FROM contract_details cd
       JOIN rental_contracts rc ON rc.id = cd.contract_id
       JOIN customers cu        ON cu.id = rc.customer_id
       JOIN equipments e        ON e.id = cd.equipment_id
       LEFT JOIN warehouses w   ON w.id = e.warehouse_id
      WHERE cd.status = 'PENDING' AND rc.status IN ('APPROVED','ACTIVE')
      ORDER BY rc.contract_no, e.code`
  );
  res.json(rows);
});

// GET /api/handovers – lịch sử phiếu bàn giao
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT h.*, rc.id AS contract_id, rc.contract_no, cu.name AS customer_name, e.code, e.name,
            w.name AS warehouse_name, em.full_name AS handed_by_name
       FROM handovers h
       JOIN contract_details cd ON cd.id = h.contract_detail_id
       JOIN rental_contracts rc ON rc.id = cd.contract_id
       JOIN customers cu        ON cu.id = rc.customer_id
       JOIN equipments e        ON e.id = cd.equipment_id
       LEFT JOIN warehouses w   ON w.id = h.from_warehouse_id
       JOIN users u             ON u.id = h.handed_by
       JOIN employees em        ON em.id = u.employee_id
      ORDER BY h.handover_no, h.id`
  );
  res.json(rows);
});

// POST /api/handovers – lập phiếu bàn giao một máy (gửi dạng form có file: kèm ảnh chụp đồng hồ giờ máy)
router.post("/", meterUpload("bg"), async (req, res) => {
  try {
    await createHandover(req, res);
  } catch (err) {
    removeUploaded(req.file); // lập phiếu lỗi thì xoá ảnh vừa tải lên
    throw err;
  }
});

async function createHandover(req, res) {
  const data = pick(req.body, [
    "contract_detail_id", "handover_at", "operating_hours", "fuel_level", "condition_note", "accessories", "receiver_name", "receiver_phone",
  ]);
  required(data, { contract_detail_id: "máy cần bàn giao", handover_at: "thời điểm bàn giao", operating_hours: "số giờ máy", receiver_name: "người nhận" });
  data.contract_detail_id = parseId(data.contract_detail_id);
  data.handover_at = toDateTime(data.handover_at, "Thời điểm bàn giao");
  nonNegativeNumber(data, "operating_hours", "Số giờ máy");
  nonNegativeNumber(data, "fuel_level", "Mức nhiên liệu", { integer: true });
  if (data.fuel_level !== null && data.fuel_level > 100) throw new HttpError(400, "Mức nhiên liệu từ 0 đến 100%.");
  maxLength(data, { accessories: ["Phụ kiện kèm theo", 500], receiver_name: ["Người nhận", 50] });
  matches(data.receiver_phone, "phone", "Số điện thoại người nhận phải gồm 10–11 chữ số và bắt đầu bằng 0.");
  if (!req.file) throw new HttpError(400, "Vui lòng chụp ảnh đồng hồ giờ máy lúc bàn giao.");
  data.meter_photo_url = await meterPhotoUrl(req.file);

  const result = await withTransaction(async (conn) => {
    const [[d]] = await conn.query(
      `SELECT cd.*, rc.contract_no, rc.status AS contract_status, rc.deposit_paid_at, rc.start_date,
              e.code, e.status AS equipment_status, e.operating_hours AS current_hours, e.warehouse_id
         FROM contract_details cd
         JOIN rental_contracts rc ON rc.id = cd.contract_id
         JOIN equipments e        ON e.id = cd.equipment_id
        WHERE cd.id = ? FOR UPDATE`,
      [data.contract_detail_id]
    );
    if (!d) throw new HttpError(404, "Không tìm thấy máy trong hợp đồng.");
    if (d.status !== "PENDING") throw new HttpError(409, `Máy ${d.code} đã được bàn giao.`);
    if (!["APPROVED", "ACTIVE"].includes(d.contract_status)) throw new HttpError(409, "Hợp đồng chưa được duyệt.");
    if (!d.deposit_paid_at) throw new HttpError(409, "Khách chưa đặt cọc, chưa được bàn giao máy.");
    if (d.equipment_status === "RENTED") throw new HttpError(409, `Máy ${d.code} chưa được thu hồi từ hợp đồng trước.`);
    if (!["AVAILABLE", "RESERVED"].includes(d.equipment_status)) throw new HttpError(409, `Máy ${d.code} đang ngừng hoạt động.`);
    // Không giao máy trước ngày thuê: máy có thể còn được đặt cho một hợp đồng khác trong khoảng trước đó
    if (data.handover_at.slice(0, 10) < d.start_date) {
      throw new HttpError(409, `Chưa đến ngày bắt đầu thuê của hợp đồng ${d.contract_no} (${d.start_date.split("-").reverse().join("/")}).`);
    }
    if (data.operating_hours < d.current_hours) {
      throw new HttpError(400, `Số giờ máy không được nhỏ hơn số đang ghi nhận (${d.current_hours}).`);
    }

    const handover_no = await nextCode(conn, "handovers", "handover_no", `BG-${new Date().getFullYear()}-`, 4);
    await conn.query("INSERT INTO handovers SET ?", [{ ...data, handover_no, from_warehouse_id: d.warehouse_id, handed_by: req.user.id }]);
    await conn.query("UPDATE contract_details SET status = 'HANDED_OVER' WHERE id = ?", [d.id]);
    // Máy rời bãi đi công trình
    await setEquipmentStatus(conn, d.equipment_id, "RENTED", {
      userId: req.user.id, contractId: d.contract_id, note: `Bàn giao ${handover_no}`,
      extra: { warehouse_id: null, operating_hours: data.operating_hours },
    });
    await conn.query("UPDATE rental_contracts SET status = 'ACTIVE' WHERE id = ? AND status = 'APPROVED'", [d.contract_id]);
    return { handover_no, code: d.code, contract_no: d.contract_no };
  });
  res.status(201).json({ ...result, message: `Đã lập phiếu ${result.handover_no}: bàn giao máy ${result.code} (${result.contract_no}).` });
}

module.exports = router;
