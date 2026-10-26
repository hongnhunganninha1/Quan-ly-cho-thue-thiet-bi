import { useState } from "react";
import "./LoginPage.css";
import logo from "../assets/logo.png";
import iconShow from "../assets/login_show.png";
import iconHide from "../assets/login_invisible.png";
import Footer from "../components/Footer";

// Màn đăng nhập.
// onLogin(tài khoản, mật khẩu, ghi nhớ): gọi API đăng nhập, trả về chuỗi lỗi hoặc null nếu thành công;
// notice: thông báo hiện phía trên form (ví dụ sau khi đổi mật khẩu, hết phiên đăng nhập).
function LoginPage({ notice, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); // bấm Enter cũng đăng nhập được, không tải lại trang
    setInfo("");

    if (!username.trim() || !password) {
      setError("Vui lòng nhập tài khoản và mật khẩu.");
      return;
    }

    setSubmitting(true);
    const loginError = await onLogin(username.trim(), password, remember);
    // Đăng nhập thành công thì màn này biến mất, không cần cập nhật gì thêm
    if (loginError) {
      setError(loginError);
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      {/* Lớp nền */}
      <div className="background-overlay"></div>

      {/* Nội dung chính */}
      <div className="login-container">
        <div className="login-header">
          <h1>HỆ THỐNG QUẢN LÝ CHO THUÊ THIẾT BỊ</h1>
          <p>Đăng nhập để tiếp tục</p>
        </div>

        {/* Hộp đăng nhập */}
        <form className="login-box" onSubmit={handleSubmit}>
          <img src={logo} alt="COMACPRO" className="login-logo" />
          <h2>Đăng nhập</h2>

          {/* Thông báo (ví dụ: vừa đổi mật khẩu xong) */}
          {notice && <div className="login-notice">{notice}</div>}

          {/* Tài khoản */}
          <div className="form-group">
            <label htmlFor="username">Tài khoản</label>
            <input
              id="username"
              type="text"
              placeholder="Nhập tài khoản"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* Mật khẩu */}
          <div className="form-group">
            <label htmlFor="password">Mật khẩu</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="show-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                <img src={showPassword ? iconShow : iconHide} alt="" />
              </button>
            </div>
          </div>

          {/* Thông báo lỗi */}
          {error && <div className="login-error">{error}</div>}
          {info && <div className="login-notice">{info}</div>}

          {/* Ghi nhớ + quên mật khẩu */}
          <div className="login-options">
            <label className="remember-me">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>
            <button
              className="forgot-password"
              type="button"
              onClick={() => {
                setError("");
                setInfo("Vui lòng liên hệ Quản lý để được cấp lại mật khẩu.");
              }}
            >
              Quên mật khẩu?
            </button>
          </div>

          {/* Nút đăng nhập */}
          <button className="login-button" type="submit" disabled={submitting}>
            {submitting ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>
      </div>

      <Footer className="login-footer" />
    </div>
  );
}

export default LoginPage;
