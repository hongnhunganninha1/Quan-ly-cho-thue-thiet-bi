// API Thu hồi thiết bị (bảng equipment_returns): nhận máy về bãi và tính các khoản phát sinh
const express = require("express");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const nextCode = require("../utils/nextCode");
const withTransaction = require("../utils/transaction");
const { setEquipmentStatus } = require("../utils/equipmentStatus");
const { assertWarehouseHasRoom } = require("../utils/warehouseCapacity");
const { returnFees } = require("../utils/calc");
const { meterUpload, meterPhotoUrl, removeUploaded } = require("../utils/meterPhoto");
const { pick, required, nonNegativeNumber, parseId, toDateTime } = require("../utils/validate");

const router = express.Router();

// Thông tin cần để tính phí của một máy đang cho thuê
const DETAIL_SQL = `
  SELECT cd.*, rc.contract_no, rc.status AS contract_status, rc.start_date, rc.end_date, rc.pricing_type,
         cu.name AS customer_name, e.code, e.name, e.daily_rate, e.status AS equipment_status,
         h.handover_no, h.handover_at, h.operating_hours AS handover_hours, h.fuel_level AS handover_fuel,
         h.meter_photo_url AS handover_meter_photo,
         GREATEST(0, DATEDIFF(CURDATE(), rc.end_date)) AS overdue_days
    FROM contract_details cd
    JOIN rental_contracts rc ON rc.id = cd.contract_id
    JOIN customers cu        ON cu.id = rc.customer_id
    JOIN equipments e        ON e.id = cd.equipment_id
    JOIN handovers h         ON h.contract_detail_id = cd.id`;

// Kiểm tra form thu hồi và tính phí (dùng cho cả xem trước và lưu)
async function prepare(conn, body, lock = false) {
  const data = pick(body, [
    "contract_detail_id", "returned_at", "to_warehouse_id", "operating_hours", "fuel_level",
    "condition_note", "is_damaged", "damage_description", "compensation_amount",
  ]);
  required(data, { contract_detail_id: "máy cần thu hồi", returned_at: "thời điểm thu hồi", operating_hours: "số giờ máy" });
  data.contract_detail_id = parseId(data.contract_detail_id);
  data.returned_at = toDateTime(data.returned_at, "Thời điểm thu hồi");
  nonNegativeNumber(data, "operating_hours", "Số giờ máy");
  nonNegativeNumber(data, "fuel_level", "Mức nhiên liệu", { integer: true });
  nonNegativeNumber(data, "compensation_amount", "Tiền bồi thường", { integer: true });
  if (data.fuel_level !== null && data.fuel_level > 100) throw new HttpError(400, "Mức nhiên liệu từ 0 đến 100%.");
  data.is_damaged = data.is_damaged === true || data.is_damaged === "true" || data.is_damaged === 1;
  if (!data.is_damaged) {
    data.damage_description = null;
    data.compensation_amount = 0;
  }

  const [[d]] = await conn.query(DETAIL_SQL + ` WHERE cd.id = ?${lock ? " FOR UPDATE" : ""}`, [data.contract_detail_id]);
  if (!d) throw new HttpError(404, "Máy này chưa được bàn giao.");
  if (d.status !== "HANDED_OVER") throw new HttpError(409, `Máy ${d.code} đã được thu hồi.`);
  if (data.returned_at < d.handover_at) throw new HttpError(400, "Thời điểm thu hồi phải sau thời điểm bàn giao.");
  if (data.operating_hours < d.handover_hours) {
    throw new HttpError(400, `Số giờ máy không được nhỏ hơn lúc bàn giao (${d.handover_hours}).`);
  }
  return { data, d, fees: returnFees(d, data) };
}

// GET /api/returns/pending – các máy đang cho thuê chờ thu hồi (quá hạn lên đầu)
router.get("/pending", async (req, res) => {
  const [rows] = await pool.query(DETAIL_SQL + " WHERE cd.status = 'HANDED_OVER' ORDER BY rc.contract_no, e.code");
  res.json(rows);
});

// GET /api/returns – lịch sử phiếu thu hồi
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT r.*, rc.id AS contract_id, rc.contract_no, cu.name AS customer_name, e.code, e.name,
            w.name AS warehouse_name, em.full_name AS received_by_name,
            h.handover_no, h.handover_at, h.operating_hours AS handover_hours, h.fuel_level AS handover_fuel,
            h.meter_photo_url AS handover_meter_photo
       FROM equipment_returns r
       JOIN contract_details cd ON cd.id = r.contract_detail_id
       LEFT JOIN handovers h    ON h.contract_detail_id = cd.id
       JOIN rental_contracts rc ON rc.id = cd.contract_id
       JOIN customers cu        ON cu.id = rc.customer_id
       JOIN equipments e        ON e.id = cd.equipment_id
       JOIN warehouses w        ON w.id = r.to_warehouse_id
       JOIN users u             ON u.id = r.received_by
       JOIN employees em        ON em.id = u.employee_id
      ORDER BY r.return_no, r.id`
  );
  res.json(rows);
});

// POST /api/returns/preview – tính thử các khoản phí trước khi lưu
router.post("/preview", async (req, res) => {
  const { fees } = await prepare(pool, req.body);
  res.json(fees);
});

// POST /api/returns – lập phiếu thu hồi (gửi dạng form có file: kèm ảnh chụp đồng hồ giờ máy)
router.post("/", meterUpload("th"), async (req, res) => {
  try {
    await createReturn(req, res);
  } catch (err) {
    removeUploaded(req.file); // lập phiếu lỗi thì xoá ảnh vừa tải lên
    throw err;
  }
});

async function createReturn(req, res) {
  const result = await withTransaction(async (conn) => {
    const { data, d, fees } = await prepare(conn, req.body, true);
    required(data, { to_warehouse_id: "bãi nhận máy" });
    if (!req.file) throw new HttpError(400, "Vui lòng chụp ảnh đồng hồ giờ máy lúc thu hồi.");
    data.meter_photo_url = meterPhotoUrl(req.file);
    if (data.is_damaged && !data.damage_description) throw new HttpError(400, "Vui lòng mô tả hư hỏng.");
    const [[wh]] = await conn.query("SELECT status FROM warehouses WHERE id = ?", [data.to_warehouse_id]);
    if (!wh || wh.status !== "ACTIVE") throw new HttpError(400, "Bãi nhận máy không hợp lệ hoặc đã ngừng hoạt động.");
    await assertWarehouseHasRoom(conn, data.to_warehouse_id, d.equipment_id); // bãi đầy thì không nhận máy về

    const return_no = await nextCode(conn, "equipment_returns", "return_no", `TH-${new Date().getFullYear()}-`, 4);
    const { used_hours, allowed_hours, actual_overtime, ...feeColumns } = fees; // eslint-disable-line no-unused-vars
    await conn.query("INSERT INTO equipment_returns SET ?", [{ ...data, ...feeColumns, return_no, received_by: req.user.id }]);
    await conn.query("UPDATE contract_details SET status = 'RETURNED' WHERE id = ?", [d.id]);

    // Máy về bãi: hư hỏng thì Ngừng hoạt động (chờ sửa); còn tốt thì Sẵn sàng,
    // hoặc Đã giữ chỗ nếu đã có hợp đồng khác (chờ duyệt / đã duyệt) đang chờ máy này.
    let newStatus = "AVAILABLE";
    if (data.is_damaged) newStatus = "INACTIVE";
    else {
      const [[{ waiting }]] = await conn.query(
        `SELECT COUNT(*) AS waiting FROM contract_details cd JOIN rental_contracts rc ON rc.id = cd.contract_id
          WHERE cd.equipment_id = ? AND cd.status = 'PENDING' AND rc.status IN ('PENDING_APPROVAL','APPROVED','ACTIVE')`,
        [d.equipment_id]
      );
      if (waiting > 0) newStatus = "RESERVED";
    }
    await setEquipmentStatus(conn, d.equipment_id, newStatus, {
      userId: req.user.id, contractId: d.contract_id,
      note: data.is_damaged
        ? `Hư hỏng khi thu hồi (${return_no})${data.damage_description ? `: ${String(data.damage_description).slice(0, 150)}` : ""}`
        : null,
      extra: { warehouse_id: data.to_warehouse_id, operating_hours: data.operating_hours },
    });

    // Thu hồi hết máy thì hợp đồng hoàn thành, chờ quyết toán
    const [[{ remaining }]] = await conn.query(
      "SELECT COUNT(*) AS remaining FROM contract_details WHERE contract_id = ? AND status <> 'RETURNED'",
      [d.contract_id]
    );
    if (remaining === 0) await conn.query("UPDATE rental_contracts SET status = 'COMPLETED' WHERE id = ?", [d.contract_id]);
    return { return_no, code: d.code, contract_no: d.contract_no, completed: remaining === 0 };
  });
  res.status(201).json({
    ...result,
    message: `Đã lập phiếu ${result.return_no}: thu hồi máy ${result.code}.` +
      (result.completed ? ` Hợp đồng ${result.contract_no} đã thu hồi đủ máy, chuyển sang chờ quyết toán.` : ""),
  });
}

module.exports = router;
