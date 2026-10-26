# Hệ thống quản lý cho thuê thiết bị – Comacpro

Ứng dụng web hỗ trợ doanh nghiệp cho thuê máy móc, thiết bị quản lý toàn bộ quy trình: từ hồ sơ thiết bị, khách hàng, hợp đồng thuê, bàn giao, thu hồi – quyết toán cho đến báo cáo thống kê.

## Chức năng chính

### Người dùng & phân quyền
- Đăng nhập, ghi nhớ đăng nhập, đổi mật khẩu, cập nhật hồ sơ và ảnh đại diện (có cắt ảnh).
- Hai vai trò: **Quản lý (ADMIN)** và **Nhân viên (STAFF)**; menu và trang được hiển thị theo quyền.
- Quản lý tài khoản (khóa / mở khóa, đặt lại mật khẩu) và quản lý nhân viên.

### Danh mục
- Quản lý khách hàng (kèm lịch sử thuê), bãi máy, loại thiết bị, hãng thiết bị.

### Thiết bị
- Hồ sơ thiết bị: thông tin, ảnh, giấy tờ đính kèm, trạng thái.
- **Nhận diện chữ trên tem máy (OCR)** bằng Tesseract.js ngay trên trình duyệt để gợi ý Model, số serial, số máy.
- Quản lý giá thuê và lịch sử thay đổi giá.
- Tra cứu lịch trống của thiết bị theo khoảng thời gian.

### Cho thuê
- Lập hợp đồng thuê, gửi duyệt, duyệt / từ chối, hủy hợp đồng, ghi nhận đặt cọc.
- Nhắc hạn hợp đồng.
- Bàn giao thiết bị cho khách.
- Thu hồi thiết bị, tính bồi thường và quyết toán, ghi nhận thanh toán.

### Báo cáo – Thống kê
- Báo cáo kiểm kê thiết bị, doanh thu, hiệu suất sử dụng, hợp đồng thuê, công nợ khách hàng.
- Biểu đồ trực quan, **xuất Excel (.xlsx)** và **in báo cáo** theo mẫu có thông tin doanh nghiệp.

### Khác
- Thông báo trong hệ thống (chuông thông báo, đánh dấu đã đọc).
- Giao diện tiếng Việt.

## Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 19, Vite |
| OCR | Tesseract.js |
| Giao tiếp backend | REST API (fetch), xác thực bằng JWT (Bearer token) |
| Kiểm tra mã nguồn | ESLint |

## Cấu trúc thư mục

```
├── public/              # favicon, dữ liệu OCR (tesseract)
├── src/
│   ├── api/             # hàm gọi API dùng chung (gắn token tự động)
│   ├── assets/          # hình ảnh, biểu tượng
│   ├── components/      # thành phần giao diện dùng chung (Header, Sidebar, Modal, Toast…)
│   ├── data/            # cấu hình menu, dữ liệu mẫu
│   ├── hooks/           # custom hooks
│   ├── layouts/         # bố cục trang chính
│   ├── pages/           # các màn hình theo module (catalog, equipment, rent, reports, users)
│   ├── utils/           # định dạng, xuất Excel, OCR, CSV…
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
└── vite.config.js
```

## Cài đặt và chạy

Yêu cầu: **Node.js 20** trở lên.

```bash
git clone https://github.com/hongnhunganninha1/Quan-ly-cho-thue-thiet-bi.git
cd Quan-ly-cho-thue-thiet-bi
npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`.

> Frontend gọi API qua đường dẫn `/api`, được chuyển tiếp tới backend tại `http://localhost:5000` (cấu hình trong `vite.config.js`). Cần chạy backend trước khi đăng nhập.

Build bản production:

```bash
npm run build
```

## Phạm Thị Hồng Nhung

- **Họ tên:** Phạm Thị Hồng Nhung
- **Email:** hongnhunganninha1@gmail.com