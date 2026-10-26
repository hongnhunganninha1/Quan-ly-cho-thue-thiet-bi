// Danh sách menu bên trái (theo các module của hệ thống).
// Mục có "children" sẽ có mũi tên để xổ ra các module con.
// Mục có "roles" thì chỉ những vai trò đó mới thấy (ADMIN = Quản lý, STAFF = Nhân viên).
// Thêm, bớt hoặc đổi tên module chỉ cần sửa ở file này.

import iconHome from "../assets/home.png";
import iconCategory from "../assets/category.png";
import iconEquipment from "../assets/equipment.png";
import iconRent from "../assets/rent.png";
import iconReport from "../assets/report.png";
import iconUser from "../assets/user.svg";

export const MENU = [
  { key: "home", label: "Trang chủ", icon: iconHome },
  {
    key: "user",
    label: "Người dùng",
    icon: iconUser,
    roles: ["ADMIN"],
    children: [
      { key: "user-account", label: "Quản lý tài khoản" },
      { key: "user-employee", label: "Quản lý nhân viên" },
    ],
  },
  {
    key: "category",
    label: "Danh mục",
    icon: iconCategory,
    children: [
      { key: "category-customer", label: "Quản lý khách hàng" },
      { key: "category-warehouse", label: "Quản lý bãi máy", roles: ["ADMIN"] },
      { key: "category-type", label: "Quản lý loại thiết bị", roles: ["ADMIN"] },
      { key: "category-brand", label: "Quản lý hãng thiết bị", roles: ["ADMIN"] },
    ],
  },
  {
    key: "equipment",
    label: "Thiết bị",
    icon: iconEquipment,
    children: [
      { key: "equipment-profile", label: "Quản lý hồ sơ thiết bị" },
      { key: "equipment-price", label: "Quản lý giá thuê", roles: ["ADMIN"] },
      { key: "equipment-schedule", label: "Tra cứu lịch trống" },
    ],
  },
  {
    key: "rent",
    label: "Cho thuê",
    icon: iconRent,
    children: [
      { key: "rent-contract", label: "Quản lý hợp đồng" },
      { key: "rent-approve", label: "Duyệt hợp đồng", roles: ["ADMIN"] },
      { key: "rent-handover", label: "Quản lý bàn giao" },
      { key: "rent-return", label: "Quản lý thu hồi, bồi thường & quyết toán" },
    ],
  },
  {
    key: "report",
    label: "Báo cáo - Thống kê",
    icon: iconReport,
    children: [
      { key: "report-equipment", label: "Báo cáo kiểm kê thiết bị" },
      { key: "report-revenue", label: "Báo cáo doanh thu", roles: ["ADMIN"] },
      { key: "report-utilization", label: "Báo cáo hiệu suất sử dụng", roles: ["ADMIN"] },
      { key: "report-contract", label: "Báo cáo hợp đồng thuê", roles: ["ADMIN"] },
      { key: "report-debt", label: "Báo cáo công nợ khách hàng", roles: ["ADMIN"] },
    ],
  },
];

// Vai trò role có được dùng mục menu này không
export function canAccess(item, role) {
  return !item.roles || item.roles.includes(role);
}

// Menu đã lọc theo vai trò của người đăng nhập
export function menuForRole(role) {
  return MENU.filter((item) => canAccess(item, role)).map((item) =>
    item.children ? { ...item, children: item.children.filter((c) => canAccess(c, role)) } : item
  );
}

// Trang key có được mở với vai trò role không (kiểm tra cả module cha)
export function canOpen(key, role) {
  const { parent, child } = findMenu(key);
  return canAccess(parent, role) && (!child || canAccess(child, role));
}

// Tìm mục đang chọn: trả về module cha và module con (nếu có)
export function findMenu(key) {
  for (const parent of MENU) {
    if (parent.key === key) return { parent, child: null };
    const child = parent.children?.find((c) => c.key === key);
    if (child) return { parent, child };
  }
  return { parent: MENU[0], child: null };
}
