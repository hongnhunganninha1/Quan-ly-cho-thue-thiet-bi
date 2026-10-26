import { useCallback, useEffect, useState } from "react";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import MainLayout from "./layouts/MainLayout";
import { api, clearToken, getToken, saveToken, setUnauthorizedHandler } from "./api/client";
import { timeAgo } from "./utils/format";
import { USER_CHANGED_EVENT } from "./utils/userEvents";

const NOTIFICATION_REFRESH_MS = 60 * 1000; // 1 phút tải lại thông báo một lần

// Điểm vào của ứng dụng: chưa đăng nhập thì hiện màn đăng nhập,
// đăng nhập rồi thì hiện khung chính.
function App() {
  const [user, setUser] = useState(null); // null = chưa đăng nhập
  const [checking, setChecking] = useState(() => Boolean(getToken())); // đang kiểm tra phiên cũ
  const [loginNotice, setLoginNotice] = useState(""); // thông báo hiện ở màn đăng nhập
  const [notifications, setNotifications] = useState([]);

  const logout = useCallback((notice = "") => {
    clearToken();
    setUser(null);
    setNotifications([]);
    setLoginNotice(notice);
  }, []);

  // Token hết hạn hoặc tài khoản bị khoá giữa chừng thì quay về màn đăng nhập
  useEffect(() => {
    setUnauthorizedHandler((message) => logout(message || "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại."));
  }, [logout]);

  // Tải lại trang (F5) mà vẫn còn token thì lấy lại thông tin người dùng, không phải đăng nhập lại
  useEffect(() => {
    if (!getToken()) return;
    api
      .get("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  // Thông tin người dùng có thể đã đổi ở màn khác (sửa họ tên nhân viên, đổi vai trò…):
  // tải lại để tên, ảnh, vai trò ở góc trên luôn đúng.
  const loggedIn = Boolean(user);
  useEffect(() => {
    if (!loggedIn) return;
    const refresh = () =>
      api
        .get("/auth/me")
        .then((data) => setUser(data.user))
        .catch(() => {});
    window.addEventListener(USER_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(USER_CHANGED_EVENT, refresh);
  }, [loggedIn]);

  // ----- Thông báo -----

  const loadNotifications = useCallback(() => {
    api
      .get("/notifications")
      .then((list) => setNotifications(list))
      .catch(() => {}); // lỗi tải thông báo thì giữ danh sách cũ, không làm phiền người dùng
  }, []);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const timer = setInterval(loadNotifications, NOTIFICATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [user, loadNotifications]);

  const readNotification = (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    api.patch(`/notifications/${id}/read`).catch(loadNotifications);
  };

  const readAllNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.patch("/notifications/read-all").catch(loadNotifications);
  };

  // ----- Đăng nhập / đổi mật khẩu -----

  // Trả về chuỗi lỗi, hoặc null nếu đăng nhập thành công
  const handleLogin = async (username, password, remember) => {
    try {
      const data = await api.post("/auth/login", { username, password, remember });
      saveToken(data.token, remember);
      setLoginNotice("");
      setUser(data.user);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  // Trả về chuỗi lỗi, hoặc null nếu đổi thành công.
  // Đổi xong thì đăng xuất ngay, bắt đăng nhập lại bằng mật khẩu mới.
  const handleChangePassword = async (currentPassword, newPassword) => {
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      logout("Đổi mật khẩu thành công. Vui lòng đăng nhập lại bằng mật khẩu mới.");
      return null;
    } catch (err) {
      return err.message;
    }
  };

  if (checking) {
    return <div className="app-loading">Đang tải…</div>;
  }

  if (!user) {
    return <LoginPage notice={loginNotice} onLogin={handleLogin} />;
  }

  return (
    <MainLayout
      user={user}
      onLogout={() => logout()}
      onChangePassword={handleChangePassword}
      onUserChange={(patch) => setUser((u) => ({ ...u, ...patch }))}
      notifications={notifications.map((n) => ({ ...n, time: timeAgo(n.createdAt) }))}
      onReadNotification={readNotification}
      onReadAllNotifications={readAllNotifications}
    />
  );
}

export default App;
