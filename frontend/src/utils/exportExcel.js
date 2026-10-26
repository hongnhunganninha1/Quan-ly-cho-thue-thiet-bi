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
const STYLE = { normal: 0, header: 1, text: 2, number: 3, title: 4, subtitle: 5 };

function cell(ref, value, style) {
  if (value === null || value === undefined || value === "") return `<c r="${ref}" s="${style}"/>`;
  if (style === STYLE.number && typeof value === "number" && Number.isFinite(value)) {
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
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>' +
  '<fonts count="4">' +
  '<font><sz val="11"/><name val="Times New Roman"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Times New Roman"/></font>' +
  '<font><b/><sz val="14"/><name val="Times New Roman"/></font>' +
  '<font><i/><sz val="11"/><name val="Times New Roman"/></font>' +
  "</fonts>" +
  '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1E4B8F"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color rgb="FFBFC7D5"/></left><right style="thin"><color rgb="FFBFC7D5"/></right>' +
  '<top style="thin"><color rgb="FFBFC7D5"/></top><bottom style="thin"><color rgb="FFBFC7D5"/></bottom><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="6">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>' +
  "</cellXfs>" +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  "</styleSheet>";

function workbookFiles(opts) {
  const sheetName = esc(String(opts.sheetName || "Sheet1").replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
  return {
    "[Content_Types].xml":
      XML_HEAD +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
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
    "xl/worksheets/sheet1.xml": sheetXml(opts),
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
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = enc.encode(text);
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
