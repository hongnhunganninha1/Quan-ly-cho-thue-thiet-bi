import { useEffect } from "react";
import { createPortal } from "react-dom";
import useApiData from "../../hooks/useApiData";
import { formatDateTime, formatMoney } from "../../utils/format";

// Mức thay đổi so với giá cũ, VD "+10%" / "−5%"
function changeText(oldValue, newValue) {
  if (!oldValue) return null;
  const pct = ((Number(newValue) - Number(oldValue)) / Number(oldValue)) * 100;
  if (Math.abs(pct) < 0.05) return { text: "không đổi", cls: "text-muted" };
  const sign = pct > 0 ? "+" : "−";
  return { text: `${sign}${Math.abs(pct).toFixed(1).replace(".", ",")}%`, cls: pct > 0 ? "danger-text" : "text-success" };
}

function PriceCell({ oldValue, newValue }) {
  const change = changeText(oldValue, newValue);
  return (
    <>
      <span className="cell-main">{formatMoney(newValue)}</span>
      <span className="cell-sub">
        {oldValue ? <>cũ: {formatMoney(oldValue)}</> : "đặt giá lần đầu"}
        {change && <span className={change.cls}> · {change.text}</span>}
      </span>
    </>
  );
}

// Hộp thoại lịch sử thay đổi giá thuê của một máy
function PriceHistoryModal({ equipment, onClose }) {
  const { data: rows, loading, error } = useApiData(`/equipments/${equipment.id}/price-history`, []);

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>Lịch sử thay đổi giá thuê</h2>
            <p className="modal-subtitle">
              {equipment.code} – {equipment.name}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="modal-body">
          {error && <div className="modal-error">{error}</div>}
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th className="align-right">Giá theo giờ</th>
                  <th className="align-right">Giá theo ngày</th>
                  <th>Lý do</th>
                  <th>Người thay đổi</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-message">
                      {loading ? "Đang tải dữ liệu…" : "Máy chưa có lần thay đổi giá nào."}
                    </td>
                  </tr>
                ) : (
                  rows.map((h, i) => (
                    <tr key={h.id}>
                      <td>
                        {formatDateTime(h.changed_at)}
                        {i === 0 && <span className="cell-sub text-success">Đang áp dụng</span>}
                      </td>
                      <td className="align-right">
                        <PriceCell oldValue={h.old_hourly_rate} newValue={h.new_hourly_rate} />
                      </td>
                      <td className="align-right">
                        <PriceCell oldValue={h.old_daily_rate} newValue={h.new_daily_rate} />
                      </td>
                      <td className="cell-wrap">{h.reason || <span className="text-muted">—</span>}</td>
                      <td>{h.changed_by_name || <span className="text-muted">Hệ thống</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="form-hint" style={{ marginTop: 10 }}>
            Hợp đồng đã lập vẫn giữ đơn giá tại thời điểm lập, không bị ảnh hưởng khi đổi giá.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default PriceHistoryModal;
