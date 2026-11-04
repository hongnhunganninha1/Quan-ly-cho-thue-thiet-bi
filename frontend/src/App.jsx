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
  // Danh sách thông báo do máy chủ tính từ hợp đồng (không có bảng thông báo trong CSDL).
  // Thông báo nào đã đọc thì trình duyệt tự nhớ theo từng tài khoản (localStorage).
  const readKey = user ? `kltn_read_notifications_${user.id}` : null;
  const loadReadIds = useCallback(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(readKey) || "[]"));
    } catch {
      return new Set();
    }
  }, [readKey]);
  const saveReadIds = useCallback(
    (ids) => {
      try {
        localStorage.setItem(readKey, JSON.stringify([...ids]));
      } catch {
        // trình duyệt chặn lưu trữ thì chỉ nhớ trong phiên này
      }
    },
    [readKey]
  );

  const loadNotifications = useCallback(() => {
    api
      .get("/notifications")
      .then((list) => {
        const readIds = loadReadIds();
        // Chỉ giữ dấu "đã đọc" của các thông báo còn hiện, để dữ liệu lưu không phình to dần
        saveReadIds(new Set(list.map((n) => n.id).filter((id) => readIds.has(id))));
        setNotifications(list.map((n) => ({ ...n, read: readIds.has(n.id) })));
      })
      .catch(() => {}); // lỗi tải thông báo thì giữ danh sách cũ, không làm phiền người dùng
  }, [loadReadIds, saveReadIds]);

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    const timer = setInterval(loadNotifications, NOTIFICATION_REFRESH_MS);
    return () => clearInterval(timer);
  }, [user, loadNotifications]);

  const markRead = (ids) => {
    const readIds = loadReadIds();
    ids.forEach((id) => readIds.add(id));
    saveReadIds(readIds);
    setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
  };
  const readNotification = (id) => markRead([id]);
  const readAllNotifications = () => markRead(notifications.map((n) => n.id));

  // ----- Đăng nhập / đổi mật khẩu -----

  // Trả về chuỗi lỗi, hoặc null nếu đăng nhập thành công
  const handleLogin = async (email, password, remember) => {
    try {
      const data = await api.post("/auth/login", { email, password, remember });
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
