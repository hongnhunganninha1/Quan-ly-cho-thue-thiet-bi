import { useState } from "react";
import ChangePasswordModal from "./ChangePasswordModal";
import ProfileModal from "./ProfileModal";
import UserAvatar from "./common/UserAvatar";
import NotificationBell from "./NotificationBell";
import useClickOutside from "../hooks/useClickOutside";

// Thanh đầu trang: chuông thông báo và thông tin người dùng nằm bên phải
function Header({
  user,
  onLogout,
  onChangePassword,
  onUserChange,
  onNavigate,
  notifications,
  onReadNotification,
  onReadAllNotifications,
}) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  // Tài khoản phải đổi mật khẩu lần đầu thì mở sẵn hộp thoại đổi mật khẩu
  const [showChangePassword, setShowChangePassword] = useState(user.mustChangePassword);
  const userMenuRef = useClickOutside(showUserMenu, () => setShowUserMenu(false));

  return (
    <header className="dashboard-header">
      <NotificationBell
        notifications={notifications}
        onRead={onReadNotification}
        onReadAll={onReadAllNotifications}
        onNavigate={onNavigate}
      />

      <div className="user-menu-wrapper" ref={userMenuRef}>
        <button className="user-info" onClick={() => setShowUserMenu(!showUserMenu)}>
          <UserAvatar name={user.name} url={user.avatarUrl} />
          <div className="user-name">
            <strong>{user.name}</strong>
            <span>{user.roleName}</span>
          </div>
          <span className={`user-arrow ${showUserMenu ? "open" : ""}`}>▼</span>
        </button>

        {showUserMenu && (
          <div className="user-dropdown">
            <button
              className="dropdown-item"
              onClick={() => {
                setShowUserMenu(false);
                setShowProfile(true);
              }}
            >
              Hồ sơ cá nhân
            </button>
            <button
              className="dropdown-item"
              onClick={() => {
                setShowUserMenu(false);
                setShowChangePassword(true);
              }}
            >
              Đổi mật khẩu
            </button>
            <div className="dropdown-divider"></div>
            <button className="dropdown-item logout-item" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        )}
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} onSaved={onUserChange} />}

      {showChangePassword && (
        <ChangePasswordModal
          forced={user.mustChangePassword}
          onSubmit={onChangePassword}
          onClose={() => setShowChangePassword(false)}
        />
      )}
    </header>
  );
}

export default Header;
