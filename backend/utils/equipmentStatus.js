// Đổi trạng thái thiết bị. Không lưu bảng lịch sử trạng thái riêng: diễn biến của máy xem lại được
// từ hợp đồng, phiếu bàn giao và phiếu thu hồi. Chỉ giữ lý do của trạng thái hiện tại (status_note)
// khi máy Ngừng hoạt động / Đã thanh lý; các trạng thái khác thì xoá lý do cũ.
async function setEquipmentStatus(conn, equipmentId, status, { note = null, extra = {} } = {}) {
  const status_note = ["INACTIVE", "LIQUIDATED"].includes(status) ? note : null;
  await conn.query("UPDATE equipments SET ? WHERE id = ?", [{ ...extra, status, status_note }, equipmentId]);
}

// Còn hợp đồng nào (chờ duyệt / đã duyệt / đang thuê) chờ bàn giao máy này không; excludeContractId: bỏ qua một hợp đồng
async function hasWaitingContract(conn, equipmentId, excludeContractId = 0) {
  const [[{ waiting }]] = await conn.query(
    `SELECT COUNT(*) AS waiting
       FROM contract_details cd
       JOIN rental_contracts rc ON rc.id = cd.contract_id
      WHERE cd.equipment_id = ? AND cd.status = 'PENDING' AND rc.status IN ('PENDING_APPROVAL','APPROVED','ACTIVE')
        AND rc.id <> ?`,
    [equipmentId, excludeContractId]
  );
  return waiting > 0;
}

// Máy đang "Đã giữ chỗ" cho một hợp đồng vừa bị huỷ / thu hồi xong:
// nếu không còn hợp đồng nào khác chờ bàn giao máy này thì trả về "Sẵn sàng".
async function releaseReservation(conn, equipmentId, opts) {
  const [[eq]] = await conn.query("SELECT status FROM equipments WHERE id = ?", [equipmentId]);
  if (!eq || eq.status !== "RESERVED") return;
  if (!(await hasWaitingContract(conn, equipmentId, opts.contractId || 0))) {
    await setEquipmentStatus(conn, equipmentId, "AVAILABLE", opts);
  }
}

module.exports = { setEquipmentStatus, releaseReservation, hasWaitingContract };
