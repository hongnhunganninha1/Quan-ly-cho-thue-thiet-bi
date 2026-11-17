// Xuất dữ liệu ra file Excel (.xlsx) ngay trên trình duyệt, không cần cài thêm thư viện.
// File .xlsx thực chất là một file nén ZIP chứa các file XML; ở đây ghi ZIP dạng "không nén" (stored).
//
// exportExcel({
//   fileName: "lich-trong.xlsx",
//   sheetName: "Lịch trống",
//   title: "TRA CỨU LỊCH TRỐNG THIẾT BỊ",          // dòng tiêu đề (không bắt buộc)
//   subtitle: "Từ 01/11/2026 đến 07/11/2026",       // dòng phụ (không bắt buộc)
//   columns: [{ label: "Mã máy", width: 14 }, { label: "Giá ngày", width: 14, type: "number" }],
//   rows: [["SKU26070001", 3500000], ...],
// })

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // bỏ ký tự điều khiển không hợp lệ trong XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

// Tên cột Excel: 0 -> A, 25 -> Z, 26 -> AA
function colName(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Kiểu ô (theo thứ tự cellXfs trong styles.xml)
const STYLE = {
  normal: 0, header: 1, text: 2, number: 3, title: 4, subtitle: 5,
  // dùng cho file báo cáo
  bold: 6, boldText: 7, boldNumber: 8, decimal: 9, boldDecimal: 10, italic: 11, center: 12, boldCenter: 13, italicRight: 14,
  // màu theo logo công ty: tiêu đề xanh đậm; dòng nhóm nền xanh nhạt; dòng tổng nền cam nhạt
  titleNavy: 15, boldNavy: 16,
  groupText: 17, groupNumber: 18, groupDecimal: 19, groupCenter: 20,
  totalText: 21, totalNumber: 22, totalDecimal: 23, totalCenter: 24,
  boldItalic: 25, // dòng số tiền bằng chữ
};
const NUMERIC_STYLES = [3, 8, 9, 10, 18, 19, 22, 23];

function cell(ref, value, style) {
  if (value === null || value === undefined || value === "") return `<c r="${ref}" s="${style}"/>`;
  const numeric = NUMERIC_STYLES.includes(style);
  if (numeric && typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

function sheetXml({ title, subtitle, columns, rows }) {
  const out = [];
  let r = 0;
  const merges = [];
  const last = colName(columns.length - 1);
  if (title) {
    r += 1;
    out.push(`<row r="${r}" ht="22" customHeight="1">${cell(`A${r}`, title, STYLE.title)}</row>`);
    merges.push(`A${r}:${last}${r}`);
  }
  if (subtitle) {
    r += 1;
    out.push(`<row r="${r}">${cell(`A${r}`, subtitle, STYLE.subtitle)}</row>`);
    merges.push(`A${r}:${last}${r}`);
  }
  if (title || subtitle) r += 1; // để trống một dòng
  r += 1;
  const headerRow = r;
  out.push(`<row r="${r}">${columns.map((c, i) => cell(`${colName(i)}${r}`, c.label, STYLE.header)).join("")}</row>`);
  for (const row of rows) {
    r += 1;
    out.push(
      `<row r="${r}">${columns
        .map((c, i) => cell(`${colName(i)}${r}`, row[i], c.type === "number" ? STYLE.number : STYLE.text))
        .join("")}</row>`,
    );
  }
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 15}" customWidth="1"/>`).join("");
  return (
    XML_HEAD +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols><sheetData>${out.join("")}</sheetData>` +
    (rows.length ? `<autoFilter ref="A${headerRow}:${last}${r}"/>` : "") +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") +
    "</worksheet>"
  );
}

const STYLES_XML =
  XML_HEAD +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="#,##0.0"/></numFmts>' +
  '<fonts count="9">' +
  '<font><sz val="11"/><name val="Times New Roman"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Times New Roman"/></font>' +
  '<font><b/><sz val="14"/><name val="Times New Roman"/></font>' +
  '<font><i/><sz val="11"/><name val="Times New Roman"/></font>' +
  '<font><b/><sz val="11"/><name val="Times New Roman"/></font>' +
  '<font><b/><sz val="15"/><color rgb="FF1F3B63"/><name val="Times New Roman"/></font>' + // 5 tiêu đề xanh đậm
  '<font><b/><sz val="11"/><color rgb="FF1F3B63"/><name val="Times New Roman"/></font>' + // 6 đậm xanh
  '<font><b/><sz val="11"/><color rgb="FF9A3F06"/><name val="Times New Roman"/></font>' + // 7 đậm cam (dòng tổng)
  '<font><b/><i/><sz val="11"/><name val="Times New Roman"/></font>' + // 8 đậm nghiêng (bằng chữ)
  "</fonts>" +
  '<fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1F3B63"/><bgColor indexed="64"/></patternFill></fill>' + // 2 xanh đậm (tiêu đề cột)
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE3EAF4"/><bgColor indexed="64"/></patternFill></fill>' + // 3 xanh nhạt (dòng nhóm)
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFDEBDD"/><bgColor indexed="64"/></patternFill></fill></fills>' + // 4 cam nhạt (dòng tổng)
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color rgb="FF2B3A4F"/></left><right style="thin"><color rgb="FF2B3A4F"/></right>' +
  '<top style="thin"><color rgb="FF2B3A4F"/></top><bottom style="thin"><color rgb="FF2B3A4F"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="26">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  // 6 bold (không viền) · 7 bold có viền · 8 số bold · 9 số thập phân · 10 số thập phân bold
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  '<xf numFmtId="165" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>' +
  // 11 nghiêng · 12 giữa có viền · 13 giữa bold có viền · 14 nghiêng căn phải
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="right"/></xf>' +
  // 15 tiêu đề xanh · 16 đậm xanh
  '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  // 17–20 dòng nhóm: chữ · số · số thập phân · giữa
  '<xf numFmtId="0" fontId="6" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="164" fontId="6" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="165" fontId="6" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="6" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
  // 21–24 dòng tổng
  '<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="164" fontId="7" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="165" fontId="7" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="7" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="8" fillId="0" borderId="0" xfId="0" applyFont="1"/>' + // 25 đậm nghiêng
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

function workbookFiles(opts) {
  const sheetName = esc(String(opts.sheetName || "Sheet1").replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  const img = opts.image; // { bytes: Uint8Array, cx, cy } – ảnh (logo) đặt ở góc trên bên trái trang tính
  const imageFiles = img
    ? {
        "xl/worksheets/_rels/sheet1.xml.rels":
          XML_HEAD +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
          "</Relationships>",
        "xl/drawings/drawing1.xml":
          XML_HEAD +
          '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from>' +
          `<xdr:ext cx="${img.cx}" cy="${img.cy}"/>` +
          '<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
          '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
          `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.cx}" cy="${img.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
          "</xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>",
        "xl/drawings/_rels/drawing1.xml.rels":
          XML_HEAD +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>' +
          "</Relationships>",
        "xl/media/image1.png": img.bytes,
      }
    : {};
  return {
    "[Content_Types].xml":
      XML_HEAD +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      (img ? '<Default Extension="png" ContentType="image/png"/>' : "") +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      (img ? '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>' : "") +
      "</Types>",
    "_rels/.rels":
      XML_HEAD +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      "</Relationships>",
    "xl/workbook.xml":
      XML_HEAD +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets>` +
      "</workbook>",
    "xl/_rels/workbook.xml.rels":
      XML_HEAD +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>",
    "xl/styles.xml": STYLES_XML,
    "xl/worksheets/sheet1.xml": opts.sheetXml || sheetXml(opts),
    ...imageFiles,
  };
}

// ----- Ghi file ZIP (không nén) -----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = typeof content === "string" ? enc.encode(content) : content; // chuỗi XML hoặc dữ liệu nhị phân (ảnh)
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // tên file UTF-8
    local.setUint16(8, 0, true); // không nén
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// Tạo nội dung file .xlsx (Uint8Array)
export function buildXlsx(opts) {
  return zip(workbookFiles(opts));
}

// Tạo và tải file .xlsx về máy
export function exportExcel(opts) {
  const blob = new Blob([buildXlsx(opts)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName || "du-lieu.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ----- File Excel cho báo cáo (cùng nội dung với bản in) -----
// report: { title, formCode, period, unit, sections: [{ title, columns: [{ label, align, width }], rows: [{ cells, kind }] }],
//           notes, signers, preparedBy, company, rowNumbers, wordLines }
//   section.words: [[nhãn, số tiền], ...] – đọc số tiền bằng chữ dưới bảng

// Số trong báo cáo đang ở dạng chữ kiểu Việt Nam ("1.234.567", "45,5", "-") → đổi lại thành số để Excel tính được
function toNumber(value) {
  if (typeof value === "number") return value;
  const t = String(value ?? "").trim();
  if (t === "-" || t === "") return t === "-" ? 0 : "";
  if (!/^-?[\d.]+(,\d+)?$/.test(t)) return t;
  return Number(t.replace(/\./g, "").replace(",", "."));
}

// Logo trong file Excel: cao 4 dòng đầu (mỗi dòng 18pt = 24px), giữ tỉ lệ ảnh gốc
const LOGO_ROWS = 4;
const LOGO_ROW_PT = 18;
const EMU_PER_PX = 9525;

function reportSheetXml(report) {
  const { company, title, formCode, period, unit, sections, notes = [], signers = [], preparedBy, logo } = report;
  const width = 1 + Math.max(...sections.map((s) => s.columns.length), 1); // số cột (kể cả STT)
  const last = colName(width - 1);
  const out = [];
  const merges = [];
  let r = 0;
  const line = (value, style, merge = true, col = "A", height = 0) => {
    r += 1;
    const ht = height ? ` ht="${height}" customHeight="1"` : "";
    out.push(`<row r="${r}"${ht}>${cell(`${col}${r}`, value, style)}</row>`);
    if (merge) merges.push(`A${r}:${last}${r}`);
  };

  // Độ rộng cột: lấy theo cột rộng nhất của các bảng
  const widths = Array.from({ length: width }, (_, i) => (i === 0 ? 6 : 12));
  for (const s of sections) {
    s.columns.forEach((c, i) => {
      const w = c.width ? Math.round(c.width / 6) : 32;
      widths[i + 1] = Math.max(widths[i + 1], Math.min(w, 45));
    });
  }

  // Đầu trang: logo bên trái, thông tin công ty ghi từ cột nằm ngay sau logo
  let infoCol = "A";
  if (logo) {
    const logoH = LOGO_ROWS * LOGO_ROW_PT * (96 / 72) - 10; // px
    const logoW = (logo.width / logo.height) * logoH;
    logo.cx = Math.round(logoW * EMU_PER_PX);
    logo.cy = Math.round(logoH * EMU_PER_PX);
    let px = 0;
    let k = 0;
    while (k < width - 1 && px < logoW + 12) px += Math.trunc(widths[k++] * 7 + 5); // độ rộng cột Excel ≈ ký tự × 7 + 5 px
    infoCol = colName(k);
  }
  const headH = logo ? LOGO_ROW_PT : 0;
  line(company.name, STYLE.boldNavy, false, infoCol, headH);
  line(`Địa chỉ: ${company.address}`, STYLE.normal, false, infoCol, headH);
  line(`Mã số thuế: ${company.taxCode}`, STYLE.normal, false, infoCol, headH);
  if (formCode || logo) line(formCode ? `Mẫu số: ${formCode} (Mẫu báo cáo quản trị nội bộ)` : "", STYLE.italic, false, infoCol, headH);
  r += 1;
  line(title.toUpperCase(), STYLE.titleNavy, true, "A", 22);
  if (period) line(period, STYLE.subtitle);
  if (unit) line(`Đơn vị tính: ${unit}`, STYLE.italicRight);

  for (const s of sections) {
    r += 1;
    if (s.title) line(s.title, STYLE.boldNavy, false);
    r += 1;
    out.push(
      `<row r="${r}" ht="30" customHeight="1">${cell(`A${r}`, "STT", STYLE.header)}${s.columns
        .map((c, i) => cell(`${colName(i + 1)}${r}`, c.label, STYLE.header))
        .join("")}</row>`,
    );
    if (s.rows.length === 0) {
      r += 1;
      out.push(`<row r="${r}">${cell(`A${r}`, "Không có số liệu", STYLE.center)}</row>`);
      merges.push(`A${r}:${colName(s.columns.length)}${r}`);
    }
    const stt = report.rowNumbers(s.rows);
    s.rows.forEach((row, k) => {
      r += 1;
      // Kiểu ô theo loại dòng: thường / nhóm (nền xanh nhạt) / tổng (nền cam nhạt)
      const st =
        row.kind === "group"
          ? { text: STYLE.groupText, number: STYLE.groupNumber, decimal: STYLE.groupDecimal, center: STYLE.groupCenter }
          : row.kind === "total"
            ? { text: STYLE.totalText, number: STYLE.totalNumber, decimal: STYLE.totalDecimal, center: STYLE.totalCenter }
            : { text: STYLE.text, number: STYLE.number, decimal: STYLE.decimal, center: STYLE.center };
      const cells = [cell(`A${r}`, stt[k], st.center)];
      s.columns.forEach((c, i) => {
        const ref = `${colName(i + 1)}${r}`;
        const raw = row.cells[i];
        if (c.align === "right") {
          const v = toNumber(raw);
          const dec = typeof v === "number" && !Number.isInteger(v);
          cells.push(cell(ref, v, dec ? st.decimal : st.number));
        } else if (c.align === "center") {
          cells.push(cell(ref, raw, st.center));
        } else {
          cells.push(cell(ref, raw, st.text));
        }
      });
      out.push(`<row r="${r}">${cells.join("")}</row>`);
    });
    if (s.words?.length) report.wordLines(s.words).forEach((w) => line(w, STYLE.boldItalic, false));
    if (s.note) line(s.note, STYLE.italic, false);
  }

  if (notes.length) r += 1;
  notes.forEach((n) => line(n, STYLE.italic, false));

  // Ngày lập và chức danh ký
  const [y, m, d] = new Date().toISOString().slice(0, 10).split("-");
  r += 1;
  line(`Hà Nội, ngày ${d} tháng ${m} năm ${y}`, STYLE.italicRight);
  if (signers.length) {
    const step = Math.max(1, Math.floor(width / signers.length));
    const cols = signers.map((_, i) => colName(Math.min(width - 1, i * step)));
    r += 1;
    out.push(`<row r="${r}">${signers.map((s, i) => cell(`${cols[i]}${r}`, s.toUpperCase(), STYLE.boldNavy)).join("")}</row>`);
    r += 1;
    out.push(
      `<row r="${r}">${signers
        .map((_, i) => cell(`${cols[i]}${r}`, i === signers.length - 1 ? "(Ký, họ tên, đóng dấu)" : "(Ký, họ tên)", STYLE.italic))
        .join("")}</row>`,
    );
    if (preparedBy) {
      r += 4;
      out.push(`<row r="${r}">${cell(`${cols[0]}${r}`, preparedBy, STYLE.bold)}</row>`);
    }
  }

  const colsXml = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  return (
    XML_HEAD +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews>' +
    `<cols>${colsXml}</cols><sheetData>${out.join("")}</sheetData>` +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.map((x) => `<mergeCell ref="${x}"/>`).join("")}</mergeCells>` : "") +
    '<pageSetup paperSize="9" orientation="' + (report.orientation === "portrait" ? "portrait" : "landscape") + '" fitToWidth="1" fitToHeight="0"/>' +
    (logo ? '<drawing r:id="rId1"/>' : "") +
    "</worksheet>"
  );
}

// Đọc ảnh logo (đường dẫn do Vite cấp khi import file .png) thành dữ liệu nhị phân + kích thước gốc
async function loadLogo(url) {
  try {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const size = await new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve({ width: im.naturalWidth, height: im.naturalHeight });
      im.onerror = reject;
      im.src = url;
    });
    return { bytes, ...size };
  } catch {
    return null; // không đọc được logo thì vẫn xuất file, chỉ thiếu logo
  }
}

// Xuất một báo cáo ra file Excel: logo + thông tin công ty, tiêu đề, kỳ báo cáo, các bảng, ghi chú và chỗ ký.
// report.logoUrl: đường dẫn ảnh logo PNG (không bắt buộc).
export async function exportReportExcel(report, fileName) {
  const logo = report.logoUrl ? await loadLogo(report.logoUrl) : null;
  const sheet = reportSheetXml({ ...report, logo });
  exportExcel({ fileName, sheetName: report.sheetName || "Báo cáo", sheetXml: sheet, image: logo });
}
