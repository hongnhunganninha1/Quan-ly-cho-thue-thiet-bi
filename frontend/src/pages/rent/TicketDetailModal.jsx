import { useEffect } from "react";
import { createPortal } from "react-dom";
import "../equipment/Equipment.css";
import { MeterPhotoThumb } from "../../components/common/MeterPhoto";
import { formatDateTime, formatMoney, formatNumber } from "../../utils/format";

function Info({ label, value, full }) {
  return (
    <div className={`info-item ${full ? "full" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || value === 0 ? value : <span className="text-muted">—</span>}</dd>
    </div>
  );
}

// Xem lại một phiếu bàn giao (kind = "handover") hoặc phiếu thu hồi (kind = "return"),
// kèm ảnh chụp đồng hồ giờ máy. Phiếu thu hồi hiện cả ảnh lúc bàn giao để đối chiếu.
function TicketDetailModal({ kind, ticket: t, onClose, onOpenContract }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isReturn = kind === "return";
  const no = isReturn ? t.return_no : t.handover_no;
  const fuel = (v) => (v !== null && v !== undefined ? `${v}%` : null);
  const contractLink = (
    <button className="link-cell" onClick={() => onOpenContract(t.contract_id)} title="Xem hợp đồng">
      <strong>{t.contract_no}</strong>
    </button>
  );

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>
              {isReturn ? "Phiếu thu hồi" : "Phiếu bàn giao"} {no}
            </h2>
            <p className="modal-subtitle">
              {t.code} – {t.name}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>

        <div className="modal-body">
          {isReturn ? (
            <dl className="info-grid">
              <Info label="Hợp đồng" value={contractLink} />
              <Info label="Khách hàng" value={t.customer_name} />
              <Info label="Thời điểm thu hồi" value={formatDateTime(t.returned_at)} />
              <Info label="Nhận về bãi" value={t.warehouse_name} />
              <Info label="Người nhận" value={t.received_by_name} />
              <Info label="Mức nhiên liệu" value={fuel(t.fuel_level)} />
              <Info label="Giờ máy lúc giao" value={t.handover_hours !== null ? formatNumber(t.handover_hours) : null} />
              <Info label="Giờ máy lúc nhận" value={formatNumber(t.operating_hours)} />
              <Info
                label="Số giờ đã chạy"
                value={t.handover_hours !== null ? formatNumber(t.operating_hours - t.handover_hours) : null}
              />
              <Info label="Tình trạng khi nhận" value={t.condition_note} full />
              <Info
                label="Hư hỏng"
                value={t.is_damaged ? `Có – ${t.damage_description || ""}` : "Không"}
                full
              />
              <Info label="Phí vượt giờ" value={formatMoney(t.overtime_fee)} />
              <Info label="Bồi thường" value={formatMoney(t.compensation_amount)} />
            </dl>
          ) : (
            <dl className="info-grid">
              <Info label="Hợp đồng" value={contractLink} />
              <Info label="Khách hàng" value={t.customer_name} />
              <Info label="Thời điểm bàn giao" value={formatDateTime(t.handover_at)} />
              <Info label="Xuất từ bãi" value={t.warehouse_name} />
              <Info label="Giờ máy lúc giao" value={formatNumber(t.operating_hours)} />
              <Info label="Mức nhiên liệu" value={fuel(t.fuel_level)} />
              <Info label="Người nhận" value={t.receiver_phone ? `${t.receiver_name} · ${t.receiver_phone}` : t.receiver_name} />
              <Info label="Người giao" value={t.handed_by_name} />
              <Info label="Phụ kiện kèm theo" value={t.accessories} />
              <Info label="Tình trạng khi giao" value={t.condition_note} full />
            </dl>
          )}

          <div className="ticket-photos">
            {isReturn && (
              <div>
                <h4>
                  Đồng hồ lúc bàn giao <span>{t.handover_no ? `(${t.handover_no})` : ""}</span>
                </h4>
                <MeterPhotoThumb
                  large
                  url={t.handover_meter_photo}
                  title={`Đồng hồ giờ máy lúc bàn giao – ${t.handover_no}`}
                  emptyText="Phiếu bàn giao không có ảnh"
                />
              </div>
            )}
            <div>
              <h4>
                Đồng hồ lúc {isReturn ? "thu hồi" : "bàn giao"} <span>({no})</span>
              </h4>
              <MeterPhotoThumb
                large
                url={t.meter_photo_url}
                title={`Đồng hồ giờ máy lúc ${isReturn ? "thu hồi" : "bàn giao"} – ${no}`}
                emptyText="Phiếu này không có ảnh"
              />
            </div>
          </div>
          <p className="form-hint" style={{ marginTop: 8 }}>
            Bấm vào ảnh để xem lớn.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default TicketDetailModal;
