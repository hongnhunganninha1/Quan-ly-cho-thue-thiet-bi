// Kiểm tra sức chứa bãi máy: bãi đã đủ số máy theo sức chứa thì không nhận thêm máy.
// Máy đã thanh lý không tính (không còn chiếm chỗ ở bãi).
const HttpError = require("./httpError");

const COUNT_SQL = "SELECT COUNT(*) AS total FROM equipments WHERE warehouse_id = ? AND status <> 'LIQUIDATED' AND id <> ?";

// excludeId: máy đang được chuyển vào bãi (khi sửa / thu hồi) – không tự tính chính nó
async function assertWarehouseHasRoom(conn, warehouseId, excludeId = 0) {
  const [[wh]] = await conn.query("SELECT name, capacity FROM warehouses WHERE id = ? FOR UPDATE", [warehouseId]);
  if (!wh || wh.capacity === null) return; // bãi không khai báo sức chứa thì không giới hạn
  const [[{ total }]] = await conn.query(COUNT_SQL, [warehouseId, excludeId]);
  if (total >= wh.capacity) {
    throw new HttpError(409, `${wh.name} đã đầy (${total}/${wh.capacity} máy). Hãy chọn bãi khác.`);
  }
}

module.exports = { assertWarehouseHasRoom };
