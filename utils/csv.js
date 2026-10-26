// Xuất bảng ra file CSV mở được bằng Excel (có BOM để Excel đọc đúng tiếng Việt).
// columns: [{ label, value(row) }]
export function exportCsv(filename, columns, rows) {
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => escape(c.label)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => escape(c.value(row))).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
