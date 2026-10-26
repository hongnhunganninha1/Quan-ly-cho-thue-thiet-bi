import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import useApiData from "../../hooks/useApiData";
import StatusBadge from "../../components/common/StatusBadge";
import ContractDetailModal from "../rent/ContractDetailModal";
import { formatDate, formatMoney } from "../../utils/format";
import { CONTRACT_STATUS } from "../../utils/labels";
import "../equipment/Equipment.css";

// Hộp thoại lịch sử thuê của một khách hàng: các hợp đồng đã lập (lấy từ danh sách hợp đồng).
// Bấm số hợp đồng để mở chi tiết hợp đồng.
function CustomerRentalModal({ customer, user, onClose }) {
  const { data: contracts, loading, error, reload } = useApiData("/contracts", []);
  const [openContract, setOpenContract] = useState(null);

  const rows = useMemo(() => contracts.filter((c) => c.customer_id === customer.id), [contracts, customer.id]);
  // Tổng giá trị chỉ tính hợp đồng đã thực hiện (không tính nháp, bị từ chối, đã huỷ)
  const counted = rows.filter((c) => !["DRAFT", "REJECTED", "CANCELLED"].includes(c.status));
  const total = counted.reduce((sum, c) => sum + Number(c.total_amount || 0), 0);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && !openContract && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, openContract]);

  return createPortal(
    <>
      <div className="modal-backdrop" onMouseDown={onClose}>
        <div className="modal modal-xl" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
          <header className="modal-header">
            <div>
              <h2>Lịch sử thuê</h2>
              <p className="modal-subtitle">
                {customer.code} – {customer.name}
              </p>
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          </header>
          <div className="modal-body">
            {error && <div className="modal-error">{error}</div>}
            <div className="summary-chips" style={{ padding: "0 0 12px" }}>
              <span className="badge badge-neutral">{rows.length} hợp đồng</span>
              <span className="badge badge-info">{counted.length} hợp đồng đã thực hiện</span>
              <span className="badge badge-success">Tổng giá trị: {formatMoney(total)}</span>
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hợp đồng</th>
                    <th>Công trình</th>
                    <th>Thời gian thuê</th>
                    <th>Thiết bị</th>
                    <th className="align-right">Giá trị HĐ</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-message">
                        {loading ? "Đang tải dữ liệu…" : "Khách hàng chưa có hợp đồng nào."}
                      </td>
                    </tr>
                  ) : (
                    rows.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button className="link-cell" onClick={() => setOpenContract(c.id)} title="Xem hợp đồng">
                            {c.contract_no}
                          </button>
                        </td>
                        <td className="cell-wrap">
                          <span className="cell-main">{c.site_name}</span>
                          <span className="cell-sub">{c.site_address}</span>
                        </td>
                        <td>
                          {formatDate(c.start_date)} – {formatDate(c.end_date)}
                        </td>
                        <td className="cell-wrap">
                          <span className="cell-main">{c.item_count} máy</span>
                          <span className="cell-sub">{c.equipment_codes}</span>
                        </td>
                        <td className="align-right">{formatMoney(c.total_amount)}</td>
                        <td>
                          <StatusBadge map={CONTRACT_STATUS} value={c.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      {openContract && (
        <ContractDetailModal
          id={openContract}
          user={user}
          onClose={() => setOpenContract(null)}
          onChanged={reload}
          onEdit={() => {}}
        />
      )}
    </>,
    document.body,
  );
}

export default CustomerRentalModal;
