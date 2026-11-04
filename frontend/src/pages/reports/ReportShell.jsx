import "../catalog/CatalogPage.css";
import "../equipment/Equipment.css";
import "../rent/Rent.css";
import "./Report.css";
import PrintSheet from "./PrintSheet";
import { todayISO } from "../../utils/format";
import { exportReportExcel } from "../../utils/exportExcel";
import { COMPANY, SIGNERS, rowNumbers } from "../../utils/reportInfo";

// Bỏ dấu tiếng Việt để đặt tên file: "Báo cáo công nợ" → "bao-cao-cong-no"
const slug = (text) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Khung chung của một báo cáo: tiêu đề, bộ lọc, nút xuất Excel và nội dung.
// user: người đang đăng nhập (ký "Người lập biểu").
// print: nội dung báo cáo theo mẫu – { formCode, period, unit, sections, notes, signerType, orientation }.
//   Dùng để xuất file Excel (cùng mẫu: thông tin công ty, tiêu đề, kỳ báo cáo, bảng, chỗ ký)
//   và để in khi người dùng bấm Ctrl + P (giao diện web được ẩn, chỉ in bản báo cáo).
function ReportShell({ title, user, filters, print, children }) {
  const exportFile = () => {
    exportReportExcel(
      {
        ...print,
        title,
        company: COMPANY,
        signers: SIGNERS[print.signerType || "operation"],
        preparedBy: user?.name,
        rowNumbers,
      },
      `${slug(title)}-${todayISO()}.xlsx`,
    );
  };

  return (
    <div className="catalog report">
      <div className="page-heading no-print">
        <div>
          <h1>{title}</h1>
        </div>
        <button
          className="btn btn-accent"
          onClick={exportFile}
          disabled={!print}
          title={print ? "Tải báo cáo về dạng file Excel (.xlsx)" : "Đang tải số liệu…"}
        >
          Xuất Excel
        </button>
      </div>

      {filters && <section className="catalog-card no-print">{filters}</section>}
      <div className="report-screen no-print">{children}</div>

      {print && <PrintSheet title={title} preparedBy={user?.name} {...print} />}
    </div>
  );
}

export default ReportShell;
