import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./Toast.css";

// Thông báo nhỏ góc dưới bên phải, tự ẩn sau vài giây.
// toast: { type: "success" | "error", message } hoặc null; onClose: hàm ẩn thông báo.
function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, toast.type === "error" ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return createPortal(
    <div className={`toast toast-${toast.type}`} role="status">
      <span className="toast-icon" aria-hidden="true">{toast.type === "error" ? "!" : "✓"}</span>
      <span className="toast-message">{toast.message}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Đóng thông báo">
        ×
      </button>
    </div>,
    document.body
  );
}

export default Toast;
