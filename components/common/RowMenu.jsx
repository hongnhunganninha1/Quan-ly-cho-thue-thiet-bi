import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreVerticalIcon } from "./Icons";
import "./RowMenu.css";

// Nút ba chấm dọc ở cột Thao tác. Bấm vào thì hiện danh sách chức năng của dòng đó.
// items: [{ key, label, icon?, danger?, disabled?, title?, onClick() }]
// Danh sách được vẽ ra ngoài bảng (portal) để không bị khung cuộn của bảng che mất.
function RowMenu({ items, label = "Thao tác" }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  // Đặt vị trí danh sách ngay dưới nút (gần đáy màn hình thì bật lên trên)
  const place = useCallback(() => {
    if (!buttonRef.current || !menuRef.current) return;
    const b = buttonRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const below = b.bottom + 4 + m.height <= window.innerHeight - 8;
    setPos({
      top: below ? b.bottom + 4 : Math.max(8, b.top - 4 - m.height),
      left: Math.max(8, Math.min(b.right - m.width, window.innerWidth - m.width - 8)),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  // Bấm ra ngoài hoặc nhấn Esc thì đóng; cuộn trang / đổi kích thước cửa sổ thì danh sách đi theo nút
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, close, place]);

  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;
  const firstDanger = visible.findIndex((i) => i.danger);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`row-menu-button ${open ? "open" : ""}`}
        onMouseDown={(e) => e.preventDefault()} // không để bảng tự cuộn ngang khi nút nhận focus
        onClick={() => {
          setPos(null);
          setOpen((v) => !v);
        }}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVerticalIcon />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="row-menu"
            role="menu"
            style={pos ? { top: pos.top, left: pos.left } : { top: -9999, left: -9999 }}
          >
            {visible.map((item, i) => (
              <div key={item.key}>
                {i === firstDanger && i > 0 && <div className="row-menu-divider" />}
                <button
                  type="button"
                  role="menuitem"
                  className={`row-menu-item ${item.danger ? "danger" : ""}`}
                  disabled={item.disabled}
                  title={item.title || ""}
                  onClick={() => {
                    close();
                    item.onClick();
                  }}
                >
                  {/* luôn chừa chỗ cho icon để các dòng thẳng hàng */}
                  <span className="row-menu-icon">{item.icon}</span>
                  {item.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

export default RowMenu;
