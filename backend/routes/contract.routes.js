// API Hợp đồng thuê: lập, sửa, gửi duyệt, duyệt / từ chối, xác nhận đặt cọc, huỷ.
//
// Vòng đời hợp đồng:
//   DRAFT (nháp) → PENDING_APPROVAL (chờ duyệt) → APPROVED (đã duyệt) hoặc REJECTED (từ chối)
//   → khách đặt cọc → bàn giao máy: ACTIVE (đang thuê) → thu hồi hết máy: COMPLETED → quyết toán: SETTLED.
//   Hợp đồng đã duyệt mà quá 3 ngày khách chưa đặt cọc thì Quản lý huỷ: CANCELLED.
const express = require("express");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const nextCode = require("../utils/nextCode");
const withTransaction = require("../utils/transaction");
const { setEquipmentStatus, releaseReservation } = require("../utils/equipmentStatus");
const { findConflicts } = require("../utils/availability");
const { contractTotals, daysInclusive, MIN_HOURLY_HOURS, MAX_HOURLY_DAYS } = require("../utils/calc");
const { requireRole } = require("../middleware/auth");
const { pick, required, maxLength, nonNegativeNumber, parseId, toDateTime, validDate } = require("../utils/validate");

const router = express.Router();

const DEPOSIT_DAYS = 3; // số ngày khách phải đặt cọc sau khi hợp đồng được duyệt
const MAX_DAYS = 366; // một hợp đồng thuê tối đa 1 năm

const CONTRACT_FIELDS = ["customer_id", "delivery_address", "start_date", "end_date", "pricing_type", "transport_fee", "discount_rate", "vat_rate", "note"];

// Kiểm tra dữ liệu form hợp đồng, tính đơn giá / thành tiền từng máy và tổng tiền
async function buildContract(conn, body, contractId = 0) {
  const data = pick(body, CONTRACT_FIELDS);
  required(data, {
    customer_id: "khách hàng", delivery_address: "địa điểm nhận máy",
    start_date: "ngày bắt đầu", end_date: "ngày kết thúc", pricing_type: "hình thức tính giá",
  });
  maxLength(data, { delivery_address: ["Địa điểm nhận máy", 255] });
  if (!["HOUR", "DAY"].includes(data.pricing_type)) throw new HttpError(400, "Hình thức tính giá không hợp lệ.");
  validDate(data, { start_date: "Ngày bắt đầu", end_date: "Ngày kết thúc" });
  if (data.end_date < data.start_date) throw new HttpError(400, "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
  const days = daysInclusive(data.start_date, data.end_date);
  if (days > MAX_DAYS) throw new HttpError(400, "Thời gian thuê tối đa 1 năm cho một hợp đồng.");

  // Bỏ trống thì lấy mặc định: không phí vận chuyển, không chiết khấu, VAT 10%
  data.transport_fee = data.transport_fee ?? 0;
  data.discount_rate = data.discount_rate ?? 0;
  data.vat_rate = data.vat_rate ?? 10;
  nonNegativeNumber(data, "transport_fee", "Phí vận chuyển", { integer: true });
  nonNegativeNumber(data, "discount_rate", "Chiết khấu");
  nonNegativeNumber(data, "vat_rate", "Thuế VAT");
  if (data.discount_rate > 50) throw new HttpError(400, "Chiết khấu tối đa 50%.");
  if (data.vat_rate > 20) throw new HttpError(400, "Thuế VAT không hợp lệ.");

  const [[customer]] = await conn.query("SELECT id, status FROM customers WHERE id = ?", [data.customer_id]);
  if (!customer) throw new HttpError(400, "Khách hàng không tồn tại.");
  if (customer.status === "STOPPED") throw new HttpError(400, "Khách hàng đã bị ngừng giao dịch, không lập hợp đồng mới được.");

  // ----- Danh sách máy -----
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) throw new HttpError(400, "Vui lòng chọn ít nhất một thiết bị.");
  if (data.pricing_type === "HOUR" && days > MAX_HOURLY_DAYS) {
    throw new HttpError(400, `Thuê theo giờ chỉ áp dụng cho thời gian ngắn (trong ngày hoặc tối đa ${MAX_HOURLY_DAYS} ngày). Thuê dài hơn hãy chọn tính theo ngày.`);
  }
  const ids = rawItems.map((i) => Number(i.equipment_id));
  if (new Set(ids).size !== ids.length) throw new HttpError(400, "Mỗi thiết bị chỉ được chọn một lần trong hợp đồng.");

  const [equipments] = await conn.query(
    "SELECT id, code, name, status, hourly_rate, daily_rate FROM equipments WHERE id IN (?)",
    [ids]
  );
  const byId = new Map(equipments.map((e) => [e.id, e]));

  const items = rawItems.map((raw) => {
    const eq = byId.get(Number(raw.equipment_id));
    if (!eq) throw new HttpError(400, "Có thiết bị không tồn tại.");
    if (["INACTIVE", "LIQUIDATED"].includes(eq.status)) throw new HttpError(400, `Máy ${eq.code} đang ngừng hoạt động / đã thanh lý.`);
    if (eq.daily_rate === null) throw new HttpError(400, `Máy ${eq.code} chưa được Quản lý đặt giá thuê.`);

    let duration;
    if (data.pricing_type === "DAY") {
      duration = days; // thuê theo ngày: số ngày của hợp đồng
    } else {
      duration = Number(raw.planned_duration);
      if (!Number.isFinite(duration) || duration <= 0) throw new HttpError(400, `Vui lòng nhập số giờ thuê dự kiến cho máy ${eq.code}.`);
      if (duration < MIN_HOURLY_HOURS) {
        throw new HttpError(400, `Thuê theo giờ tối thiểu ${MIN_HOURLY_HOURS} giờ mỗi máy (máy ${eq.code}).`);
      }
      if (duration > days * 24) throw new HttpError(400, `Số giờ thuê của máy ${eq.code} vượt quá số giờ trong thời gian hợp đồng.`);
      duration = Math.round(duration * 10) / 10;
    }
    const unit_price = data.pricing_type === "DAY" ? eq.daily_rate : eq.hourly_rate; // chép giá tại thời điểm lập
    return {
      equipment_id: eq.id,
      unit_price,
      hourly_rate: eq.hourly_rate,
      planned_duration: duration,
      amount: Math.round(unit_price * duration),
      _code: eq.code,
    };
  });

  await assertNoConflicts(conn, items, data.start_date, data.end_date, contractId);
  return { data: { ...data, ...contractTotals(items, data) }, items };
}

// Báo lỗi nếu máy đã nằm trong hợp đồng khác trùng thời gian
async function assertNoConflicts(conn, items, from, to, contractId) {
  const conflicts = await findConflicts(conn, { equipmentIds: items.map((i) => i.equipment_id), from, to, excludeContractId: contractId });
  if (conflicts.length > 0) {
    const c = conflicts[0];
    const code = items.find((i) => i.equipment_id === c.equipment_id)?._code;
    throw new HttpError(409, `Máy ${code} đã có lịch trong hợp đồng ${c.contract_no} (${fmt(c.start_date)} – ${fmt(c.end_date)}).`);
  }
}

const fmt = (d) => String(d).slice(0, 10).split("-").reverse().join("/");

async function insertItems(conn, contractId, items) {
  const rows = items.map((i) => [contractId, i.equipment_id, i.unit_price, i.hourly_rate, i.planned_duration, i.amount]);
  await conn.query(
    "INSERT INTO contract_details (contract_id, equipment_id, unit_price, hourly_rate, planned_duration, amount) VALUES ?",
    [rows]
  );
}

// Lấy hợp đồng và khoá dòng lại trong giao dịch, tránh hai người thao tác cùng lúc
async function lockContract(conn, id) {
  const [[c]] = await conn.query("SELECT * FROM rental_contracts WHERE id = ? FOR UPDATE", [id]);
  if (!c) throw new HttpError(404, "Không tìm thấy hợp đồng.");
  return c;
}

function canModify(c, user) {
  return user.role === "ADMIN" || c.created_by === user.id;
}

const LIST_SQL = `
  SELECT rc.*, cu.code AS customer_code, cu.name AS customer_name, cu.phone AS customer_phone, cu.customer_type,
         ec.full_name AS created_by_name, ea.full_name AS approved_by_name,
         (SELECT COUNT(*) FROM contract_details cd WHERE cd.contract_id = rc.id) AS item_count,
         (SELECT GROUP_CONCAT(e.code ORDER BY e.code SEPARATOR ', ')
            FROM contract_details cd JOIN equipments e ON e.id = cd.equipment_id
           WHERE cd.contract_id = rc.id) AS equipment_codes,
         (rc.status = 'APPROVED' AND rc.deposit_paid_at IS NULL
            AND rc.approved_at < NOW() - INTERVAL ${DEPOSIT_DAYS} DAY) AS deposit_overdue
    FROM rental_contracts rc
    JOIN customers cu  ON cu.id = rc.customer_id
    JOIN users uc      ON uc.id = rc.created_by
    JOIN employees ec  ON ec.id = uc.employee_id
    LEFT JOIN users ua     ON ua.id = rc.approved_by
    LEFT JOIN employees ea ON ea.id = ua.employee_id`;

// GET /api/contracts?status=PENDING_APPROVAL – danh sách hợp đồng
router.get("/", async (req, res) => {
  const params = [];
  let where = "";
  if (req.query.status) {
    where = " WHERE rc.status IN (?)";
    params.push(String(req.query.status).split(","));
  }
  const [rows] = await pool.query(LIST_SQL + where + " ORDER BY rc.contract_no ASC, rc.id ASC", params);
  res.json(rows.map((r) => ({ ...r, deposit_overdue: Boolean(r.deposit_overdue) })));
});

// GET /api/contracts/:id – chi tiết hợp đồng
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [[contract]] = await pool.query(LIST_SQL + " WHERE rc.id = ?", [id]);
  if (!contract) throw new HttpError(404, "Không tìm thấy hợp đồng.");

  const [[customer]] = await pool.query("SELECT * FROM customers WHERE id = ?", [contract.customer_id]);
  const [items] = await pool.query(
    `SELECT cd.*, e.code, e.name, e.model, c.name AS category_name, e.status AS equipment_status,
            e.serial_number, e.manufacture_year, b.name AS brand_name,
            h.handover_no, h.handover_at, h.operating_hours AS handover_hours, h.meter_photo_url AS handover_meter_photo,
            h.fuel_level AS handover_fuel, h.accessories AS handover_accessories, h.condition_note AS handover_condition,
            h.receiver_name, h.receiver_phone, wf.name AS from_warehouse_name, eh.full_name AS handed_by_name,
            r.return_no, r.returned_at, r.operating_hours AS return_hours, r.meter_photo_url AS return_meter_photo,
            r.fuel_level AS return_fuel, r.condition_note AS return_condition, r.is_damaged, r.damage_description,
            r.rental_amount AS return_rental_amount, r.late_days, r.late_fee, r.overtime_hours, r.overtime_fee,
            r.compensation_amount, wt.name AS to_warehouse_name, er.full_name AS received_by_name
       FROM contract_details cd
       JOIN equipments e           ON e.id = cd.equipment_id
       JOIN equipment_categories c ON c.id = e.category_id
       JOIN brands b               ON b.id = e.brand_id
       LEFT JOIN handovers h          ON h.contract_detail_id = cd.id
       LEFT JOIN warehouses wf        ON wf.id = h.from_warehouse_id
       LEFT JOIN users uh             ON uh.id = h.handed_by
       LEFT JOIN employees eh         ON eh.id = uh.employee_id
       LEFT JOIN equipment_returns r  ON r.contract_detail_id = cd.id
       LEFT JOIN warehouses wt        ON wt.id = r.to_warehouse_id
       LEFT JOIN users ur             ON ur.id = r.received_by
       LEFT JOIN employees er         ON er.id = ur.employee_id
      WHERE cd.contract_id = ? ORDER BY cd.id`,
    [id]
  );
  const [[names]] = await pool.query(
    `SELECT ed.full_name AS deposit_confirmed_by_name, ex.full_name AS cancelled_by_name
       FROM rental_contracts rc
       LEFT JOIN users ud ON ud.id = rc.deposit_confirmed_by LEFT JOIN employees ed ON ed.id = ud.employee_id
       LEFT JOIN users ux ON ux.id = rc.cancelled_by         LEFT JOIN employees ex ON ex.id = ux.employee_id
      WHERE rc.id = ?`,
    [id]
  );
  const [[settlement]] = await pool.query("SELECT * FROM settlements WHERE contract_id = ?", [id]);
  const reminder = await reminderInfo(pool, contract);

  res.json({
    ...reminder,
    ...contract,
    ...names,
    deposit_overdue: Boolean(contract.deposit_overdue),
    customer,
    items,
    settlement: settlement || null,
    can_modify: canModify(contract, req.user),
  });
});

// Gửi duyệt → giữ chỗ các máy trong hợp đồng: Sẵn sàng → Đã giữ chỗ, để máy không còn hiện "Sẵn sàng"
// trong lúc chờ duyệt. Máy đang cho thuê hợp đồng khác thì giữ nguyên, khi thu hồi sẽ tự chuyển sang Đã giữ chỗ.
// Bị từ chối / bị huỷ thì trả lại Sẵn sàng (nếu không còn hợp đồng nào khác đang chờ máy đó).
async function reserveItems(conn, contractId, contractNo, user) {
  const [items] = await conn.query(
    `SELECT cd.equipment_id, e.status FROM contract_details cd JOIN equipments e ON e.id = cd.equipment_id
      WHERE cd.contract_id = ? FOR UPDATE`,
    [contractId]
  );
  for (const i of items) {
    if (i.status === "AVAILABLE") {
      await setEquipmentStatus(conn, i.equipment_id, "RESERVED", { userId: user.id, contractId, note: `Gửi duyệt ${contractNo}` });
    }
  }
}

// POST /api/contracts – lập hợp đồng (nháp). submit = true thì gửi duyệt luôn.
router.post("/", async (req, res) => {
  const result = await withTransaction(async (conn) => {
    const { data, items } = await buildContract(conn, req.body);
    data.contract_no = await nextCode(conn, "rental_contracts", "contract_no", `HD-${new Date().getFullYear()}-`, 4);
    data.created_by = req.user.id;
    data.status = req.body?.submit ? "PENDING_APPROVAL" : "DRAFT";
    data.submitted_at = req.body?.submit ? new Date() : null; // thời điểm gửi duyệt (để tính số ngày chờ)
    const [r] = await conn.query("INSERT INTO rental_contracts SET ?", [data]);
    await insertItems(conn, r.insertId, items);
    if (data.status === "PENDING_APPROVAL") {
      await reserveItems(conn, r.insertId, data.contract_no, req.user);
    }
    return { id: r.insertId, contract_no: data.contract_no, status: data.status };
  });
  const action = result.status === "DRAFT" ? "lưu nháp" : "gửi duyệt";
  res.status(201).json({ ...result, message: `Đã ${action} hợp đồng ${result.contract_no}.` });
});

// PUT /api/contracts/:id – sửa hợp đồng nháp hoặc bị từ chối (sửa xong trở về nháp)
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const result = await withTransaction(async (conn) => {
    const c = await lockContract(conn, id);
    if (!["DRAFT", "REJECTED"].includes(c.status)) throw new HttpError(409, "Chỉ sửa được hợp đồng nháp hoặc bị từ chối.");
    if (!canModify(c, req.user)) throw new HttpError(403, "Bạn chỉ sửa được hợp đồng do mình lập.");

    const { data, items } = await buildContract(conn, req.body, id);
    data.status = req.body?.submit ? "PENDING_APPROVAL" : "DRAFT";
    data.submitted_at = req.body?.submit ? new Date() : null; // thời điểm gửi duyệt (để tính số ngày chờ)
    data.reject_reason = null;
    await conn.query("UPDATE rental_contracts SET ? WHERE id = ?", [data, id]);
    await conn.query("DELETE FROM contract_details WHERE contract_id = ?", [id]);
    await insertItems(conn, id, items);
    if (data.status === "PENDING_APPROVAL") {
      await reserveItems(conn, id, c.contract_no, req.user);
    }
    return { status: data.status, contract_no: c.contract_no };
  });
  res.json({ message: result.status === "DRAFT" ? `Đã lưu hợp đồng ${result.contract_no}.` : `Đã lưu và gửi duyệt hợp đồng ${result.contract_no}.` });
});

// DELETE /api/contracts/:id – chỉ xoá hợp đồng nháp
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  await withTransaction(async (conn) => {
    const c = await lockContract(conn, id);
    if (c.status !== "DRAFT") throw new HttpError(409, "Chỉ xoá được hợp đồng nháp. Hợp đồng đã gửi duyệt thì dùng chức năng huỷ.");
    if (!canModify(c, req.user)) throw new HttpError(403, "Bạn chỉ xoá được hợp đồng do mình lập.");
    await conn.query("DELETE FROM rental_contracts WHERE id = ?", [id]); // chi tiết tự xoá theo
  });
  res.json({ message: "Đã xoá hợp đồng nháp." });
});

// POST /api/contracts/:id/submit – gửi duyệt
router.post("/:id/submit", async (req, res) => {
  const id = parseId(req.params.id);
  const c = await withTransaction(async (conn) => {
    const c = await lockContract(conn, id);
    if (!["DRAFT", "REJECTED"].includes(c.status)) throw new HttpError(409, "Hợp đồng không ở trạng thái nháp.");
    if (!canModify(c, req.user)) throw new HttpError(403, "Bạn chỉ gửi duyệt được hợp đồng do mình lập.");
    const [items] = await conn.query(
      "SELECT cd.equipment_id, e.code AS _code FROM contract_details cd JOIN equipments e ON e.id = cd.equipment_id WHERE cd.contract_id = ?",
      [id]
    );
    await assertNoConflicts(conn, items, c.start_date, c.end_date, id);
    await conn.query("UPDATE rental_contracts SET status = 'PENDING_APPROVAL', reject_reason = NULL, submitted_at = NOW() WHERE id = ?", [id]);
    await reserveItems(conn, id, c.contract_no, req.user);
    return c;
  });
  res.json({ message: `Đã gửi duyệt hợp đồng ${c.contract_no}.` });
});

// ----- Nhắc duyệt -----
// Hợp đồng đang chờ duyệt thì nhân viên bấm "Nhắc duyệt" lúc nào cũng được: hệ thống ghi thời điểm nhắc vào
// hợp đồng (reminded_at), chuông thông báo của Quản lý sẽ hiện "Nhắc duyệt hợp đồng" (tính từ cột này).
async function reminderInfo(conn, c) {
  const [[r]] = await conn.query("SELECT TIMESTAMPDIFF(HOUR, COALESCE(?, ?), NOW()) AS waited_hours", [c.submitted_at, c.updated_at]);
  const waitedDays = Math.max(0, Math.floor(Number(r.waited_hours) / 24));
  const remind_block = c.status !== "PENDING_APPROVAL" ? "Hợp đồng không ở trạng thái chờ duyệt." : null;
  return { waited_days: waitedDays, last_reminded_at: c.reminded_at || null, remind_block };
}

// POST /api/contracts/:id/remind – nhân viên nhắc Quản lý duyệt hợp đồng
router.post("/:id/remind", async (req, res) => {
  const id = parseId(req.params.id);
  const [[c]] = await pool.query("SELECT * FROM rental_contracts WHERE id = ?", [id]);
  if (!c) throw new HttpError(404, "Không tìm thấy hợp đồng.");
  const info = await reminderInfo(pool, c);
  if (info.remind_block) throw new HttpError(409, info.remind_block);
  // Chỉ ghi thời điểm nhắc; không đổi updated_at (cột này dùng làm mốc chờ duyệt cho dữ liệu cũ)
  await pool.query("UPDATE rental_contracts SET reminded_at = NOW(), updated_at = updated_at WHERE id = ?", [id]);
  res.json({ message: `Đã gửi nhắc duyệt ${c.contract_no} đến Quản lý.` });
});

// POST /api/contracts/:id/approve – Quản lý duyệt (kể cả hợp đồng do chính Quản lý lập: mỗi phòng chỉ có một trưởng phòng)
router.post("/:id/approve", requireRole("ADMIN"), async (req, res) => {
  const id = parseId(req.params.id);
  const c = await withTransaction(async (conn) => {
    const c = await lockContract(conn, id);
    if (c.status !== "PENDING_APPROVAL") throw new HttpError(409, "Hợp đồng không ở trạng thái chờ duyệt.");

    const [items] = await conn.query(
      `SELECT cd.equipment_id, e.code AS _code, e.status
         FROM contract_details cd JOIN equipments e ON e.id = cd.equipment_id
        WHERE cd.contract_id = ? FOR UPDATE`,
      [id]
    );
    const broken = items.find((i) => ["INACTIVE", "LIQUIDATED"].includes(i.status));
    if (broken) throw new HttpError(409, `Máy ${broken._code} đang ngừng hoạt động, không duyệt được. Hãy từ chối để nhân viên đổi máy khác.`);
    await assertNoConflicts(conn, items, c.start_date, c.end_date, id);

    await conn.query("UPDATE rental_contracts SET status = 'APPROVED', approved_by = ?, approved_at = NOW() WHERE id = ?", [req.user.id, id]);
    // Giữ chỗ máy: Sẵn sàng → Đã giữ chỗ (máy còn đang cho thuê hợp đồng trước thì giữ nguyên, khi thu hồi sẽ tự chuyển)
    for (const i of items) {
      if (i.status === "AVAILABLE") {
        await setEquipmentStatus(conn, i.equipment_id, "RESERVED", { userId: req.user.id, contractId: id, note: `Duyệt ${c.contract_no}` });
      }
    }
    return c;
  });
  res.json({ message: `Đã duyệt hợp đồng ${c.contract_no}. Khách cần đặt cọc trong ${DEPOSIT_DAYS} ngày.` });
});

// POST /api/contracts/:id/reject { reason } – Quản lý từ chối
router.post("/:id/reject", requireRole("ADMIN"), async (req, res) => {
  const id = parseId(req.params.id);
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw new HttpError(400, "Vui lòng nhập lý do từ chối.");
  if (reason.length > 255) throw new HttpError(400, "Lý do không được quá 255 ký tự.");
  const c = await withTransaction(async (conn) => {
    const c = await lockContract(conn, id);
    if (c.status !== "PENDING_APPROVAL") throw new HttpError(409, "Hợp đồng không ở trạng thái chờ duyệt.");
    await conn.query("UPDATE rental_contracts SET status = 'REJECTED', reject_reason = ? WHERE id = ?", [reason, id]);
    // Bị từ chối thì trả lại chỗ đã giữ lúc gửi duyệt
    const [items] = await conn.query("SELECT equipment_id FROM contract_details WHERE contract_id = ?", [id]);
    for (const i of items) {
      await releaseReservation(conn, i.equipment_id, { userId: req.user.id, contractId: id, note: `Từ chối ${c.contract_no}` });
    }
    return c;
  });
  res.json({ message: `Đã từ chối hợp đồng ${c.contract_no}.` });
});

// POST /api/contracts/:id/deposit { deposit_amount, deposit_paid_at } – xác nhận khách đã đặt cọc
router.post("/:id/deposit", async (req, res) => {
  const id = parseId(req.params.id);
  const data = pick(req.body, ["deposit_amount", "deposit_paid_at"]);
  required(data, { deposit_amount: "số tiền cọc" });
  nonNegativeNumber(data, "deposit_amount", "Số tiền cọc", { integer: true });
  if (data.deposit_amount <= 0) throw new HttpError(400, "Số tiền cọc phải lớn hơn 0.");
  data.deposit_paid_at = data.deposit_paid_at ? toDateTime(data.deposit_paid_at, "Thời điểm nhận cọc") : null;
  const c = await withTransaction(async (conn) => {
    const c = await lockContract(conn, id);
    if (c.status !== "APPROVED") throw new HttpError(409, "Chỉ nhận cọc cho hợp đồng đã duyệt.");
    if (c.deposit_paid_at) throw new HttpError(409, "Hợp đồng đã được xác nhận đặt cọc.");
    if (data.deposit_amount > c.total_amount) throw new HttpError(400, "Tiền cọc không được lớn hơn tổng giá trị hợp đồng.");
    await conn.query(
      "UPDATE rental_contracts SET deposit_amount = ?, deposit_paid_at = COALESCE(?, NOW()), deposit_confirmed_by = ? WHERE id = ?",
      [data.deposit_amount, data.deposit_paid_at, req.user.id, id]
    );
    return c;
  });
  res.json({ message: `Đã xác nhận đặt cọc hợp đồng ${c.contract_no}. Có thể bàn giao máy.` });
});

// POST /api/contracts/:id/cancel { reason } – Quản lý huỷ hợp đồng chưa bàn giao máy nào
router.post("/:id/cancel", requireRole("ADMIN"), async (req, res) => {
  const id = parseId(req.params.id);
  const reason = String(req.body?.reason || "").trim();
  if (!reason) throw new HttpError(400, "Vui lòng nhập lý do huỷ.");
  if (reason.length > 255) throw new HttpError(400, "Lý do không được quá 255 ký tự.");
  const c = await withTransaction(async (conn) => {
    const c = await lockContract(conn, id);
    if (!["PENDING_APPROVAL", "APPROVED"].includes(c.status)) {
      throw new HttpError(409, "Chỉ huỷ được hợp đồng đang chờ duyệt hoặc đã duyệt mà chưa bàn giao.");
    }
    await conn.query(
      "UPDATE rental_contracts SET status = 'CANCELLED', cancel_reason = ?, cancelled_by = ?, cancelled_at = NOW() WHERE id = ?",
      [reason, req.user.id, id]
    );
    // Trả lại chỗ cho các máy đã giữ
    const [items] = await conn.query("SELECT equipment_id FROM contract_details WHERE contract_id = ?", [id]);
    for (const i of items) {
      await releaseReservation(conn, i.equipment_id, { userId: req.user.id, contractId: id, note: `Huỷ ${c.contract_no}` });
    }
    return c;
  });
  res.json({ message: `Đã huỷ hợp đồng ${c.contract_no}.` });
});

module.exports = router;
