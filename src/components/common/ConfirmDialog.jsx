import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Hộp thoại xác nhận (xoá, khoá tài khoản, duyệt…).
// onConfirm(text): hàm async, trả về chuỗi lỗi nếu thất bại (hộp thoại giữ nguyên và hiện lỗi), null nếu xong.
// inputLabel: có thì hiện thêm ô nhập (VD: lý do từ chối), nội dung ô được truyền vào onConfirm.
// tone: "danger" (nút đỏ) hoặc "primary" (nút xanh).
function ConfirmDialog({ title, message, confirmLabel = "Xoá", onConfirm, onClose, inputLabel, inputRequired = true, tone = "danger" }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleConfirm = async () => {
    if (inputLabel && inputRequired && !text.trim()) {
      setError(`Vui lòng nhập ${inputLabel.toLowerCase()}.`);
      return;
    }
    setBusy(true);
    setError("");
    const err = await onConfirm(text.trim());
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="modal-body">
          <p className="confirm-message">{message}</p>
          {inputLabel && (
            <div className="form-field confirm-input">
              <label htmlFor="confirm-input">
                {inputLabel}
                {inputRequired && <span className="required-mark"> *</span>}
              </label>
              <textarea id="confirm-input" rows={3} maxLength={255} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            </div>
          )}
          {error && <div className="modal-error">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Huỷ
            </button>
            <button
              type="button"
              className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
              onClick={handleConfirm}
              disabled={busy}
              autoFocus={!inputLabel}
            >
              {busy ? "Đang xử lý…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmDialog;
