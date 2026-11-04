// Ảnh chụp đồng hồ giờ máy kèm phiếu bàn giao / phiếu thu hồi: lưu ở backend/uploads/meter.
// Ảnh là bằng chứng số giờ máy lúc giao và lúc nhận lại, giúp đối chiếu khi có tranh chấp.
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const HttpError = require("./httpError");

const METER_DIR = path.join(__dirname, "..", "uploads", "meter");
fs.mkdirSync(METER_DIR, { recursive: true });
const IMAGE_EXT = [".jpg", ".jpeg", ".png", ".webp"];

// prefix: "bg" (bàn giao) hoặc "th" (thu hồi)
function meterUpload(prefix) {
  return multer({
    storage: multer.diskStorage({
      destination: METER_DIR,
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
        cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // tối đa 5 MB (ảnh đã được thu nhỏ trên trình duyệt trước khi gửi)
    fileFilter: (req, file, cb) => {
      const ok = IMAGE_EXT.includes(path.extname(file.originalname).toLowerCase());
      cb(ok ? null : new HttpError(400, "Ảnh đồng hồ giờ máy chỉ nhận file JPG, PNG hoặc WEBP."), ok);
    },
  }).single("meter_photo");
}

// Đường dẫn lưu trong CSDL của file vừa tải lên
const meterPhotoUrl = (file) => (file ? `/uploads/meter/${file.filename}` : null);

// Xoá file vừa tải lên khi lập phiếu thất bại (để không còn ảnh rác)
function removeUploaded(file) {
  if (file) fs.unlink(path.join(METER_DIR, file.filename), () => {});
}

module.exports = { meterUpload, meterPhotoUrl, removeUploaded };
