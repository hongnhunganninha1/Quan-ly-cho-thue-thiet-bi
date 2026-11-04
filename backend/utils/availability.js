// Kiểm tra lịch bận của thiết bị.
// Một máy bận trong khoảng [start_date, end_date] của các hợp đồng Chờ duyệt / Đã duyệt / Đang thuê.
// Máy đã bàn giao mà quá hạn chưa trả thì chưa biết khi nào về, coi như bận cho đến khi thu hồi.
// Hai khoảng trùng nhau khi: bắt_đầu_1 <= kết_thúc_2 VÀ bắt_đầu_2 <= kết_thúc_1.

const BUSY_SQL = `
  SELECT cd.equipment_id, rc.id AS contract_id, rc.contract_no, rc.status AS contract_status,
         rc.start_date, rc.end_date, cd.status AS detail_status, cu.name AS customer_name
    FROM contract_details cd
    JOIN rental_contracts rc ON rc.id = cd.contract_id
    JOIN customers cu        ON cu.id = rc.customer_id
   WHERE rc.status IN ('PENDING_APPROVAL','APPROVED','ACTIVE')
     AND cd.status <> 'RETURNED'
     AND rc.id <> ?
     AND rc.start_date <= ?
     AND ? <= IF(cd.status = 'HANDED_OVER' AND rc.end_date < CURDATE(), '9999-12-31', rc.end_date)`;

// Trả về các lịch bận trùng với khoảng [from, to], bỏ qua hợp đồng excludeContractId (khi sửa hợp đồng)
async function findConflicts(conn, { equipmentIds = null, from, to, excludeContractId = 0 }) {
  let sql = BUSY_SQL;
  const params = [excludeContractId, to, from];
  if (equipmentIds) {
    if (equipmentIds.length === 0) return [];
    sql += " AND cd.equipment_id IN (?)";
    params.push(equipmentIds);
  }
  const [rows] = await conn.query(sql + " ORDER BY rc.start_date", params);
  return rows;
}

module.exports = { findConflicts };
