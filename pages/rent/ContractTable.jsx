import StatusBadge from "../../components/common/StatusBadge";
import { formatDate, formatMoney, todayISO } from "../../utils/format";
import { CONTRACT_STATUS, PRICING_TYPE } from "../../utils/labels";

// Bảng danh sách hợp đồng dùng chung cho màn Quản lý hợp đồng và Duyệt hợp đồng
function ContractTable({ rows, onOpen, emptyText }) {
  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Số hợp đồng</th>
            <th>Khách hàng / Công trình</th>
            <th>Thời gian</th>
            <th>Thiết bị</th>
            <th className="align-right">Tổng giá trị</th>
            <th>Người lập</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="table-message">
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
                    <span className="cell-sub">{PRICING_TYPE[c.pricing_type]}</span>
                  </td>
                  <td className="cell-wrap">
                    <span className="cell-main">{c.customer_name}</span>
                    <span className="cell-sub">{c.site_name}</span>
                  </td>
                  <td>
                    {formatDate(c.start_date)} – {formatDate(c.end_date)}
                    {overdue && <span className="danger-text">Quá hạn trả máy</span>}
                  </td>
                  <td className="cell-wrap">
                    <span className="cell-main">{c.item_count} máy</span>
                    <span className="cell-sub">{c.equipment_codes}</span>
                  </td>
                  <td className="align-right">
                    <strong>{formatMoney(c.total_amount)}</strong>
                  </td>
                  <td>{c.created_by_name}</td>
                  <td>
                    <StatusBadge map={CONTRACT_STATUS} value={c.status} />
                    {c.status === "APPROVED" && !c.deposit_paid_at && (
                      <span className={c.deposit_overdue ? "danger-text" : "warn-text"}>
                        {c.deposit_overdue ? "Quá hạn đặt cọc" : "Chờ đặt cọc"}
                      </span>
                    )}
                  </td>
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
