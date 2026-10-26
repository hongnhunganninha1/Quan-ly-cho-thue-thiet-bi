import "./ComingSoonPage.css";
import { findMenu } from "../data/menu";

// Trang tạm cho các mục menu chưa làm xong
function ComingSoonPage({ activeMenu }) {
  const { parent, child } = findMenu(activeMenu);

  return (
    <div className="content-empty">
      <strong>{child ? child.label : parent.label}</strong>
      Nội dung trang này đang được xây dựng.
    </div>
  );
}

export default ComingSoonPage;
