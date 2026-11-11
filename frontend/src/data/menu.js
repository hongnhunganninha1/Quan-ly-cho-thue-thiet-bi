// Danh sách menu bên trái.
// Mục có "children" sẽ có mũi tên để xổ ra các module con.
// Mục có "roles" thì chỉ những vai trò đó mới thấy (ADMIN = Quản lý, STAFF = Nhân viên).
// Mục có "directIfSingle": vai trò chỉ thấy đúng 1 module con thì không xổ menu, bấm là mở luôn module con đó.
// Thêm, bớt hoặc đổi tên module chỉ cần sửa ở file này.

import iconHome from "../assets/home.png";
import iconCategory from "../assets/category.png";
import iconEquipment from "../assets/equipment.png";
import iconRent from "../assets/rent.png";
import iconReport from "../assets/report.png";
import iconUser from "../assets/user.svg";

export const MENU = [
  { key: "home", label: "Tổng quan", icon: iconHome },
  {
    key: "user",
    label: "Người dùng",
    icon: iconUser,
    roles: ["ADMIN"],
    children: [
      { key: "user-employee", label: "Nhân viên" },
      { key: "user-account", label: "Tài khoản" },
    ],
  },
  {
    key: "category",
    label: "Danh mục",
    icon: iconCategory,
    children: [
      { key: "category-customer", label: "Khách hàng" },
      { key: "category-warehouse", label: "Bãi máy", roles: ["ADMIN"] },
      { key: "category-type", label: "Loại thiết bị", roles: ["ADMIN"] },
      { key: "category-brand", label: "Hãng thiết bị", roles: ["ADMIN"] },
    ],
  },
  {
    key: "equipment",
    label: "Thiết bị",
    icon: iconEquipment,
    children: [
      { key: "equipment-profile", label: "Danh sách thiết bị" },
      { key: "equipment-price", label: "Giá thuê", roles: ["ADMIN"] },
      { key: "equipment-schedule", label: "Lịch trống" },
    ],
  },
  {
    key: "rent",
    label: "Cho thuê",
    icon: iconRent,
    children: [
      { key: "rent-contract", label: "Hợp đồng thuê" },
      { key: "rent-handover", label: "Bàn giao máy" },
      { key: "rent-return", label: "Thu hồi máy" },
    ],
  },
  {
    key: "report",
    label: "Báo cáo - Thống kê",
    icon: iconReport,
    directIfSingle: true, // vai trò chỉ thấy 1 báo cáo (Nhân viên: Kiểm kê thiết bị) thì bấm là mở luôn, không xổ menu
    children: [
      { key: "report-equipment", label: "Kiểm kê thiết bị" },
      { key: "report-revenue", label: "Doanh thu", roles: ["ADMIN"] },
      { key: "report-utilization", label: "Hiệu suất thiết bị", roles: ["ADMIN"] },
      { key: "report-contract", label: "Hợp đồng thuê", roles: ["ADMIN"] },
      { key: "report-debt", label: "Công nợ", roles: ["ADMIN"] },
    ],
  },
];

// Vai trò role có được dùng mục menu này không
export function canAccess(item, role) {
  return !item.roles || item.roles.includes(role);
}

// Menu đã lọc theo vai trò của người đăng nhập.
// Module có directIfSingle mà vai trò này chỉ còn 1 module con → hiện thành 1 mục, bấm là mở thẳng module con đó
export function menuForRole(role) {
  return MENU.filter((item) => canAccess(item, role)).map((item) => {
    if (!item.children) return item;
    const children = item.children.filter((c) => canAccess(c, role));
    if (item.directIfSingle && children.length === 1) return { ...item, key: children[0].key, children: undefined };
    return { ...item, children };
  });
}

// Trang key có được mở với vai trò role không (kiểm tra cả module cha).
// key có thể kèm tham số sau dấu ":" (VD "rent-contract:PENDING_APPROVAL" = mở Hợp đồng ở tab Chờ duyệt)
export function canOpen(key, role) {
  key = String(key).split(":")[0];
  const { parent, child } = findMenu(key);
  return canAccess(parent, role) && (!child || canAccess(child, role));
}

// Tìm mục đang chọn: trả về module cha và module con (nếu có)
export function findMenu(key) {
  key = String(key).split(":")[0];
  for (const parent of MENU) {
    if (parent.key === key) return { parent, child: null };
    const child = parent.children?.find((c) => c.key === key);
    if (child) return { parent, child };
  }
  return { parent: MENU[0], child: null };
}
