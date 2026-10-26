import "./ComingSoonPage.css";
import { findMenu } from "../data/menu";

// Hiện khi người dùng mở một trang mà vai trò của họ không được dùng
function NoPermissionPage({ activeMenu }) {
  const { parent, child } = findMenu(activeMenu);

  return (
    <div className="content-empty">
      <strong>{child ? child.label : parent.label}</strong>
      Bạn không có quyền truy cập chức năng này. Vui lòng liên hệ Quản lý nếu cần.
    </div>
  );
}

export default NoPermissionPage;
