import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "../equipment/Equipment.css";
import "./Rent.css";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import StatusBadge from "../../components/common/StatusBadge";
import FormModal from "../../components/common/FormModal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { formatDate, formatDateTime, formatMoney, formatNumber, nowLocalISO } from "../../utils/format";
import { CONTRACT_STATUS, DETAIL_STATUS, PAYMENT_STATUS, PRICING_TYPE } from "../../utils/labels";
import { MeterPhotoThumb } from "../../components/common/MeterPhoto";
import PrintPreview from "../../components/common/PrintPreview";
import { contractDoc, ticketDoc } from "../../utils/printDocs";

// Các bước của quy trình cho thuê để vẽ thanh tiến trình
const FLOW = [
  { key: "DRAFT", label: "Lập hợp đồng" },
  { key: "PENDING_APPROVAL", label: "Chờ duyệt" },
  { key: "APPROVED", label: "Đã duyệt" },
  { key: "DEPOSIT", label: "Đặt cọc" },
  { key: "ACTIVE", label: "Bàn giao" },
  { key: "COMPLETED", label: "Thu hồi" },
  { key: "SETTLED", label: "Quyết toán" },
];

function flowIndex(c) {
  switch (c.status) {
    case "DRAFT":
    case "REJECTED":
      return 0;
    case "PENDING_APPROVAL":
      return 1;
    case "APPROVED":
      return c.deposit_paid_at ? 3 : 2;
    case "ACTIVE":
      return 4;
    case "COMPLETED":
      return 5;
    case "SETTLED":
      return 7;
    default:
      return -1;
  }
}

// Hộp thoại hồ sơ hợp đồng, kèm các nút xử lý theo trạng thái và vai trò.
// onChanged(message): đã thay đổi dữ liệu; onEdit(contract): mở form sửa.
function ContractDetailModal({ id, user, onClose, onChanged, onEdit }) {
  const { data: c, error, reload } = useApiData(`/contracts/${id}`);
  const [dialog, setDialog] = useState(null);
  const [preview, setPreview] = useState(null); // hàm tải bản in đang xem trước (hợp đồng / biên bản) // "approve" | "reject" | "deposit" | "cancel" | "delete" | "submit"

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !dialog) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, dialog]);

  // Gọi API của một thao tác; thành công thì tải lại và báo trang cha
  const act =
    (request, { close = false } = {}) =>
    async (text) => {
      try {
        const r = await request(text);
        setDialog(null);
        onChanged(r.message);
        if (close) onClose();
        else reload();
        return null;
      } catch (err) {
        return err.message;
      }
    };

  const isAdmin = user.role === "ADMIN";
  const step = c ? flowIndex(c) : -1;
  const handedOver = c ? c.items.some((i) => i.status !== "PENDING") : false;
  // dialog = "remove:<id chi tiết>": đang xác nhận bỏ một máy chưa bàn giao
  const removingItem = c && dialog?.startsWith("remove:") ? c.items.find((i) => i.id === Number(dialog.slice(7))) : null;

  return createPortal(
    <>
      <div className="modal-backdrop" onMouseDown={onClose}>
        <div className="modal modal-xl" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
          <header className="modal-header">
            <div>
              <h2>{c ? `Hợp đồng ${c.contract_no}` : "Hợp đồng"}</h2>
              {c && (
                <p className="modal-subtitle">
                  <StatusBadge map={CONTRACT_STATUS} value={c.status} /> &nbsp;Lập bởi {c.created_by_name}
                </p>
              )}
            </div>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          </header>

          <div className="modal-body">
            {error && <div className="modal-error">{error}</div>}
            {!c && !error && <p className="text-muted">Đang tải…</p>}

            {c && (
              <>
                {step >= 0 && (
                  <div className="contract-flow">
                    {FLOW.map((f, i) => (
                      <span key={f.key} style={{ display: "contents" }}>
                        {i > 0 && <span className={`flow-line ${i <= step ? "done" : ""}`} />}
                        <span className={`flow-step ${i < step ? "done" : i === step ? "current" : ""}`}>
                          <span className="dot">{i < step ? "✓" : i + 1}</span>
                          {f.label}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {c.status === "REJECTED" && (
                  <div className="alert alert-danger">
                    <strong>Bị từ chối:</strong> {c.reject_reason}. Người lập sửa lại rồi gửi duyệt lần nữa.
                  </div>
                )}
                {c.status === "CANCELLED" && (
                  <div className="alert alert-danger">
                    <strong>Đã huỷ</strong> {c.cancelled_by_name ? `bởi ${c.cancelled_by_name}` : ""}
                    {c.cancelled_at ? ` lúc ${formatDateTime(c.cancelled_at)}` : ""}: {c.cancel_reason}
                    {c.deposit_refunded_at && `. Đã hoàn đủ tiền cọc ${formatMoney(c.deposit_amount)} cho khách.`}
                  </div>
                )}
                {c.status === "APPROVED" && !c.deposit_paid_at && (
                  <div className={`alert ${c.deposit_overdue ? "alert-danger" : "alert-warning"}`}>
                    {c.deposit_overdue
                      ? "Đã quá 3 ngày kể từ khi duyệt mà khách chưa đặt cọc. Quản lý có thể huỷ hợp đồng."
                      : "Chờ khách đặt cọc (hạn 3 ngày kể từ khi duyệt)."}
                  </div>
                )}
                {c.status === "PENDING_APPROVAL" && (
                  <div className={`alert ${c.waited_days >= 1 ? "alert-warning" : "alert-info"}`}>
                    {c.waited_days >= 1 ? `Đã chờ duyệt ${c.waited_days} ngày.` : "Vừa gửi duyệt, đang chờ Quản lý duyệt."}
                    {c.last_reminded_at && ` Đã nhắc duyệt lần gần nhất lúc ${formatDateTime(c.last_reminded_at)}.`}
                  </div>
                )}

                <div className="two-cols">
                  <div>
                    <dl className="info-grid">
                      <Info label="Khách hàng" value={`${c.customer.code} – ${c.customer.name}`} full />
                      <Info
                        label={c.customer.customer_type === "COMPANY" ? "Mã số thuế" : "Số CCCD"}
                        value={c.customer.id_number}
                      />
                      <Info label="Điện thoại" value={c.customer.phone} />
                      <Info label="Người đại diện" value={c.customer.representative} />
                      <Info label="Địa điểm nhận máy" value={c.delivery_address} full />
                      <Info label="Thời gian thuê" value={`${formatDate(c.start_date)} – ${formatDate(c.end_date)}`} />
                      <Info label="Hình thức tính giá" value={PRICING_TYPE[c.pricing_type]} />
                      <Info
                        label="Người duyệt"
                        value={c.approved_by_name || null}
                      />
                      <Info label="Ghi chú" value={c.note} full />
                    </dl>
                  </div>

                  <aside className="calc-box">
                    <h4>Giá trị hợp đồng</h4>
                    <table className="summary-table">
                      <tbody>
                        <tr>
                          <td>Tiền thuê</td>
                          <td>{formatMoney(c.subtotal)}</td>
                        </tr>
                        <tr>
                          <td>Chiết khấu ({Number(c.discount_rate)}%)</td>
                          <td>− {formatMoney(c.discount_amount)}</td>
                        </tr>
                        <tr>
                          <td>Vận chuyển</td>
                          <td>{formatMoney(c.transport_fee)}</td>
                        </tr>
                        <tr>
                          <td>VAT ({Number(c.vat_rate)}%)</td>
                          <td>{formatMoney(c.vat_amount)}</td>
                        </tr>
                        <tr className="total">
                          <td>Tổng cộng</td>
                          <td>{formatMoney(c.total_amount)}</td>
                        </tr>
                        <tr className="sub">
                          <td>Đã đặt cọc</td>
                          <td>{c.deposit_amount ? formatMoney(c.deposit_amount) : "Chưa"}</td>
                        </tr>
                        {c.deposit_paid_at && (
                          <tr className="sub">
                            <td>Ngày cọc</td>
                            <td>{formatDateTime(c.deposit_paid_at)}</td>
                          </tr>
                        )}
                        {c.deposit_refunded_at && (
                          <tr className="sub">
                            <td>Đã hoàn cọc</td>
                            <td>{formatDateTime(c.deposit_refunded_at)}</td>
                          </tr>
                        )}
                        {c.settlement && (
                          <>
                            <tr className="sub">
                              <td>Quyết toán: còn phải {c.settlement.amount_due < 0 ? "hoàn" : "thu"}</td>
                              <td>{formatMoney(Math.abs(c.settlement.amount_due))}</td>
                            </tr>
                            <tr className="sub">
                              <td>Thanh toán</td>
                              <td>
                                <StatusBadge map={PAYMENT_STATUS} value={c.settlement.payment_status} />
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </aside>
                </div>

                <h3 className="section-title">Thiết bị thuê</h3>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Máy</th>
                        <th className="align-right">Đơn giá</th>
                        <th className="align-right">{c.pricing_type === "DAY" ? "Số ngày" : "Số giờ"}</th>
                        <th className="align-right">Thành tiền</th>
                        <th>Tình trạng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.items.map((i) => (
                        <tr key={i.id}>
                          <td>
                            <span className="cell-main">
                              {i.code} – {i.name}
                            </span>
                            <span className="cell-sub">{i.category_name}</span>
                          </td>
                          <td className="align-right">{formatMoney(i.unit_price)}</td>
                          <td className="align-right">{Number(i.planned_duration)}</td>
                          <td className="align-right">
                            <strong>{formatMoney(i.amount)}</strong>
                          </td>
                          <td>
                            <StatusBadge map={DETAIL_STATUS} value={i.status} />
                            {isAdmin && c.status === "ACTIVE" && i.status === "PENDING" && (
                              <span className="cell-sub">
                                <button type="button" className="link-button" onClick={() => setDialog(`remove:${i.id}`)}>
                                  Bỏ máy khỏi hợp đồng
                                </button>
                              </span>
                            )}
                            {i.handover_no && (
                              <span className="cell-sub">
                                {i.handover_no} · {formatDate(i.handover_at)} · {formatNumber(i.handover_hours)} giờ máy{" "}
                                {i.handover_meter_photo && (
                                  <MeterPhotoThumb url={i.handover_meter_photo} title={`Đồng hồ giờ máy lúc bàn giao – ${i.handover_no}`} />
                                )}{" "}
                                <button type="button" className="link-button" onClick={() => setPreview(() => () => ticketDoc(id, "handover", i.handover_no))}>
                                  In biên bản
                                </button>
                              </span>
                            )}
                            {i.return_no && (
                              <span className="cell-sub">
                                {i.return_no} · {formatDate(i.returned_at)} · {formatNumber(i.return_hours)} giờ máy{" "}
                                {i.return_meter_photo && (
                                  <MeterPhotoThumb url={i.return_meter_photo} title={`Đồng hồ giờ máy lúc thu hồi – ${i.return_no}`} />
                                )}{" "}
                                <button type="button" className="link-button" onClick={() => setPreview(() => () => ticketDoc(id, "return", i.return_no))}>
                                  In biên bản
                                </button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Các nút xử lý theo trạng thái */}
                <div className="detail-actions">
                  {c.status === "DRAFT" && c.can_modify && (
                    <button className="btn btn-secondary" onClick={() => setDialog("delete")}>
                      Xoá nháp
                    </button>
                  )}
                  {["DRAFT", "REJECTED"].includes(c.status) && c.can_modify && (
                    <>
                      <button className="btn btn-secondary" onClick={() => onEdit(c)}>
                        Sửa hợp đồng
                      </button>
                      <button className="btn btn-primary" onClick={() => setDialog("submit")}>
                        Gửi duyệt
                      </button>
                    </>
                  )}
                  {isAdmin && ["PENDING_APPROVAL", "APPROVED"].includes(c.status) && !handedOver && (
                    <button className="btn btn-secondary" onClick={() => setDialog("cancel")}>
                      Huỷ hợp đồng
                    </button>
                  )}
                  {isAdmin && c.status === "PENDING_APPROVAL" && (
                    <>
                      <button className="btn btn-danger" onClick={() => setDialog("reject")}>
                        Từ chối
                      </button>
                      <button className="btn btn-primary" onClick={() => setDialog("approve")}>
                        Duyệt hợp đồng
                      </button>
                    </>
                  )}
                  {/* Nhân viên nhắc Quản lý duyệt (bấm lúc nào cũng được khi hợp đồng đang chờ duyệt) */}
                  {c.status === "PENDING_APPROVAL" && !isAdmin && (
                    <button
                      className="btn btn-accent"
                      title="Gửi thông báo nhắc Quản lý duyệt hợp đồng này"
                      onClick={() => setDialog("remind")}
                    >
                      Nhắc duyệt
                    </button>
                  )}
                  {c.status === "APPROVED" && !c.deposit_paid_at && (
                    <button className="btn btn-primary" onClick={() => setDialog("deposit")}>
                      Xác nhận đặt cọc
                    </button>
                  )}
                  {/* In hợp đồng: từ khi khách đã đặt cọc (kể cả sau khi quyết toán – in kèm biên bản quyết toán) */}
                  {c.deposit_paid_at && c.status !== "CANCELLED" && (
                    <button className="btn btn-primary" onClick={() => setPreview(() => () => contractDoc(id))} title="Xem trước rồi in / lưu PDF">
                      In hợp đồng{c.status === "SETTLED" ? " & quyết toán" : ""}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {dialog === "submit" && (
        <ConfirmDialog
          title="Gửi duyệt hợp đồng"
          message={`Gửi hợp đồng ${c.contract_no} cho Quản lý duyệt? Sau khi gửi sẽ không sửa được nữa.`}
          confirmLabel="Gửi duyệt"
          tone="primary"
          onConfirm={act(() => api.post(`/contracts/${id}/submit`))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "remind" && (
        <ConfirmDialog
          title="Nhắc duyệt hợp đồng"
          message={`Gửi thông báo nhắc Quản lý duyệt hợp đồng ${c.contract_no}${c.waited_days > 0 ? ` (đã chờ ${c.waited_days} ngày)` : ""}?`}
          confirmLabel="Gửi nhắc"
          tone="primary"
          onConfirm={act(() => api.post(`/contracts/${id}/remind`))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Xoá hợp đồng nháp"
          message={`Xoá hợp đồng nháp ${c.contract_no}? Thao tác này không thể hoàn tác.`}
          onConfirm={act(() => api.del(`/contracts/${id}`), { close: true })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "approve" && (
        <ConfirmDialog
          title="Duyệt hợp đồng"
          message={`Duyệt hợp đồng ${c.contract_no} – ${c.customer_name}, giá trị ${formatMoney(c.total_amount)}? Các máy tiếp tục được giữ chỗ cho hợp đồng này.`}
          confirmLabel="Duyệt"
          tone="primary"
          onConfirm={act(() => api.post(`/contracts/${id}/approve`))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "reject" && (
        <ConfirmDialog
          title="Từ chối hợp đồng"
          message={`Từ chối hợp đồng ${c.contract_no}. Người lập sẽ thấy lý do để sửa lại.`}
          confirmLabel="Từ chối"
          inputLabel="Lý do từ chối"
          onConfirm={act((reason) => api.post(`/contracts/${id}/reject`, { reason }))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "cancel" && (
        <ConfirmDialog
          title="Huỷ hợp đồng"
          message={
            `Huỷ hợp đồng ${c.contract_no}? Các máy đang giữ chỗ sẽ được trả về Sẵn sàng.` +
            (c.deposit_paid_at ? ` Khách đã đặt cọc: xác nhận huỷ đồng nghĩa ghi nhận đã hoàn đủ ${formatMoney(c.deposit_amount)} cho khách.` : "")
          }
          confirmLabel="Huỷ hợp đồng"
          inputLabel="Lý do huỷ"
          onConfirm={act((reason) => api.post(`/contracts/${id}/cancel`, { reason }))}
          onClose={() => setDialog(null)}
        />
      )}
      {removingItem && (
        <ConfirmDialog
          title="Bỏ máy khỏi hợp đồng"
          message={`Bỏ máy ${removingItem.code} khỏi hợp đồng ${c.contract_no}? Giá trị hợp đồng sẽ được tính lại, phần tiền cọc thừa (nếu có) xử lý khi quyết toán.`}
          confirmLabel="Bỏ máy"
          inputLabel="Lý do bỏ máy"
          onConfirm={act((reason) => api.post(`/contracts/${id}/items/${removingItem.id}/remove`, { reason }))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "deposit" && (
        <FormModal
          title="Xác nhận đặt cọc"
          subtitle={`${c.contract_no} – tổng giá trị ${formatMoney(c.total_amount)}`}
          size="md"
          fields={[
            {
              name: "deposit_amount",
              label: "Số tiền cọc (₫)",
              type: "money",
              required: true,
              full: true,
              hint: "Gợi ý: 30% giá trị hợp đồng.",
            },
            { name: "deposit_paid_at", label: "Thời điểm nhận cọc", type: "datetime-local", required: true, full: true },
          ]}
          initialValues={{
            deposit_amount: String(Math.round((c.total_amount * 0.3) / 100000) * 100000),
            deposit_paid_at: nowLocalISO(),
          }}
          submitLabel="Xác nhận & in hợp đồng"
          onSubmit={async (values) => {
            // Lưu cọc xong thì mở luôn bản xem trước hợp đồng để in
            const err = await act(() =>
              api.post(`/contracts/${id}/deposit`, { ...values, deposit_paid_at: values.deposit_paid_at.replace("T", " ") }),
            )();
            if (!err) setPreview(() => () => contractDoc(id));
            return err;
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {preview && <PrintPreview load={preview} onClose={() => setPreview(null)} />}
    </>,
    document.body,
  );
}

function Info({ label, value, full }) {
  return (
    <div className={`info-item ${full ? "full" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || value === 0 ? value : <span className="text-muted">—</span>}</dd>
    </div>
  );
}

export default ContractDetailModal;
