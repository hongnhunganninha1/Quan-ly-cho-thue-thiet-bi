// API Quản lý loại thiết bị (bảng equipment_categories), phân 2 cấp:
//   Nhóm thiết bị (parent_id = NULL), VD: Thiết bị đào đắp đất
//     └─ Loại thiết bị (parent_id = id của nhóm), VD: Máy xúc đào bánh xích
// Thiết bị chỉ gắn vào loại (cấp 2), không gắn trực tiếp vào nhóm.
const express = require("express");
const pool = require("../config/db");
const { refreshEquipmentNames } = require("../utils/equipmentName");
const HttpError = require("../utils/httpError");
const withTransaction = require("../utils/transaction");
const assertNoDuplicate = require("../utils/duplicate");
const { squeeze, pick, required, maxLength, parseId } = require("../utils/validate");

const router = express.Router();

async function validateCategory(body, id = 0) {
  const data = pick(body, ["parent_id", "code", "name", "description"]);
  required(data, { code: "mã", name: "tên" });
  data.code = String(data.code).toUpperCase();
  if (!/^[A-Z0-9-]{1,10}$/.test(data.code)) {
    throw new HttpError(400, "Mã chỉ gồm chữ cái không dấu, chữ số và dấu gạch ngang, tối đa 10 ký tự (VD: LD-DX).");
  }
  squeeze(data, ["name"]);
  maxLength(data, { name: ["Tên", 100], description: ["Mô tả", 255] });

  if (data.parent_id !== null) {
    data.parent_id = parseId(data.parent_id);
    if (data.parent_id === id) throw new HttpError(400, "Không chọn chính nó làm nhóm cha.");
    const [[parent]] = await pool.query("SELECT parent_id FROM equipment_categories WHERE id = ?", [data.parent_id]);
    if (!parent) throw new HttpError(400, "Nhóm thiết bị không tồn tại.");
    if (parent.parent_id !== null) throw new HttpError(400, "Chỉ chọn được nhóm thiết bị (cấp 1) làm nhóm cha.");
  }
  // Mã và tên không trùng với nhóm / loại khác (kể cả khác cấp)
  const describe = (c) => `${c.parent_id === null ? "nhóm" : "loại"} thiết bị ${c.code} – ${c.name}`;
  await assertNoDuplicate("equipment_categories", [
    { column: "code", value: data.code, label: "Mã", describe },
    { column: "name", value: data.name, label: "Tên", describe },
  ], id);
  return data;
}

async function counts(id) {
  const [[r]] = await pool.query(
    `SELECT (SELECT COUNT(*) FROM equipment_categories WHERE parent_id = ?) AS children,
            (SELECT COUNT(*) FROM equipments WHERE category_id = ?) AS equipments`,
    [id, id]
  );
  return r;
}

// GET /api/categories – toàn bộ nhóm và loại, kèm số thiết bị.
// Nhóm: equipment_count = tổng số máy của các loại con.
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, p.name AS parent_name, p.code AS parent_code,
            (SELECT COUNT(*) FROM equipment_categories x WHERE x.parent_id = c.id) AS child_count,
            (SELECT COUNT(*) FROM equipments e
              WHERE e.status <> 'LIQUIDATED'
                AND (e.category_id = c.id OR e.category_id IN (SELECT x.id FROM equipment_categories x WHERE x.parent_id = c.id))
            ) AS equipment_count
       FROM equipment_categories c
       LEFT JOIN equipment_categories p ON p.id = c.parent_id
      ORDER BY COALESCE(c.parent_id, c.id), c.parent_id IS NOT NULL, c.name`
  );
  res.json(rows);
});

// POST /api/categories – thêm nhóm (không có parent_id) hoặc loại (có parent_id)
router.post("/", async (req, res) => {
  const data = await validateCategory(req.body);
  const [result] = await pool.query("INSERT INTO equipment_categories SET ?", [data]);
  res.status(201).json({ id: result.insertId, message: `Đã thêm ${data.parent_id ? "loại" : "nhóm"} thiết bị ${data.name}.` });
});

// PUT /api/categories/:id
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const data = await validateCategory(req.body, id);
  const [[old]] = await pool.query("SELECT parent_id FROM equipment_categories WHERE id = ?", [id]);
  if (!old) throw new HttpError(404, "Không tìm thấy loại thiết bị.");

  const c = await counts(id);
  // Đổi cấp: nhóm đang có loại con thì không thành loại được; loại đang có máy thì không thành nhóm được
  if (old.parent_id === null && data.parent_id !== null && c.children > 0) {
    throw new HttpError(409, "Nhóm này đang có loại con, không chuyển thành loại được.");
  }
  if (old.parent_id !== null && data.parent_id === null && c.equipments > 0) {
    throw new HttpError(409, "Loại này đang có thiết bị, không chuyển thành nhóm được.");
  }
  await pool.query("UPDATE equipment_categories SET ? WHERE id = ?", [data, id]);
  await refreshEquipmentNames(pool, "e.category_id = ?", [id]); // tên máy có chứa tên loại
  res.json({ message: "Đã cập nhật." });
});

// DELETE /api/categories/:id – xoá được khi chưa có thiết bị nào.
// Xoá nhóm thì các loại con (đều chưa có máy) bị xoá theo.
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [[cat]] = await pool.query("SELECT parent_id, name FROM equipment_categories WHERE id = ?", [id]);
  if (!cat) throw new HttpError(404, "Không tìm thấy loại thiết bị.");
  // Đếm cả máy đã thanh lý vì máy vẫn còn tham chiếu tới loại
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM equipments
      WHERE category_id = ? OR category_id IN (SELECT x.id FROM equipment_categories x WHERE x.parent_id = ?)`,
    [id, id]
  );
  if (total > 0) {
    throw new HttpError(409, `${cat.parent_id === null ? "Nhóm" : "Loại"} này đang có ${total} thiết bị nên không thể xoá.`);
  }
  const removed = await withTransaction(async (conn) => {
    const [children] = await conn.query("DELETE FROM equipment_categories WHERE parent_id = ?", [id]);
    await conn.query("DELETE FROM equipment_categories WHERE id = ?", [id]);
    return children.affectedRows;
  });
  res.json({ message: `Đã xoá ${cat.name}${removed ? ` và ${removed} loại con` : ""}.` });
});

module.exports = router;
