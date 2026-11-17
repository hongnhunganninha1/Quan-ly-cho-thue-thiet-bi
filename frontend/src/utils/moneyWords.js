// Đọc số tiền bằng chữ tiếng Việt: 1250000 → "Một triệu hai trăm năm mươi nghìn đồng"
// Dùng cho bản in hợp đồng / quyết toán (printDocs.js) và dòng "bằng chữ" trong báo cáo.
const DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
function readTriple(n, full) {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  const out = [];
  if (full || h > 0) out.push(`${DIGITS[h]} trăm`);
  if (t > 1) out.push(`${DIGITS[t]} mươi`);
  else if (t === 1) out.push("mười");
  else if ((full || h > 0) && u > 0) out.push("linh");
  if (u > 0) {
    if (u === 1 && t > 1) out.push("mốt");
    else if (u === 5 && t > 0) out.push("lăm");
    else if (u === 4 && t > 1) out.push("tư");
    else out.push(DIGITS[u]);
  }
  return out.join(" ");
}
export function moneyInWords(value) {
  let n = Math.round(Math.abs(Number(value) || 0));
  if (n === 0) return "Không đồng";
  const units = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
  const groups = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  const parts = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i] === 0) continue;
    parts.push(readTriple(groups[i], i < groups.length - 1) + units[i]);
  }
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`;
}
