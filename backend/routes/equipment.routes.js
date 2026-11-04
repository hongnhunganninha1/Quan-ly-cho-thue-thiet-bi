// API Thiết bị: hồ sơ thiết bị, giấy tờ, giá thuê, tra cứu lịch trống
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const assertNoDuplicate = require("../utils/duplicate");
const nextCode = require("../utils/nextCode");
const withTransaction = require("../utils/transaction");
const { setEquipmentStatus } = require("../utils/equipmentStatus");
const { assertWarehouseHasRoom } = require("../utils/warehouseCapacity");
const { findConflicts } = require("../utils/availability");
const { HOURS_PER_DAY } = require("../utils/calc");
const { buildEquipmentName } = require("../utils/equipmentName");
const { requireRole } = require("../middleware/auth");
const { pick, required, maxLength, nonNegativeNumber, parseId, validDate } = require("../utils/validate");

const router = express.Router();

// ----- Tải file giấy tờ lên thư mục backend/uploads/docs -----
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "docs");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"];
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `eq${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // tối đa 10 MB
  fileFilter: (req, file, cb) => {
    const ok = ALLOWED_EXT.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new HttpError(400, "Chỉ nhận file PDF, ảnh (JPG, PNG, WEBP) hoặc Word."), ok);
  },
});

// ----- Ảnh đại diện thiết bị: thư mục backend/uploads/equipment -----
const IMAGE_DIR = path.join(__dirname, "..", "uploads", "equipment");
fs.mkdirSync(IMAGE_DIR, { recursive: true });
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];
const uploadImage = multer({
  storage: multer.diskStorage({
    destination: IMAGE_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `eq${req.params.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // tối đa 5 MB
  fileFilter: (req, file, cb) => {
    const ok = IMAGE_EXT.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new HttpError(400, "Ảnh thiết bị chỉ nhận file JPG, PNG hoặc WEBP."), ok);
  },
});

const STATUS_LABELS = {
  AVAILABLE: "Sẵn sàng", RESERVED: "Đã giữ chỗ", RENTED: "Đang cho thuê", INACTIVE: "Ngừng hoạt động", LIQUIDATED: "Đã thanh lý",
};
const CONDITIONS = ["NEW", "USED"]; // Mới / Đã qua sử dụng
const DOC_TYPES = ["PHOTO", "NAMEPLATE", "CUSTOMS", "CO", "CQ", "REGISTRATION", "INSPECTION", "MANUAL", "OTHER"];

const FIELDS = [
  "category_id", "brand_id", "model", "serial_number", "engine_number", "manufacture_year", "item_condition", "origin_country",
  "specifications", "purchase_date", "purchase_price", "operating_hours", "warehouse_id", "note",
];

async function validateEquipment(body, { isNew }) {
  const data = pick(body, FIELDS);
  // Hãng: chọn hãng có sẵn (brand_id) hoặc gõ tên hãng (brand_name); tên chưa có thì tự thêm hãng mới
  const brandName = String(body?.brand_name ?? "").trim().replace(/\s+/g, " ");
  // Gõ toàn chữ thường thì viết hoa chữ cái đầu mỗi từ (kubota -> Kubota); viết hoa sẵn (XCMG, JCB) thì giữ nguyên
  const brandTyped = brandName === brandName.toLowerCase() ? brandName.replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : brandName;
  if (!data.brand_id && !brandName) throw new HttpError(400, "Vui lòng nhập hãng.");
  if (brandName.length > 50) throw new HttpError(400, "Tên hãng tối đa 50 ký tự.");
  required(data, {
    manufacture_year: "năm sản xuất", model: "model", category_id: "loại thiết bị",
    item_condition: "tình trạng", serial_number: "số serial (số khung)",
  });
  if (isNew) required(data, { warehouse_id: "bãi máy" });
  data.model = String(data.model).trim().toUpperCase();
  // Số serial / số máy: viết hoa, bỏ khoảng trắng để so trùng chính xác
  for (const f of ["serial_number", "engine_number"]) {
    if (data[f] !== null) data[f] = String(data[f]).replace(/\s+/g, "").toUpperCase();
  }
  maxLength(data, {
    model: ["Model", 50], serial_number: ["Số serial", 50], engine_number: ["Số máy", 50],
    origin_country: ["Xuất xứ", 50], specifications: ["Thông số kỹ thuật", 500],
  });
  if (!CONDITIONS.includes(data.item_condition)) throw new HttpError(400, "Tình trạng không hợp lệ.");
  validDate(data, { purchase_date: "Ngày mua" }, { notFuture: ["purchase_date"] });
  nonNegativeNumber(data, "manufacture_year", "Năm sản xuất", { integer: true });
  nonNegativeNumber(data, "purchase_price", "Giá mua");
  nonNegativeNumber(data, "operating_hours", "Số giờ máy");
  const year = new Date().getFullYear();
  if (data.manufacture_year < 1950 || data.manufacture_year > year) {
    throw new HttpError(400, `Năm sản xuất phải từ 1950 đến ${year}.`);
  }
  if (data.operating_hours === null) data.operating_hours = 0;
  if (isNew && data.item_condition === "NEW") data.operating_hours = 0; // máy mới nhập về luôn 0 giờ
  // Thiết bị gắn vào loại (cấp 2), không gắn vào nhóm (cấp 1)
  const [[cat]] = await pool.query("SELECT parent_id, name FROM equipment_categories WHERE id = ?", [data.category_id]);
  if (!cat) throw new HttpError(400, "Loại thiết bị không tồn tại.");
  if (cat.parent_id === null) throw new HttpError(400, "Hãy chọn loại thiết bị cụ thể, không chọn nhóm.");
  let brand;
  if (brandName) {
    [[brand]] = await pool.query("SELECT id, name FROM brands WHERE LOWER(name) = LOWER(?)", [brandName]);
    if (!brand) brand = { id: null, name: brandTyped }; // hãng mới, thêm khi lưu máy
  } else {
    [[brand]] = await pool.query("SELECT id, name FROM brands WHERE id = ?", [data.brand_id]);
    if (!brand) throw new HttpError(400, "Hãng thiết bị không tồn tại.");
  }
  data.brand_id = brand.id;
  // Tên tự ghép: Năm SX - Hãng Model - Loại
  data.name = buildEquipmentName({ year: data.manufacture_year, brand: brand.name, model: data.model, category: cat.name });
  if (data.name.length > 200) throw new HttpError(400, "Tên thiết bị ghép ra quá dài (tối đa 200 ký tự), hãy rút gọn model.");
  if (data.warehouse_id !== null) {
    const [[wh]] = await pool.query("SELECT status FROM warehouses WHERE id = ?", [data.warehouse_id]);
    if (!wh) throw new HttpError(400, "Bãi máy không tồn tại.");
    if (wh.status !== "ACTIVE") throw new HttpError(400, "Bãi máy đã ngừng hoạt động, hãy chọn bãi khác.");
  }
  return { data, newBrand: brand.id ? null : brand.name };
}

// Số serial (số khung) và số máy không trùng với thiết bị khác
function assertUniqueEquipment(data, id = 0) {
  const describe = (e) => `thiết bị ${e.code} – ${e.name}`;
  return assertNoDuplicate("equipments", [
    { column: "serial_number", value: data.serial_number, label: "Số serial", describe },
    { column: "engine_number", value: data.engine_number, label: "Số máy", describe },
  ], id);
}

// Thêm hãng mới (nếu người dùng gõ tên hãng chưa có) trong cùng giao dịch lưu máy
async function ensureBrand(conn, data, newBrand) {
  if (!newBrand) return false;
  const [r] = await conn.query("INSERT INTO brands SET ?", [{ name: newBrand, country: data.origin_country || null }]);
  data.brand_id = r.insertId;
  return true;
}

const LIST_SQL = `
  SELECT e.*, c.code AS category_code, c.name AS category_name, g.id AS group_id, g.name AS group_name, b.name AS brand_name,
         w.code AS warehouse_code, w.name AS warehouse_name,
         IF(e.daily_rate IS NULL, 'NO', 'YES') AS has_price,
         (SELECT MAX(ph.changed_at) FROM equipment_price_history ph WHERE ph.equipment_id = e.id) AS price_changed_at,
         (SELECT COUNT(*) FROM contract_details cd WHERE cd.equipment_id = e.id) AS rental_count,
         (SELECT MIN(d.expiry_date) FROM equipment_documents d
           WHERE d.equipment_id = e.id AND d.expiry_date IS NOT NULL AND d.expiry_date >= CURDATE()) AS next_expiry
    FROM equipments e
    JOIN equipment_categories c ON c.id = e.category_id
    LEFT JOIN equipment_categories g ON g.id = c.parent_id
    JOIN brands b               ON b.id = e.brand_id
    LEFT JOIN warehouses w      ON w.id = e.warehouse_id`;

// GET /api/equipments – danh sách thiết bị
router.get("/", async (req, res) => {
  const [rows] = await pool.query(LIST_SQL + " ORDER BY e.code");
  res.json(rows);
});

// GET /api/equipments/availability?from=&to= – tra cứu lịch trống
router.get("/availability", async (req, res) => {
  const { from, to } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from || "") || !/^\d{4}-\d{2}-\d{2}$/.test(to || "")) {
    throw new HttpError(400, "Vui lòng chọn khoảng ngày cần tra cứu.");
  }
  if (to < from) throw new HttpError(400, "Ngày kết thúc phải sau ngày bắt đầu.");
  const excludeContractId = Number(req.query.excludeContractId) || 0;

  const [equipments] = await pool.query(LIST_SQL + " WHERE e.status <> 'LIQUIDATED' ORDER BY g.name, c.name, e.code");
  // Lấy mọi lịch đã đặt từ ngày "from" trở đi (không chỉ trong khoảng tra cứu) để vẽ lịch và gợi ý ngày trống
  const bookings = await findConflicts(pool, { from, to: "9999-12-31", excludeContractId });
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const length = dayDiff(from, to) + 1; // số ngày khách cần thuê

  res.json(
    equipments.map((e) => {
      const own = bookings
        .filter((b) => b.equipment_id === e.id)
        .map((b) => ({
          ...b,
          // Máy đã bàn giao mà quá hạn chưa trả: chưa biết ngày về
          overdue: b.detail_status === "HANDED_OVER" && b.end_date < today,
        }));
      const busy = own.filter((b) => b.start_date <= to && (b.overdue || from <= b.end_date));
      let availability = "FREE";
      if (e.status === "INACTIVE") availability = "INACTIVE";
      else if (busy.length > 0) availability = "BUSY";
      else if (e.daily_rate === null) availability = "NO_PRICE";
      return {
        ...e,
        availability,
        conflicts: busy,
        bookings: own,
        // Máy bận: ngày sớm nhất từ "from" còn trống đủ số ngày khách cần
        suggest_from: availability === "BUSY" ? nextFreeStart(own, from, length) : null,
        // Máy bận nhưng phần đầu khoảng tra cứu vẫn trống: trống đến ngày nào
        free_until: availability === "BUSY" && busy[0].start_date > from ? addDays(busy[0].start_date, -1) : null,
      };
    })
  );
});

// ----- Tiện ích ngày dạng "YYYY-MM-DD" -----
function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayDiff(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}
// Ngày bắt đầu sớm nhất (>= from) để thuê liền "length" ngày mà không trùng lịch nào; null nếu có lịch quá hạn chưa trả
function nextFreeStart(bookings, from, length) {
  let start = from;
  for (const b of [...bookings].sort((x, y) => (x.start_date < y.start_date ? -1 : 1))) {
    const end = addDays(start, length - 1);
    if (b.start_date > end) break; // khoảng [start, end] nằm gọn trước lịch này
    if (b.overdue) return null;
    if (b.end_date >= start) start = addDays(b.end_date, 1);
  }
  return start;
}

// GET /api/equipments/:id – hồ sơ chi tiết: giấy tờ, lịch sử cho thuê (kèm phiếu bàn giao / thu hồi)
router.get("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [[equipment]] = await pool.query(LIST_SQL + " WHERE e.id = ?", [id]);
  if (!equipment) throw new HttpError(404, "Không tìm thấy thiết bị.");

  const [documents] = await pool.query(
    `SELECT d.*, e.full_name AS uploaded_by_name
       FROM equipment_documents d
       LEFT JOIN users u     ON u.id = d.uploaded_by
       LEFT JOIN employees e ON e.id = u.employee_id
      WHERE d.equipment_id = ? ORDER BY d.created_at DESC`,
    [id]
  );
  // Lịch sử của máy lấy từ hợp đồng + phiếu bàn giao + phiếu thu hồi (không dùng bảng lịch sử riêng):
  // thuê cho ai, khi nào, giá đã áp dụng (đơn giá chép vào chi tiết hợp đồng), giờ máy lúc giao / nhận
  const [rentals] = await pool.query(
    `SELECT rc.id AS contract_id, rc.contract_no, rc.status AS contract_status, rc.start_date, rc.end_date,
            rc.pricing_type, cu.name AS customer_name, cd.status AS detail_status, cd.unit_price, cd.planned_duration, cd.amount,
            h.handover_no, h.handover_at, h.operating_hours AS handover_hours, h.meter_photo_url AS handover_meter_photo,
            r.return_no, r.returned_at, r.operating_hours AS return_hours, r.meter_photo_url AS return_meter_photo,
            r.is_damaged, r.damage_description
       FROM contract_details cd
       JOIN rental_contracts rc   ON rc.id = cd.contract_id
       JOIN customers cu          ON cu.id = rc.customer_id
       LEFT JOIN handovers h      ON h.contract_detail_id = cd.id
       LEFT JOIN equipment_returns r ON r.contract_detail_id = cd.id
      WHERE cd.equipment_id = ? ORDER BY rc.start_date DESC`,
    [id]
  );
  res.json({ ...equipment, documents, rentals });
});

// POST /api/equipments – mã tự sinh theo quy định: SKU + năm (2 số) + tháng nhập + số thứ tự 4 số trong tháng.
// VD: máy thứ 3 nhập trong tháng 10/2026 có mã SKU26100003; sang tháng 11 đếm lại từ SKU26110001.
router.post("/", async (req, res) => {
  const { data, newBrand } = await validateEquipment(req.body, { isNew: true });
  await assertUniqueEquipment(data);
  const result = await withTransaction(async (conn) => {
    await assertWarehouseHasRoom(conn, data.warehouse_id); // bãi đủ sức chứa thì không thêm máy vào được
    const brandCreated = await ensureBrand(conn, data, newBrand);
    const now = new Date();
    const prefix = `SKU${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
    data.code = await nextCode(conn, "equipments", "code", prefix, 4);
    data.status = "AVAILABLE"; // máy mới chưa có giá thuê, Quản lý sẽ đặt giá sau
    const [r] = await conn.query("INSERT INTO equipments SET ?", [data]);
    return { id: r.insertId, code: data.code, brand_created: brandCreated };
  });
  res.status(201).json({
    ...result,
    message: `Đã thêm thiết bị ${result.code} – ${data.name}.` +
      (result.brand_created ? ` Đã thêm hãng mới "${newBrand}".` : "") +
      " Quản lý cần đặt giá thuê trước khi đưa máy vào hợp đồng.",
  });
});

// PUT /api/equipments/:id – sửa thông tin (không sửa giá, trạng thái ở đây)
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const { data, newBrand } = await validateEquipment(req.body, { isNew: false });
  await assertUniqueEquipment(data, id);
  const [[old]] = await pool.query("SELECT status, warehouse_id, operating_hours FROM equipments WHERE id = ?", [id]);
  if (!old) throw new HttpError(404, "Không tìm thấy thiết bị.");
  if (data.item_condition === "NEW") data.operating_hours = old.operating_hours; // máy mới: không sửa tay giờ máy
  if (old.status === "RENTED") {
    // Máy đang ở công trình: bãi và giờ máy do bàn giao / thu hồi cập nhật
    data.warehouse_id = old.warehouse_id;
    data.operating_hours = old.operating_hours;
  } else if (data.warehouse_id === null) {
    throw new HttpError(400, "Vui lòng chọn bãi máy.");
  }
  if (Number(data.operating_hours) < Number(old.operating_hours)) {
    throw new HttpError(400, `Số giờ máy không được nhỏ hơn số hiện tại (${old.operating_hours}).`);
  }
  const brandCreated = await withTransaction(async (conn) => {
    // Chuyển máy sang bãi khác thì bãi mới phải còn chỗ
    if (data.warehouse_id && data.warehouse_id !== old.warehouse_id) await assertWarehouseHasRoom(conn, data.warehouse_id, id);
    const created = await ensureBrand(conn, data, newBrand);
    await conn.query("UPDATE equipments SET ? WHERE id = ?", [data, id]);
    return created;
  });
  res.json({ brand_created: brandCreated, message: "Đã cập nhật thiết bị." + (brandCreated ? ` Đã thêm hãng mới "${newBrand}".` : "") });
});

// PATCH /api/equipments/:id/status – người dùng chỉ đổi Sẵn sàng ↔ Ngừng hoạt động, hoặc sang Đã thanh lý.
// Đã giữ chỗ / Đang cho thuê do hợp đồng tự đổi. Chỉ Quản lý được đổi tay (theo phân quyền).
router.patch("/:id/status", requireRole("ADMIN"), async (req, res) => {
  const id = parseId(req.params.id);
  const status = req.body?.status;
  const note = String(req.body?.note || "").trim() || null;
  if (note && note.length > 255) throw new HttpError(400, "Lý do không được quá 255 ký tự.");
  if (!["AVAILABLE", "INACTIVE", "LIQUIDATED"].includes(status)) throw new HttpError(400, "Trạng thái không hợp lệ.");

  await withTransaction(async (conn) => {
    const [[eq]] = await conn.query("SELECT status FROM equipments WHERE id = ? FOR UPDATE", [id]);
    if (!eq) throw new HttpError(404, "Không tìm thấy thiết bị.");
    if (["RESERVED", "RENTED"].includes(eq.status)) {
      throw new HttpError(409, `Máy đang ở trạng thái "${STATUS_LABELS[eq.status]}" theo hợp đồng, không đổi tay được.`);
    }
    if (eq.status === "LIQUIDATED") throw new HttpError(409, "Máy đã thanh lý, không đổi trạng thái được nữa.");
    if (eq.status === status) throw new HttpError(400, "Máy đang ở trạng thái này rồi.");
    const extra = status === "LIQUIDATED" ? { warehouse_id: null } : {};
    if (status !== "AVAILABLE" && !note) throw new HttpError(400, "Vui lòng nhập lý do ngừng hoạt động / thanh lý.");
    await setEquipmentStatus(conn, id, status, { note, extra });
  });
  res.json({ message: `Đã chuyển máy sang "${STATUS_LABELS[status]}".` });
});

// PUT /api/equipments/:id/price – Quản lý đặt giá thuê (giá giờ và giá ngày đi cùng nhau)
router.put("/:id/price", requireRole("ADMIN"), async (req, res) => {
  const id = parseId(req.params.id);
  const data = pick(req.body, ["hourly_rate", "daily_rate"]);
  required(data, { hourly_rate: "giá thuê theo giờ", daily_rate: "giá thuê theo ngày" });
  nonNegativeNumber(data, "hourly_rate", "Giá thuê theo giờ", { integer: true });
  nonNegativeNumber(data, "daily_rate", "Giá thuê theo ngày", { integer: true });
  if (data.hourly_rate <= 0 || data.daily_rate <= 0) throw new HttpError(400, "Giá thuê phải lớn hơn 0.");
  if (data.daily_rate < data.hourly_rate) throw new HttpError(400, "Giá ngày không được thấp hơn giá giờ.");
  // 1 ngày = 1 ca 8 giờ: giá ngày phải rẻ hơn 8 giờ tính theo giờ, để khách dùng cả ngày thì thuê theo ngày có lợi hơn
  if (data.daily_rate >= data.hourly_rate * HOURS_PER_DAY) {
    throw new HttpError(
      400,
      `Giá ngày phải thấp hơn ${HOURS_PER_DAY} × giá giờ (${(data.hourly_rate * HOURS_PER_DAY).toLocaleString("vi-VN")} ₫): thuê cả ngày phải rẻ hơn thuê lẻ ${HOURS_PER_DAY} giờ.`,
      "daily_rate"
    );
  }
  const reason = String(req.body?.reason || "").trim() || null;
  maxLength({ reason }, { reason: ["Lý do điều chỉnh", 255] });

  const old = await withTransaction(async (conn) => {
    const [[old]] = await conn.query(
      "SELECT code, name, hourly_rate, daily_rate FROM equipments WHERE id = ? AND status <> 'LIQUIDATED' FOR UPDATE",
      [id]
    );
    if (!old) throw new HttpError(404, "Không tìm thấy thiết bị (hoặc máy đã thanh lý).");
    if (Number(old.hourly_rate) === Number(data.hourly_rate) && Number(old.daily_rate) === Number(data.daily_rate)) {
      throw new HttpError(400, "Giá mới giống giá đang áp dụng, không có gì thay đổi.");
    }
    await conn.query("UPDATE equipments SET ? WHERE id = ?", [data, id]);
    // Ghi lịch sử thay đổi giá (giá cũ → giá mới, ai đổi, lý do)
    await conn.query("INSERT INTO equipment_price_history SET ?", [{
      equipment_id: id,
      old_hourly_rate: old.hourly_rate,
      old_daily_rate: old.daily_rate,
      new_hourly_rate: data.hourly_rate,
      new_daily_rate: data.daily_rate,
      reason,
      changed_by: req.user.id,
    }]);
    return old;
  });
  // Lần đặt giá đầu tiên thì chưa có hợp đồng nào dùng giá cũ; từ lần thứ 2 mới nhắc hợp đồng cũ giữ giá cũ
  const firstPrice = old.daily_rate === null;
  res.json({
    message: `Đã cập nhật giá thiết bị ${old.code} – ${old.name}.` + (firstPrice ? "" : " Hợp đồng đã lập trước đó vẫn giữ giá cũ."),
  });
});

// GET /api/equipments/:id/price-history – lịch sử thay đổi giá thuê của một máy (mới nhất trước)
router.get("/:id/price-history", async (req, res) => {
  const id = parseId(req.params.id);
  const [rows] = await pool.query(
    `SELECT ph.*, em.full_name AS changed_by_name
       FROM equipment_price_history ph
       LEFT JOIN users u     ON u.id = ph.changed_by
       LEFT JOIN employees em ON em.id = u.employee_id
      WHERE ph.equipment_id = ?
      ORDER BY ph.changed_at DESC, ph.id DESC`,
    [id]
  );
  // Hợp đồng áp dụng từng mức giá: đơn giá trong hợp đồng là giá của máy lúc lập hợp đồng,
  // nên gắn hợp đồng vào lần đặt giá gần nhất (trước lúc lập) có cùng mức giá theo hình thức thuê.
  const [contracts] = await pool.query(
    `SELECT rc.id, rc.contract_no, rc.status, rc.start_date, rc.end_date, rc.pricing_type, rc.created_at,
            cd.unit_price, cd.planned_duration, cu.name AS customer_name
       FROM contract_details cd
       JOIN rental_contracts rc ON rc.id = cd.contract_id
       JOIN customers cu        ON cu.id = rc.customer_id
      WHERE cd.equipment_id = ? AND rc.status NOT IN ('DRAFT', 'REJECTED', 'CANCELLED')
      ORDER BY rc.start_date, rc.id`,
    [id]
  );
  const byId = new Map(rows.map((r) => [r.id, { ...r, contracts: [] }]));
  for (const c of contracts) {
    const rateOf = (r) => Number(c.pricing_type === "DAY" ? r.new_daily_rate : r.new_hourly_rate);
    const same = rows.filter((r) => rateOf(r) === Number(c.unit_price)); // rows: mới nhất trước
    const match = same.find((r) => new Date(r.changed_at) <= new Date(c.created_at)) || same[0];
    if (match) byId.get(match.id).contracts.push(c);
  }
  res.json([...byId.values()]);
});

// DELETE /api/equipments/:id – chỉ xoá máy nhập nhầm, chưa từng đưa vào hợp đồng
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [[used]] = await pool.query("SELECT COUNT(*) AS total FROM contract_details WHERE equipment_id = ?", [id]);
  if (used.total > 0) throw new HttpError(409, "Máy đã có trong hợp đồng nên không thể xoá. Hãy chuyển sang Ngừng hoạt động hoặc Đã thanh lý.");
  const [docs] = await pool.query("SELECT file_url FROM equipment_documents WHERE equipment_id = ?", [id]);
  const [[eqImage]] = await pool.query("SELECT image_url FROM equipments WHERE id = ?", [id]);
  await withTransaction(async (conn) => {
    const [r] = await conn.query("DELETE FROM equipments WHERE id = ?", [id]); // giấy tờ tự xoá theo (ON DELETE CASCADE)
    if (r.affectedRows === 0) throw new HttpError(404, "Không tìm thấy thiết bị.");
  });
  docs.forEach((d) => removeFile(d.file_url));
  removeFile(eqImage?.image_url);
  res.json({ message: "Đã xoá thiết bị." });
});

// ----- Giấy tờ thiết bị -----

// Xoá file đã tải lên (giấy tờ hoặc ảnh) khi bản ghi bị xoá / thay ảnh mới
function removeFile(fileUrl) {
  if (path.basename(fileUrl || "").startsWith("mau-")) return; // ảnh mẫu dùng chung cho nhiều máy thì giữ lại
  if (fileUrl?.startsWith("/uploads/docs/")) fs.unlink(path.join(UPLOAD_DIR, path.basename(fileUrl)), () => {});
  if (fileUrl?.startsWith("/uploads/equipment/")) fs.unlink(path.join(IMAGE_DIR, path.basename(fileUrl)), () => {});
}

// ----- Ảnh đại diện -----

// POST /api/equipments/:id/image (multipart/form-data: image) – tải lên / thay ảnh
router.post("/:id/image", uploadImage.single("image"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!req.file) throw new HttpError(400, "Vui lòng chọn ảnh.");
  const [[eq]] = await pool.query("SELECT image_url FROM equipments WHERE id = ?", [id]);
  if (!eq) {
    fs.unlink(req.file.path, () => {});
    throw new HttpError(404, "Không tìm thấy thiết bị.");
  }
  const imageUrl = `/uploads/equipment/${req.file.filename}`;
  await pool.query("UPDATE equipments SET image_url = ? WHERE id = ?", [imageUrl, id]);
  removeFile(eq.image_url); // xoá ảnh cũ
  res.json({ image_url: imageUrl, message: "Đã cập nhật ảnh thiết bị." });
});

// DELETE /api/equipments/:id/image – xoá ảnh
router.delete("/:id/image", async (req, res) => {
  const id = parseId(req.params.id);
  const [[eq]] = await pool.query("SELECT image_url FROM equipments WHERE id = ?", [id]);
  if (!eq) throw new HttpError(404, "Không tìm thấy thiết bị.");
  await pool.query("UPDATE equipments SET image_url = NULL WHERE id = ?", [id]);
  removeFile(eq.image_url);
  res.json({ message: "Đã xoá ảnh thiết bị." });
});

// POST /api/equipments/:id/documents (multipart/form-data: file, doc_type, doc_number, issued_date, expiry_date)
router.post("/:id/documents", upload.single("file"), async (req, res) => {
  const id = parseId(req.params.id);
  if (!req.file) throw new HttpError(400, "Vui lòng chọn file giấy tờ.");
  const data = pick(req.body, ["doc_type", "doc_number", "issued_date", "expiry_date"]);
  try {
    if (!DOC_TYPES.includes(data.doc_type)) throw new HttpError(400, "Loại giấy tờ không hợp lệ.");
    maxLength(data, { doc_number: ["Số giấy tờ", 50] });
    validDate(data, { issued_date: "Ngày cấp", expiry_date: "Ngày hết hạn" }, { notFuture: ["issued_date"] });
    if (data.issued_date && data.expiry_date && data.expiry_date < data.issued_date) {
      throw new HttpError(400, "Ngày hết hạn phải sau ngày cấp.");
    }
    const [[eq]] = await pool.query("SELECT id FROM equipments WHERE id = ?", [id]);
    if (!eq) throw new HttpError(404, "Không tìm thấy thiết bị.");
    await pool.query("INSERT INTO equipment_documents SET ?", [
      { ...data, equipment_id: id, file_url: `/uploads/docs/${req.file.filename}`, uploaded_by: req.user.id },
    ]);
  } catch (err) {
    fs.unlink(req.file.path, () => {}); // lỗi thì xoá file vừa tải lên
    throw err;
  }
  res.status(201).json({ message: "Đã thêm giấy tờ." });
});

// DELETE /api/equipments/documents/:docId
router.delete("/documents/:docId", async (req, res) => {
  const docId = parseId(req.params.docId);
  const [[doc]] = await pool.query("SELECT file_url FROM equipment_documents WHERE id = ?", [docId]);
  if (!doc) throw new HttpError(404, "Không tìm thấy giấy tờ.");
  await pool.query("DELETE FROM equipment_documents WHERE id = ?", [docId]);
  removeFile(doc.file_url);
  res.json({ message: "Đã xoá giấy tờ." });
});

module.exports = router;
