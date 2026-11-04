// API Quản lý bãi máy (bảng warehouses)
const express = require("express");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const nextCode = require("../utils/nextCode");
const assertNoDuplicate = require("../utils/duplicate");
const { squeeze, pick, required, maxLength, nonNegativeNumber, parseId } = require("../utils/validate");

const router = express.Router();

function validateWarehouse(body) {
  const data = pick(body, ["name", "address", "area_m2", "capacity", "status"]);
  required(data, { name: "tên bãi máy", address: "địa chỉ" });
  squeeze(data, ["name", "address"]);
  maxLength(data, { name: ["Tên bãi máy", 100], address: ["Địa chỉ", 255] });
  nonNegativeNumber(data, "area_m2", "Diện tích");
  nonNegativeNumber(data, "capacity", "Sức chứa", { integer: true });
  data.status = data.status || "ACTIVE";
  if (!["ACTIVE", "INACTIVE"].includes(data.status)) throw new HttpError(400, "Trạng thái không hợp lệ.");
  return data;
}

// Không trùng tên bãi, không trùng địa chỉ với bãi khác
function assertUniqueWarehouse(data, id = 0) {
  const describe = (w) => `bãi ${w.code} – ${w.name}`;
  return assertNoDuplicate("warehouses", [
    { column: "name", value: data.name, label: "Tên bãi", describe },
    { column: "address", value: data.address, label: "Địa chỉ", describe },
  ], id);
}

// Số thiết bị đang nằm ở bãi (máy đã thanh lý không tính)
async function countEquipments(id) {
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM equipments WHERE warehouse_id = ? AND status <> 'LIQUIDATED'", [id]);
  return total;
}

// GET /api/warehouses – danh sách bãi máy kèm số thiết bị đang ở bãi
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT w.*, (SELECT COUNT(*) FROM equipments e WHERE e.warehouse_id = w.id AND e.status <> 'LIQUIDATED') AS equipment_count
       FROM warehouses w
      ORDER BY w.code`
  );
  res.json(rows);
});

// POST /api/warehouses – thêm bãi máy, mã tự sinh KB01, KB02…
router.post("/", async (req, res) => {
  const data = validateWarehouse(req.body);
  await assertUniqueWarehouse(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    data.code = await nextCode(conn, "warehouses", "code", "KB", 2);
    const [result] = await conn.query("INSERT INTO warehouses SET ?", [data]);
    await conn.commit();
    res.status(201).json({ id: result.insertId, code: data.code, message: `Đã thêm bãi máy ${data.code}.` });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// PUT /api/warehouses/:id
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const data = validateWarehouse(req.body);
  await assertUniqueWarehouse(data, id);

  const total = await countEquipments(id);
  // Không giảm sức chứa xuống dưới số máy đang ở bãi
  if (data.capacity !== null && Number(data.capacity) < total) {
    throw new HttpError(400, `Bãi đang chứa ${total} thiết bị, sức chứa không được nhỏ hơn ${total}.`);
  }
  // Bãi còn thiết bị thì không cho chuyển sang "Ngừng hoạt động"
  if (data.status === "INACTIVE") {
    if (total > 0) {
      throw new HttpError(409, `Bãi đang chứa ${total} thiết bị. Hãy chuyển thiết bị sang bãi khác trước khi ngừng hoạt động.`);
    }
  }
  const [result] = await pool.query("UPDATE warehouses SET ? WHERE id = ?", [data, id]);
  if (result.affectedRows === 0) throw new HttpError(404, "Không tìm thấy bãi máy.");
  res.json({ message: "Đã cập nhật bãi máy." });
});

// DELETE /api/warehouses/:id – chỉ xoá bãi chưa từng chứa / bàn giao / nhận thiết bị
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const total = await countEquipments(id);
  if (total > 0) throw new HttpError(409, `Bãi đang chứa ${total} thiết bị nên không thể xoá.`);

  const [[{ used }]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM handovers WHERE from_warehouse_id = ?)
          + (SELECT COUNT(*) FROM equipment_returns WHERE to_warehouse_id = ?) AS used`,
    [id, id]
  );
  if (used > 0) {
    throw new HttpError(409, "Bãi đã có lịch sử bàn giao / thu hồi thiết bị nên không thể xoá. Hãy chuyển sang trạng thái Ngừng hoạt động.");
  }
  const [result] = await pool.query("DELETE FROM warehouses WHERE id = ?", [id]);
  if (result.affectedRows === 0) throw new HttpError(404, "Không tìm thấy bãi máy.");
  res.json({ message: "Đã xoá bãi máy." });
});

module.exports = router;
