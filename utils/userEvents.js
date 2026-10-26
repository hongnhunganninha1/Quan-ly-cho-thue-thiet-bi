// Báo cho khung chính biết thông tin người dùng có thể đã đổi (VD: Quản lý sửa họ tên nhân viên,
// đổi vai trò tài khoản). Khung chính sẽ tải lại thông tin người đang đăng nhập để cập nhật tên, ảnh ở góc trên.
export const USER_CHANGED_EVENT = "app:user-changed";

export function notifyUserChanged() {
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}
