// Chạy một nhóm câu lệnh trong một giao dịch (transaction):
// tất cả cùng thành công, hoặc có lỗi thì huỷ hết, dữ liệu không bị ghi dở dang.
// Cách dùng: const result = await withTransaction(async (conn) => { ...conn.query(...)... });
const pool = require("../config/db");

async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = withTransaction;
