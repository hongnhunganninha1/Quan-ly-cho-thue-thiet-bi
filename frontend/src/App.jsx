import { useCallback, useEffect, useState } from "react";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import MainLayout from "./layouts/MainLayout";
import { api, clearToken, getToken, saveToken, setUnauthorizedHandler } from "./api/client";
import { timeAgo } from "./utils/format";
import { USER_CHANGED_EVENT } from "./utils/userEvents";

const NOTIFICATION_REFRESH_MS = 60 * 1000; // 1 phút tải lại thông báo một lần
const HISTORY_MS = 7 * 24 * 60 * 60 * 1000; // giữ thông báo đã qua 7 ngày

// Điểm vào của ứng dụng: chưa đăng nhập thì hiện màn đăng nhập,
// đăng nhập rồi thì hiện khung chính.
function App() {
  const [user, setUser] = useState(null); // null = chưa đăng nhập
  const [checking, setChecking] = useState(() => Boolean(getToken())); // đang kiểm tra phiên cũ
  const [loginNotice, setLoginNotice] = useState(""); // thông báo hiện ở màn đăng nhập
  const [notifications, setNotifications] = useState([]);

  const logout = useCallback((notice = "") => {
    api.post("/auth/logout").catch(() => {}); // xoá cookie xem file; lỗi mạng thì bỏ qua
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
      .catch((err) => {
        // Chỉ xoá token khi máy chủ báo token không còn hợp lệ; backend đang tắt thì giữ lại để tải lại trang là vào được
        if (err.status === 401) clearToken();
      })
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

  // Lịch sử: thông báo đã hiện được giữ lại 7 ngày, kể cả khi việc đã xử lý xong (máy chủ không trả về nữa)
  // → vẫn xem lại được, gắn nhãn "Đã xong". Cảnh báo theo ngày (quá hạn, cần bàn giao…) chỉ giữ bản mới nhất mỗi hợp đồng.
  const historyKey = user ? `kltn_notification_history_${user.id}` : null;
  const loadNotifications = useCallback(() => {
    api
      .get("/notifications")
      .then((list) => {
        const readIds = loadReadIds();
        // Chỉ giữ dấu "đã đọc" của các thông báo còn hiện, để dữ liệu lưu không phình to dần
        saveReadIds(new Set(list.map((n) => n.id).filter((id) => readIds.has(id))));
        const live = list.map((n) => ({ ...n, read: readIds.has(n.id) }));

        let history = {};
        try {
          history = JSON.parse(localStorage.getItem(historyKey) || "{}");
        } catch {
          history = {};
        }
        const now = Date.now();
        const group = (id) => id.split("-").slice(0, 2).join("-"); // loại + mã hợp đồng (bỏ phần ngày)
        live.forEach((n) => {
          history[n.id] = { id: n.id, title: n.title, message: n.message, createdAt: n.createdAt, target: n.target, seenAt: history[n.id]?.seenAt || now };
        });
        const liveIds = new Set(live.map((n) => n.id));
        const liveGroups = new Set(live.map((n) => group(n.id)));
        const past = Object.values(history)
          .filter((h) => !liveIds.has(h.id) && now - h.seenAt < HISTORY_MS)
          .sort((a, b) => b.seenAt - a.seenAt)
          .filter((h, i, arr) => !liveGroups.has(group(h.id)) && arr.findIndex((x) => group(x.id) === group(h.id)) === i);
        const keep = {};
        [...live, ...past].forEach((n) => (keep[n.id] = history[n.id]));
        try {
          localStorage.setItem(historyKey, JSON.stringify(keep));
        } catch {
          // trình duyệt chặn lưu trữ thì chỉ hiện thông báo hiện tại
        }
        setNotifications([...live, ...past.map((h) => ({ ...h, read: true, done: true }))]);
      })
      .catch(() => {}); // lỗi tải thông báo thì giữ danh sách cũ, không làm phiền người dùng
  }, [loadReadIds, saveReadIds, historyKey]);

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
  const readAllNotifications = () => markRead(notifications.filter((n) => !n.done).map((n) => n.id));

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
