import { useState } from "react";
import "./NotificationBell.css";
import useClickOutside from "../hooks/useClickOutside";

// Icon vẽ bằng SVG để không cần thêm file ảnh
function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.500 7.500 2.500 7.500h-17S6 15 6 9z" />
      <path d="M10 20a2.200 2.200 0 0 0 4 0" />
    </svg>
  );
}

function CheckAllIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12.500l4.500 4.500L16 7.500" />
      <path d="M11 16l1.500 1.500L22 8" />
    </svg>
  );
}

// Chuông thông báo trên thanh đầu trang.
// notifications: [{ id, title, message, time, read, target }]
// onRead(id): đánh dấu một thông báo đã đọc; onReadAll(): đánh dấu tất cả đã đọc;
// onNavigate(key): mở trang liên quan của thông báo (nếu có target).
function NotificationBell({ notifications, onRead, onReadAll, onNavigate }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(open, () => setOpen(false));

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleItemClick = (item) => {
    if (!item.read) onRead(item.id);
    if (item.target) {
      onNavigate(item.target);
      setOpen(false);
    }
  };

  return (
    <div className="notification" ref={ref}>
      <button
        className="notification-button"
        onClick={() => setOpen(!open)}
        aria-label={`Thông báo, ${unreadCount} chưa đọc`}
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <header className="notification-header">
            <strong>Thông báo</strong>
            <button
              className="notification-read-all"
              onClick={onReadAll}
              disabled={unreadCount === 0}
              title="Đánh dấu đã đọc tất cả"
              aria-label="Đánh dấu đã đọc tất cả"
            >
              <CheckAllIcon />
            </button>
          </header>

          {notifications.length === 0 ? (
            <p className="notification-empty">Chưa có thông báo nào.</p>
          ) : (
            <ul className="notification-list">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    className={`notification-item ${item.read ? "" : "unread"}`}
                    onClick={() => handleItemClick(item)}
                  >
                    <span className="notification-dot" aria-hidden="true"></span>
                    <span className="notification-text">
                      <strong>{item.title}</strong>
                      {item.message && <span>{item.message}</span>}
                      <small>{item.time}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
