import StatusBadge from "../../components/common/StatusBadge";
import RowMenu from "../../components/common/RowMenu";
import { EyeIcon } from "../../components/common/Icons";
import { formatDate, formatMoney, todayISO } from "../../utils/format";
import { CONTRACT_STATUS } from "../../utils/labels";

// Bảng danh sách hợp đồng dùng chung cho màn Quản lý hợp đồng và Duyệt hợp đồng
// onPrint(id): có thì thêm cột Thao tác (nút ba chấm) với "Xem chi tiết" và "In hợp đồng" (in được khi khách đã đặt cọc)
function ContractTable({ rows, onOpen, emptyText, onPrint }) {
  const cols = onPrint ? 8 : 7;
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Số hợp đồng</th>
            <th>Khách hàng</th>
            <th>Thời gian thuê</th>
            <th>Thiết bị</th>
            <th className="align-right">Tổng giá trị</th>
            <th>Người lập</th>
            <th>Trạng thái</th>
            {onPrint && <th className="col-actions">Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={cols} className="table-message">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((c) => {
              const overdue = c.status === "ACTIVE" && c.end_date.slice(0, 10) < todayISO();
              return (
                <tr key={c.id} className="clickable" onClick={() => onOpen(c.id)}>
                  <td>
                    <strong>{c.contract_no}</strong>
                  </td>
                  <td className="cell-wrap cell-compact">
                    <span className="cell-main">{c.customer_name}</span>
                  </td>
                  <td>
                    <span className="cell-main">{formatDate(c.start_date)} –</span>
                    <span className="cell-main">{formatDate(c.end_date)}</span>
                    {overdue && <span className="danger-text">Quá hạn trả máy</span>}
                  </td>
                  <td className="cell-wrap cell-compact">
                    <span className="cell-main">{c.item_count} máy</span>
                    <span className="cell-sub">{c.equipment_codes}</span>
                  </td>
                  <td className="align-right">
                    <strong>{formatMoney(c.total_amount)}</strong>
                  </td>
                  <td style={{ whiteSpace: "normal", minWidth: 90 }}>{c.created_by_name}</td>
                  <td>
                    <StatusBadge map={CONTRACT_STATUS} value={c.status} />
                    {c.status === "APPROVED" && !c.deposit_paid_at && (
                      <span className={c.deposit_overdue ? "danger-text" : "warn-text"}>
                        {c.deposit_overdue ? "Quá hạn đặt cọc" : "Chờ đặt cọc"}
                      </span>
                    )}
                  </td>
                  {onPrint && (
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        items={[
                          { key: "view", label: "Xem chi tiết", icon: <EyeIcon />, onClick: () => onOpen(c.id) },
                          {
                            key: "print",
                            label: "In hợp đồng",
                            disabled: !c.deposit_paid_at || c.status === "CANCELLED",
                            title: c.deposit_paid_at ? "Xem trước rồi in / lưu PDF" : "In được sau khi khách đặt cọc",
                            onClick: () => onPrint(c.id),
                          },
                        ]}
                      />
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ContractTable;
