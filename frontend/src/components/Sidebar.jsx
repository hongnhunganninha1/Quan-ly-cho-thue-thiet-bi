import { useState } from "react";
import logoFull from "../assets/logo_full.png"; // biểu tượng + chữ COMACPRO trên một dòng
import logoMark from "../assets/logo_mark.png"; // chỉ biểu tượng, dùng khi menu thu gọn
import { findMenu, menuForRole } from "../data/menu";

// Icon nút thu gọn / mở rộng: khung chữ nhật bo góc có vạch chia cột bên trái
function SidebarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.500" width="18" height="15" rx="3" />
      <path d="M9 4.500v15" />
    </svg>
  );
}

// Menu bên trái. activeMenu: key của trang đang mở; onSelect: hàm gọi khi chọn trang;
// role: vai trò người đăng nhập, dùng để ẩn các mục không có quyền.
function Sidebar({ activeMenu, onSelect, collapsed, onToggle, role }) {
  const [openGroups, setOpenGroups] = useState([]); // các module cha đang xổ ra
  const { parent: currentParent } = findMenu(activeMenu);
  const menu = menuForRole(role);

  // Bấm vào module cha: có module con thì xổ ra / thu lại, không có thì mở trang luôn
  const handleParentClick = (item) => {
    if (!item.children) {
      onSelect(item.key);
      return;
    }
    if (collapsed) {
      // Menu đang thu gọn: mở rộng ra để thấy các module con
      onToggle();
      setOpenGroups((prev) => (prev.includes(item.key) ? prev : [...prev, item.key]));
      return;
    }
    setOpenGroups((prev) =>
      prev.includes(item.key) ? prev.filter((k) => k !== item.key) : [...prev, item.key]
    );
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        {/* Mở rộng: logo kèm tên công ty. Thu gọn: chỉ còn biểu tượng. */}
        <img
          src={collapsed ? logoMark : logoFull}
          alt="COMACPRO"
          className={collapsed ? "sidebar-logo sidebar-logo-mark" : "sidebar-logo"}
        />
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Thu gọn / mở rộng menu">
          <SidebarIcon />
        </button>
      </div>

      <nav className="sidebar-menu">
        {menu.map((item) => {
          const isOpen = openGroups.includes(item.key);
          const isCurrent = currentParent.key === item.key;
          return (
            <div key={item.key} className="menu-group">
              <button
                className={`menu-item ${activeMenu === item.key ? "active" : ""} ${
                  isCurrent && item.children ? "current" : ""
                }`}
                onClick={() => handleParentClick(item)}
                title={item.label}
                aria-expanded={item.children ? isOpen : undefined}
              >
                <img src={item.icon} alt="" className="menu-icon" />
                <span>{item.label}</span>
                {item.children && <span className={`menu-arrow ${isOpen ? "open" : ""}`}>▾</span>}
              </button>

              {item.children && isOpen && (
                <div className="submenu">
                  {item.children.map((child) => (
                    <button
                      key={child.key}
                      className={`submenu-item ${activeMenu === child.key ? "active" : ""}`}
                      onClick={() => onSelect(child.key)}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
