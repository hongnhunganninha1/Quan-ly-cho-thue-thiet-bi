// Nơi lưu file tải lên (ảnh thiết bị, giấy tờ, ảnh đại diện, ảnh đồng hồ giờ máy).
// - Chạy ở máy cá nhân: lưu trong backend/uploads như cũ, đường dẫn dạng /uploads/<thư mục>/<tên file>.
// - Khi deploy lên Vercel (ổ đĩa chỉ đọc): file tạm ghi vào /tmp rồi chuyển lên Vercel Blob
//   (khi có biến môi trường BLOB_READ_WRITE_TOKEN), đường dẫn lưu trong CSDL là địa chỉ https của Blob.
const os = require("os");
const path = require("path");
const fs = require("fs");

const LOCAL_ROOT = path.join(__dirname, "..", "uploads");
const UPLOAD_ROOT = process.env.VERCEL ? path.join(os.tmpdir(), "uploads") : LOCAL_ROOT;
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

// Thư mục multer ghi file vừa tải lên
function uploadDir(sub) {
  const dir = path.join(UPLOAD_ROOT, sub);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Trả về đường dẫn lưu vào CSDL cho file multer vừa nhận
async function publishUpload(file, sub) {
  if (!file) return null;
  if (!useBlob()) return `/uploads/${sub}/${file.filename}`;
  const { put } = require("@vercel/blob");
  const blob = await put(`${sub}/${file.filename}`, fs.readFileSync(file.path), {
    access: "public",
    contentType: file.mimetype,
    addRandomSuffix: true,
  });
  fs.unlink(file.path, () => {});
  return blob.url;
}

// Xoá file đã lưu (khi xoá bản ghi / thay ảnh mới). Không chờ, lỗi thì bỏ qua.
function removeStored(url) {
  if (!url) return;
  if (/^https?:\/\//.test(url)) {
    if (useBlob()) require("@vercel/blob").del(url).catch(() => {});
    return;
  }
  const m = url.match(/^\/uploads\/([\w-]+)\/([^/]+)$/);
  if (m) fs.unlink(path.join(UPLOAD_ROOT, m[1], m[2]), () => {});
}

module.exports = { LOCAL_ROOT, uploadDir, publishUpload, removeStored };
