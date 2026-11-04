// Sinh mã tự động tăng dần theo tiền tố, ví dụ KH0001 → KH0002, KB03 → KB04.
// table, column: bảng và cột chứa mã; prefix: tiền tố; width: số chữ số phần đuôi.
async function nextCode(conn, table, column, prefix, width) {
  const [rows] = await conn.query(
    `SELECT MAX(CAST(SUBSTRING(${column}, ?) AS UNSIGNED)) AS maxNo
       FROM ${table}
      WHERE ${column} REGEXP ?`,
    [prefix.length + 1, `^${prefix}[0-9]+$`]
  );
  const next = (rows[0].maxNo || 0) + 1;
  return prefix + String(next).padStart(width, "0");
}

module.exports = nextCode;
