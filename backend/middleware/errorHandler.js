// Bắt mọi lỗi phát sinh trong các route và trả về JSON { message } cho frontend.
// Lỗi của MySQL được đổi sang câu thông báo tiếng Việt dễ hiểu.

// Tên hiển thị của các cột UNIQUE, dùng khi bị trùng dữ liệu
const UNIQUE_LABELS = {
  code: "Mã",
  name: "Tên",
  id_number: "Số CCCD / MST",
  email: "Email",
  serial_number: "Số serial",
  engine_number: "Số máy",
  contract_no: "Số hợp đồng",
};

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Lỗi do chính mình ném ra (HttpError)
  if (err.status) {
    return res.status(err.status).json({ message: err.message, field: err.field || undefined });
  }

  // Body gửi lên không phải JSON hợp lệ
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Dữ liệu gửi lên không hợp lệ." });
  }

  switch (err.code) {
    case "LIMIT_FILE_SIZE":
      return res.status(400).json({ message: "File quá lớn (giấy tờ tối đa 10 MB, ảnh tối đa 5 MB)." });
    case "ER_DUP_ENTRY": {
      // Thông báo gốc dạng: Duplicate entry 'KH0001' for key 'customers.code'
      const key = /for key '(?:[\w]+\.)?(\w+)'/.exec(err.sqlMessage || "")?.[1];
      const label = UNIQUE_LABELS[key] || "Dữ liệu";
      return res.status(409).json({ message: `${label} này đã tồn tại, vui lòng nhập giá trị khác.` });
    }
    case "ER_ROW_IS_REFERENCED_2":
      return res.status(409).json({ message: "Không thể xoá vì dữ liệu này đang được sử dụng ở nơi khác." });
    case "ER_NO_REFERENCED_ROW_2":
      return res.status(400).json({ message: "Dữ liệu liên kết không tồn tại." });
    case "ER_CHECK_CONSTRAINT_VIOLATED":
      return res.status(400).json({ message: "Dữ liệu không thoả điều kiện ràng buộc của hệ thống." });
    case "ER_DATA_TOO_LONG":
      return res.status(400).json({ message: "Có trường nhập quá dài so với cho phép." });
    case "ECONNREFUSED":
    case "ER_ACCESS_DENIED_ERROR":
    case "ER_BAD_DB_ERROR":
      console.error("Lỗi kết nối MySQL:", err.message);
      return res.status(500).json({ message: "Không kết nối được cơ sở dữ liệu. Kiểm tra lại MySQL và file .env." });
    default:
      console.error(err);
      return res.status(500).json({ message: "Lỗi hệ thống, vui lòng thử lại sau." });
  }
}

module.exports = errorHandler;
