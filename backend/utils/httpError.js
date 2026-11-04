// Lỗi có kèm mã HTTP, ném ra trong route để errorHandler trả về cho frontend.
// Ví dụ: throw new HttpError(404, "Không tìm thấy khách hàng.");
class HttpError extends Error {
  constructor(status, message, field = null) {
    super(message);
    this.status = status;
    this.field = field; // tên ô bị lỗi (VD: serial_number) để giao diện tô đỏ đúng ô đó
  }
}

module.exports = HttpError;
