// API Quản lý hãng thiết bị (bảng brands)
const express = require("express");
const pool = require("../config/db");
const { refreshEquipmentNames } = require("../utils/equipmentName");
const HttpError = require("../utils/httpError");
const assertNoDuplicate = require("../utils/duplicate");
const { squeeze, pick, required, maxLength, matches, parseId } = require("../utils/validate");

const router = express.Router();

function validateBrand(body) {
  const data = pick(body, ["name", "country", "website"]);
  required(data, { name: "tên hãng" });
  squeeze(data, ["name"]);
  maxLength(data, { name: ["Tên hãng", 50], country: ["Quốc gia", 50], website: ["Website", 255] });
  matches(data.website, "url", "Website phải bắt đầu bằng http:// hoặc https://");
  return data;
}

async function countEquipments(id) {
  const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM equipments WHERE brand_id = ?", [id]);
  return total;
}

// GET /api/brands – danh sách hãng kèm số thiết bị của hãng
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT b.*, (SELECT COUNT(*) FROM equipments e WHERE e.brand_id = b.id) AS equipment_count
       FROM brands b
      ORDER BY b.name`
  );
  res.json(rows);
});

// POST /api/brands
router.post("/", async (req, res) => {
  const data = validateBrand(req.body);
  await assertNoDuplicate("brands", [{ column: "name", value: data.name, label: "Tên hãng", describe: (b) => `hãng đã có "${b.name}"` }]);
  const [result] = await pool.query("INSERT INTO brands SET ?", [data]);
  res.status(201).json({ id: result.insertId, message: `Đã thêm hãng ${data.name}.` });
});

// PUT /api/brands/:id
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const data = validateBrand(req.body);
  await assertNoDuplicate("brands", [{ column: "name", value: data.name, label: "Tên hãng", describe: (b) => `hãng đã có "${b.name}"` }], id);
  const [result] = await pool.query("UPDATE brands SET ? WHERE id = ?", [data, id]);
  if (result.affectedRows === 0) throw new HttpError(404, "Không tìm thấy hãng.");
  await refreshEquipmentNames(pool, "e.brand_id = ?", [id]); // tên máy có chứa tên hãng
  res.json({ message: "Đã cập nhật hãng thiết bị." });
});

// DELETE /api/brands/:id – chỉ xoá hãng chưa có thiết bị
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const total = await countEquipments(id);
  if (total > 0) throw new HttpError(409, `Hãng này đang có ${total} thiết bị nên không thể xoá.`);
  const [result] = await pool.query("DELETE FROM brands WHERE id = ?", [id]);
  if (result.affectedRows === 0) throw new HttpError(404, "Không tìm thấy hãng.");
  res.json({ message: "Đã xoá hãng thiết bị." });
});

module.exports = router;
