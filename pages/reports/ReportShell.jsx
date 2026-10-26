import "../catalog/CatalogPage.css";
import "../equipment/Equipment.css";
import "../rent/Rent.css";
import "./Report.css";
import PrintSheet from "./PrintSheet";
import { todayISO } from "../../utils/format";

// Khung chung của một báo cáo: tiêu đề, bộ lọc, nút xuất PDF và nội dung.
// user: người đang đăng nhập (ký "Người lập biểu").
// print: nội dung bản in theo mẫu báo cáo (xem PrintSheet) – { formCode, period, unit, sections, notes, signerType, orientation }.
// Xuất PDF dùng chức năng in của trình duyệt: chọn máy in "Lưu dưới dạng PDF" (Save as PDF).
// Khi in, toàn bộ giao diện web bị ẩn, chỉ in bản báo cáo theo mẫu.
function ReportShell({ title, user, filters, canExport = true, print, children }) {
  const exportPdf = () => {
    const oldTitle = document.title;
    // Trình duyệt lấy tiêu đề trang làm tên file PDF gợi ý
    document.title = `${title} - ${todayISO()}`;
    window.addEventListener("afterprint", () => (document.title = oldTitle), { once: true });
    window.print();
  };

  return (
    <div className="catalog report">
      <div className="page-heading no-print">
        <div>
          <h1>{title}</h1>
        </div>
        {canExport && (
          <button className="btn btn-accent" onClick={exportPdf}>
            Xuất PDF
          </button>
        )}
      </div>

      {filters && <section className="catalog-card no-print">{filters}</section>}
      <div className="report-screen no-print">{children}</div>

      {print && <PrintSheet title={title} preparedBy={user?.name} {...print} />}
    </div>
  );
}

export default ReportShell;
