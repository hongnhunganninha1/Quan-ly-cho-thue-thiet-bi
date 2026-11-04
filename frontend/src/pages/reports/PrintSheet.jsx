import { todayISO } from "../../utils/format";
import { COMPANY, SIGNERS, rowNumbers } from "../../utils/reportInfo";

// Dòng ký hiệu cột theo mẫu biểu Việt Nam: cột chữ ghi A, B, C…; cột số ghi 1, 2, 3…
function columnMarks(columns) {
  let letter = 1; // "A" dành cho cột STT
  let number = 0;
  return ["A", ...columns.map((c) => (c.align === "right" ? String(++number) : String.fromCharCode(65 + letter++)))];
}

// Một bảng trong báo cáo in. rows: [{ cells: [...], kind?: "group" | "total" }]
function PrintTable({ title, columns, rows, note }) {
  const stt = rowNumbers(rows);
  return (
    <section className="ps-section">
      {title && <h3 className="ps-section-title">{title}</h3>}
      <table className="ps-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>STT</th>
            {columns.map((c) => (
              <th key={c.label} style={{ width: c.width }}>
                {c.label}
              </th>
            ))}
          </tr>
          <tr className="ps-marks">
            {columnMarks(columns).map((m, i) => (
              <th key={i}>{m}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + 1} className="ps-center ps-empty">
                Không có số liệu
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i} className={r.kind ? `ps-${r.kind}` : ""}>
              <td className="ps-center">{stt[i]}</td>
              {r.cells.map((cell, j) => (
                <td key={j} className={`ps-${columns[j].align || "left"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {note && <p className="ps-note">{note}</p>}
    </section>
  );
}

// Bản báo cáo để in / xuất PDF theo cách trình bày báo cáo thường dùng ở doanh nghiệp Việt Nam:
// tên đơn vị + mẫu số ở đầu trang, tiêu đề in hoa ở giữa, kỳ báo cáo, đơn vị tính,
// bảng kẻ ô đầy đủ (có dòng ký hiệu cột A, B, 1, 2…), ngày lập và chỗ ký của các chức danh.
// Chỉ hiện khi in (CSS .print-only); màn hình vẫn dùng giao diện web bình thường.
// signerType: "finance" | "operation"
function PrintSheet({ title, formCode, period, unit, sections, notes = [], signerType = "operation", preparedBy, orientation = "landscape" }) {
  const [y, m, d] = todayISO().split("-");
  const signers = SIGNERS[signerType];
  return (
    <div className="print-only print-sheet">
      {/* Khổ giấy của báo cáo này */}
      <style>{`@media print { @page { size: A4 ${orientation}; margin: 14mm 12mm; } }`}</style>

      <header className="ps-head">
        <div className="ps-company">
          <strong>{COMPANY.name}</strong>
          <span>Địa chỉ: {COMPANY.address}</span>
          <span>Mã số thuế: {COMPANY.taxCode}</span>
        </div>
        <div className="ps-form">
          <strong>Mẫu số: {formCode}</strong>
          <em>(Mẫu báo cáo quản trị nội bộ)</em>
        </div>
      </header>

      <div className="ps-title">
        <h1>{title.toUpperCase()}</h1>
        {period && <p>{period}</p>}
      </div>
      {unit && <p className="ps-unit">Đơn vị tính: {unit}</p>}

      {sections.map((s, i) => (
        <PrintTable key={i} {...s} />
      ))}

      {notes.map((n, i) => (
        <p key={i} className="ps-note">
          {n}
        </p>
      ))}

      <footer className="ps-sign">
        <p className="ps-place">
          Hà Nội, ngày {d} tháng {m} năm {y}
        </p>
        <div className="ps-sign-cols" style={{ gridTemplateColumns: `repeat(${signers.length}, 1fr)` }}>
          {signers.map((s, i) => (
            <div key={s}>
              <strong>{s.toUpperCase()}</strong>
              <em>{i === signers.length - 1 ? "(Ký, họ tên, đóng dấu)" : "(Ký, họ tên)"}</em>
              <span>{i === 0 ? preparedBy : ""}</span>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}

export default PrintSheet;
