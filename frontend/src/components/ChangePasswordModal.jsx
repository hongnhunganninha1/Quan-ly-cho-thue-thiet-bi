import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./ChangePasswordModal.css";
import iconShow from "../assets/login_show.png";
import iconHide from "../assets/login_invisible.png";

// Các điều kiện của mật khẩu mới (hiện thành danh sách để người dùng thấy đã đạt điều kiện nào)
const RULES = [
  { key: "length", label: "Ít nhất 8 ký tự", test: (p) => p.length >= 8 },
  { key: "upper", label: "Có chữ hoa (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { key: "lower", label: "Có chữ thường (a-z)", test: (p) => /[a-z]/.test(p) },
  { key: "digit", label: "Có chữ số (0-9)", test: (p) => /\d/.test(p) },
];

// Ô nhập mật khẩu có nút hiện / ẩn
function PasswordField({ id, label, value, onChange, autoFocus }) {
  const [show, setShow] = useState(false);

  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrapper">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete={id === "current-password" ? "current-password" : "new-password"}
        />
        <button
          type="button"
          className="show-password"
          onClick={() => setShow(!show)}
          aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        >
          <img src={show ? iconShow : iconHide} alt="" />
        </button>
      </div>
    </div>
  );
}

// Hộp thoại đổi mật khẩu.
// onSubmit(mật khẩu hiện tại, mật khẩu mới): gọi API, trả về chuỗi lỗi hoặc null nếu đổi thành công.
// Đổi thành công thì App sẽ đăng xuất và chuyển về màn đăng nhập, nên hộp thoại tự biến mất.
// forced = true: tài khoản mới được cấp, bắt buộc đổi mật khẩu lần đầu nên không cho đóng hộp thoại.
function ChangePasswordModal({ onSubmit, onClose, forced = false }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bấm phím Esc để đóng (trừ khi bắt buộc đổi mật khẩu)
  useEffect(() => {
    if (forced) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, forced]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Vui lòng nhập đủ cả ba ô.");
      return;
    }
    if (!RULES.every((rule) => rule.test(newPassword))) {
      setError("Mật khẩu mới chưa đạt đủ các điều kiện bên dưới.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Mật khẩu mới phải khác mật khẩu hiện tại.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Hai lần nhập mật khẩu mới không khớp.");
      return;
    }

    setError("");
    setSubmitting(true);
    const submitError = await onSubmit(currentPassword, newPassword);
    if (submitError) {
      setError(submitError);
      setSubmitting(false);
    }
  };

  // createPortal: vẽ hộp thoại trực tiếp vào <body> để nó luôn nằm trên menu và thanh đầu trang
  return createPortal(
    <div className="modal-backdrop" onMouseDown={forced ? undefined : onClose}>
      {/* Chặn sự kiện để bấm bên trong hộp thoại không làm đóng */}
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="change-password-title">Đổi mật khẩu</h2>
          {!forced && (
            <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
              ×
            </button>
          )}
        </header>

        <form className="modal-body" onSubmit={handleSubmit}>
          {forced && (
            <p className="modal-info">
              Đây là lần đăng nhập đầu tiên (hoặc mật khẩu vừa được cấp lại). Vui lòng đổi mật khẩu để tiếp tục.
            </p>
          )}
          <PasswordField
            id="current-password"
            label="Mật khẩu hiện tại"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoFocus
          />
          <PasswordField
            id="new-password"
            label="Mật khẩu mới"
            value={newPassword}
            onChange={setNewPassword}
          />

          {/* Danh sách điều kiện: đạt thì chuyển màu xanh */}
          <ul className="password-rules">
            {RULES.map((rule) => {
              const ok = rule.test(newPassword);
              return (
                <li key={rule.key} className={ok ? "ok" : ""}>
                  <span aria-hidden="true">{ok ? "✓" : "•"}</span> {rule.label}
                </li>
              );
            })}
          </ul>

          <PasswordField
            id="confirm-password"
            label="Nhập lại mật khẩu mới"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            {!forced && (
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Huỷ
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Đang lưu…" : "Lưu mật khẩu mới"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

export default ChangePasswordModal;
