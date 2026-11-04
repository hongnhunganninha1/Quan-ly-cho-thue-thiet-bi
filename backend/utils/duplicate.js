// Kiểm tra trùng lặp trước khi thêm / sửa: báo rõ giá trị nào trùng với bản ghi nào, kèm tên ô cần sửa.
// So sánh không phân biệt chữ hoa / thường (theo collation utf8mb4_unicode_ci của CSDL).
const pool = require("../config/db");
const HttpError = require("./httpError");

// checks: [{ column, value, label, describe(row) }] – describe trả về bản ghi bị trùng, VD "bãi KB01 – Bãi Long Biên"
// exceptId: id của bản ghi đang sửa (không tính trùng với chính nó)
async function assertNoDuplicate(table, checks, exceptId = 0) {
  for (const c of checks) {
    if (c.value === null || c.value === undefined || c.value === "") continue;
    const [[row]] = await pool.query(`SELECT * FROM ${table} WHERE ${c.column} = ? AND id <> ? LIMIT 1`, [c.value, exceptId]);
    if (row) throw new HttpError(409, `${c.label} "${c.value}" bị trùng với ${c.describe(row)}.`, c.column);
  }
}

module.exports = assertNoDuplicate;
