// Bản in hợp đồng cho thuê (kèm biên bản quyết toán nếu đã quyết toán), biên bản bàn giao, biên bản thu hồi.
// Văn bản theo thể thức Việt Nam (quốc hiệu, tiêu ngữ, căn cứ, điều khoản, chữ ký). Hiện bản xem trước
// (components/common/PrintPreview.jsx); bấm "In / Lưu PDF" mới mở hộp thoại in – chọn "Lưu dưới dạng PDF" để lấy file.
import { api } from "../api/client";
import { COMPANY } from "./reportInfo";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const money = (v) => `${Number(v || 0).toLocaleString("vi-VN")} đồng`;
const num = (v) => Number(v || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const pad = (n) => String(n).padStart(2, "0");
const toDate = (v) => (v ? new Date(String(v).replace(" ", "T")) : null);
const dmy = (v) => {
  const d = toDate(v);
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : "…/…/……";
};
const hm = (v) => {
  const d = toDate(v);
  return d ? `${pad(d.getHours())} giờ ${pad(d.getMinutes())} phút` : "";
};
const dayText = (v) => {
  const d = toDate(v);
  return d ? `ngày ${pad(d.getDate())} tháng ${pad(d.getMonth() + 1)} năm ${d.getFullYear()}` : "ngày …… tháng …… năm ……";
};
const absUrl = (u) => (u ? new URL(u, window.location.origin).href : "");

// ----- Đọc số tiền bằng chữ -----
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

// ----- Khung văn bản chung -----
const CSS = `
  @page { size: A4 portrait; margin: 18mm 18mm 18mm 25mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.45; color: #000; }
  .doc { max-width: 170mm; margin: 0 auto; padding: 8mm 0; position: relative; }
  .nation { text-align: center; }
  .nation b { display: block; font-size: 13pt; }
  .nation span { display: inline-block; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2px; }
  .place { text-align: right; font-style: italic; margin: 10px 0 4px; }
  h1 { text-align: center; font-size: 15pt; margin: 18px 0 2px; text-transform: uppercase; }
  .no { text-align: center; font-style: italic; margin-bottom: 12px; }
  .base { font-style: italic; margin: 2px 0; }
  h2 { font-size: 13pt; margin: 14px 0 4px; }
  p { margin: 3px 0; text-align: justify; }
  .party { margin: 6px 0; }
  .party p { margin: 1px 0; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 12pt; table-layout: fixed; }
  td small { font-size: 10.5pt; }
  th, td { border: 1px solid #000; padding: 4px 5px; vertical-align: top; overflow-wrap: anywhere; }
  th { text-align: center; font-weight: bold; }
  .r { text-align: right; }
  .c { text-align: center; }
  td.r, td.c, th:first-child { white-space: nowrap; overflow-wrap: normal; }
  th { overflow-wrap: normal; }
  .total td { font-weight: bold; }
  .kv td:first-child { width: 42%; }
  .words { font-style: italic; }
  .formula { margin: 4px 0 6px 14px; padding: 6px 10px; border-left: 3px solid #999; background: #f6f6f6; line-height: 1.6; }
  .signs { display: grid; grid-template-columns: 1fr 1fr; text-align: center; margin-top: 22px; page-break-inside: avoid; }
  .signs b { display: block; text-transform: uppercase; }
  .signs i { display: block; font-size: 11.5pt; }
  .signs .name { margin-top: 70px; font-weight: bold; }
  .photo { text-align: center; margin: 8px 0; page-break-inside: avoid; }
  .photo img { max-width: 100%; max-height: 55mm; border: 1px solid #999; }
  .photo:only-child img, .doc > .photo img { max-width: 75mm; }
  .photo div { font-size: 11pt; font-style: italic; }
  .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .draft { position: fixed; top: 40%; left: 0; right: 0; text-align: center; font-size: 46pt; font-weight: bold;
           color: rgba(200, 0, 0, 0.13); transform: rotate(-28deg); pointer-events: none; }
`;

function header(placeDate) {
  return `
    <div class="nation">
      <b>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</b>
      <span>Độc lập – Tự do – Hạnh phúc</span>
    </div>
    <div class="place">Hà Nội, ${dayText(placeDate)}</div>`;
}

function partyA(role, person) {
  return `
    <div class="party">
      <p><b>${role}: ${esc(COMPANY.name)}</b></p>
      <p>Địa chỉ: ${esc(COMPANY.address)}</p>
      <p>Mã số thuế: ${esc(COMPANY.taxCode)}${COMPANY.phone ? ` &nbsp;&nbsp; Điện thoại: ${esc(COMPANY.phone)}` : ""}</p>
      ${person}
    </div>`;
}

function partyB(role, cu, person) {
  const company = cu.customer_type === "COMPANY";
  return `
    <div class="party">
      <p><b>${role}: ${esc(company ? cu.name : `Ông/Bà ${cu.name}`)}</b></p>
      ${cu.address ? `<p>Địa chỉ: ${esc(cu.address)}</p>` : ""}
      <p>${company ? "Mã số thuế" : "Số CCCD"}: ${esc(cu.id_number)} &nbsp;&nbsp; Điện thoại: ${esc(cu.phone)}${cu.email ? ` &nbsp;&nbsp; Email: ${esc(cu.email)}` : ""}</p>
      ${cu.bank_account ? `<p>Số tài khoản: ${esc(cu.bank_account)}${cu.bank_name ? ` tại ${esc(cu.bank_name)}` : ""}</p>` : ""}
      ${person ?? (company ? `<p>Đại diện: Ông/Bà <b>${esc(cu.representative)}</b>${cu.representative_title ? ` &nbsp;&nbsp; Chức vụ: ${esc(cu.representative_title)}` : ""}</p>` : "")}
    </div>`;
}

function signs(left, right) {
  const block = ([title, note, name]) => `<div><b>${title}</b><i>${note}</i><div class="name">${esc(name || "")}</div></div>`;
  return `<div class="signs">${block(left)}${block(right)}</div>`;
}

const equipmentName = (i) => `${esc(i.brand_name)} ${esc(i.model)}${i.category_name ? ` – ${esc(i.category_name)}` : ""}`;

// Ghép thành 1 trang HTML hoàn chỉnh để hiện trong khung xem trước (iframe) và in từ đó
function page(title, body, { draft = false } = {}) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>${CSS} html { background: #e5e7eb; } .doc { background: #fff; padding: 14mm 16mm; margin: 10px auto;
      box-shadow: 0 2px 10px rgba(0,0,0,.15); } @media print { html { background: #fff; } .doc { box-shadow: none; margin: 0; padding: 0; } }</style>
    </head><body>
    ${draft ? `<div class="draft">BẢN NHÁP – CHƯA ĐẶT CỌC</div>` : ""}
    <div class="doc">${body}</div>
    </body></html>`;
}

// ===================== HỢP ĐỒNG CHO THUÊ =====================
function contractBody(c) {
  const cu = c.customer;
  const byDay = c.pricing_type === "DAY";
  const unit = byDay ? "ngày" : "giờ";
  const days = Math.round((toDate(c.end_date) - toDate(c.start_date)) / 86400000) + 1;
  const rows = c.items
    .map(
      (i, k) => `<tr>
        <td class="c">${k + 1}</td>
        <td>${equipmentName(i)}</td>
        <td class="c">${esc(i.manufacture_year)}</td>
        <td>${esc(i.serial_number)}</td>
        <td class="r">${num(i.unit_price)}</td>
        <td class="r">${num(i.planned_duration)} ${unit}</td>
        <td class="r">${num(i.amount)}</td>
      </tr>`,
    )
    .join("");
  const afterDiscount = Number(c.subtotal) - Number(c.discount_amount);
  const deposit = Number(c.deposit_amount || 0);
  return `
    ${header(c.created_at)}
    <h1>Hợp đồng cho thuê thiết bị</h1>
    <div class="no">Số: ${esc(c.contract_no)}/HĐTB-COMACPRO</div>
    <p class="base">– Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;</p>
    <p class="base">– Căn cứ Luật Thương mại số 36/2005/QH11 ngày 14/06/2005;</p>
    <p class="base">– Căn cứ nhu cầu và khả năng của hai bên.</p>
    <p>Hôm nay, ${dayText(c.created_at)}, tại văn phòng ${esc(COMPANY.name)}, chúng tôi gồm:</p>
    ${partyA("BÊN CHO THUÊ (Bên A)", `<p>Đại diện: ${esc(COMPANY.directorPrefix || "Ông/Bà")} <b>${esc(COMPANY.director)}</b> &nbsp;&nbsp; Chức vụ: ${esc(COMPANY.directorTitle)}</p>`)}
    ${partyB("BÊN THUÊ (Bên B)", cu)}
    <p>Hai bên thống nhất ký kết hợp đồng cho thuê thiết bị với các điều khoản sau:</p>

    <h2>Điều 1. Thiết bị cho thuê</h2>
    <table>
      <colgroup><col style="width:7%"><col style="width:24%"><col style="width:9%"><col style="width:18%"><col style="width:16%"><col style="width:11%"><col style="width:15%"></colgroup>
      <thead><tr><th>STT</th><th>Tên thiết bị</th><th>Năm SX</th><th>Số serial (số khung)</th>
        <th>Đơn giá thuê<br>(đồng/${unit})</th><th>Thời lượng</th><th>Thành tiền (đồng)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${
      byDay
        ? `<p>Đơn giá tính phí vượt giờ (đồng/giờ): ${c.items
            .map((i, k) => `STT ${k + 1} – ${equipmentName(i)}: <b>${num(i.hourly_rate)}</b>`)
            .join("; ")}.</p>`
        : ""
    }
    <p>Thiết bị được giao đúng chủng loại, hoạt động bình thường, kèm biên bản bàn giao có ghi số giờ máy và ảnh chụp đồng hồ giờ máy.</p>

    <h2>Điều 2. Thời gian, địa điểm và hình thức tính giá</h2>
    <p>– Thời gian thuê: từ ngày ${dmy(c.start_date)} đến hết ngày ${dmy(c.end_date)} (${days} ngày).</p>
    <p>– Địa điểm giao, nhận máy: ${esc(c.delivery_address)}.</p>
    <p>– Hình thức tính giá: ${
      byDay
        ? "theo ngày; mỗi ngày được sử dụng tối đa 08 giờ máy (01 ca), số giờ vượt tính phí vượt giờ theo Điều 5."
        : "theo giờ, tính theo số giờ thuê ghi tại Điều 1; số giờ sử dụng vượt tính phí vượt giờ theo Điều 5."
    }</p>

    <h2>Điều 3. Giá trị hợp đồng</h2>
    <table class="kv">
      <tr><td>Tiền thuê thiết bị</td><td class="r">${money(c.subtotal)}</td></tr>
      <tr><td>Chiết khấu (${num(c.discount_rate)}%)</td><td class="r">– ${money(c.discount_amount)}</td></tr>
      <tr><td>Phí vận chuyển</td><td class="r">${money(c.transport_fee)}</td></tr>
      <tr><td>Cộng trước thuế</td><td class="r">${money(afterDiscount + Number(c.transport_fee))}</td></tr>
      <tr><td>Thuế GTGT (${num(c.vat_rate)}%)</td><td class="r">${money(c.vat_amount)}</td></tr>
      <tr class="total"><td>TỔNG GIÁ TRỊ HỢP ĐỒNG</td><td class="r">${money(c.total_amount)}</td></tr>
    </table>
    <p class="words">Bằng chữ: ${moneyInWords(c.total_amount)}.</p>

    <h2>Điều 4. Đặt cọc và thanh toán</h2>
    ${
      deposit > 0
        ? `<p>– Bên B đã đặt cọc cho Bên A số tiền <b>${money(deposit)}</b> (${moneyInWords(deposit).toLowerCase()})${
            c.deposit_paid_at ? ` vào lúc ${hm(c.deposit_paid_at)} ${dayText(c.deposit_paid_at)}` : ""
          }.</p>`
        : `<p>– Bên B đặt cọc cho Bên A trong vòng 03 (ba) ngày kể từ khi hợp đồng được duyệt; Bên A chỉ bàn giao thiết bị sau khi nhận đủ tiền cọc.</p>`
    }
    <p>– Khi thu hồi đủ thiết bị, hai bên quyết toán: tổng tiền thuê, phí vượt giờ, tiền bồi thường (nếu có) và thuế GTGT, trừ đi tiền đã đặt cọc. Số còn lại Bên B thanh toán cho Bên A; nếu tiền cọc lớn hơn thì Bên A hoàn lại phần chênh lệch cho Bên B.</p>
    <p>– Hình thức thanh toán: tiền mặt hoặc chuyển khoản.</p>

    <h2>Điều 5. Chi phí phát sinh</h2>
    <p>– <b>Phí vượt giờ</b> (tính riêng cho từng thiết bị):</p>
    <p class="formula">Số giờ đã sử dụng = Số giờ đồng hồ máy lúc thu hồi − Số giờ đồng hồ máy lúc bàn giao<br>
      Số giờ được phép = ${
        byDay
          ? `Số ngày thuê × 08 giờ (hợp đồng này: ${days} ngày × 08 giờ = ${num(days * 8)} giờ/thiết bị)`
          : "Số giờ thuê của thiết bị ghi tại Điều 1"
      }<br>
      Số giờ vượt = Số giờ đã sử dụng − Số giờ được phép, <b>làm tròn lên giờ chẵn</b> (phần lẻ dưới 01 giờ tính là 01 giờ)<br>
      <b>Phí vượt giờ = Số giờ vượt (đã làm tròn) × Đơn giá thuê giờ của thiết bị</b><br>
      <i>Ví dụ: ${
        byDay
          ? "thuê 10 ngày được phép 80 giờ; đồng hồ đo được 85,6 giờ thì vượt 5,6 giờ, làm tròn lên 06 giờ, phí vượt giờ = 06 × đơn giá thuê giờ."
          : "thuê 08 giờ; đồng hồ đo được 9,5 giờ thì vượt 1,5 giờ, làm tròn lên 02 giờ, phí vượt giờ = 02 × đơn giá thuê giờ."
      }</i></p>
    <p>– <b>Trả thiết bị sau ngày kết thúc</b>: không tính phí trả chậm riêng; số giờ máy chạy thêm trong những ngày trả chậm được cộng vào số giờ đã sử dụng và tính theo phí vượt giờ nêu trên.</p>
    <p>– <b>Trả thiết bị sớm</b>: Bên B trả thiết bị trước ngày kết thúc hoặc sử dụng ít hơn số giờ thuê thì giá trị hợp đồng vẫn tính đủ theo Điều 3; Bên A không hoàn lại tiền thuê cho thời gian, số giờ không sử dụng.</p>
    <p>– Thiết bị hư hỏng, mất mát do lỗi của Bên B: Bên B bồi thường theo chi phí sửa chữa, thay thế thực tế (không chịu thuế GTGT).</p>

    <h2>Điều 6. Trách nhiệm của các bên</h2>
    <p><b>Bên A:</b> giao thiết bị đúng chủng loại, thời gian, địa điểm; cung cấp hồ sơ, hướng dẫn vận hành; xử lý kịp thời khi thiết bị hỏng do lỗi kỹ thuật.</p>
    <p><b>Bên B:</b> sử dụng thiết bị đúng mục đích, đúng quy trình vận hành; bảo quản thiết bị trong thời gian thuê; không cho bên thứ ba thuê lại khi chưa có đồng ý của Bên A; trả thiết bị đúng hạn và thanh toán đầy đủ.</p>

    <h2>Điều 7. Điều khoản chung</h2>
    <p>Hai bên cam kết thực hiện đúng các điều khoản đã ký. Mọi thay đổi phải được hai bên thống nhất bằng văn bản. Tranh chấp phát sinh được giải quyết bằng thương lượng; nếu không thương lượng được thì đưa ra Toà án nhân dân có thẩm quyền giải quyết. Biên bản bàn giao, biên bản thu hồi và biên bản quyết toán là bộ phận không tách rời của hợp đồng này.</p>
    <p>Hợp đồng có hiệu lực kể từ ngày ký, được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản.</p>
    ${c.note ? `<p><i>Ghi chú: ${esc(c.note)}</i></p>` : ""}
    ${signs(
      ["Đại diện bên A", "(Ký, ghi rõ họ tên, đóng dấu)", COMPANY.director],
      ["Đại diện bên B", cu.customer_type === "COMPANY" ? "(Ký, ghi rõ họ tên, đóng dấu)" : "(Ký, ghi rõ họ tên)", cu.representative],
    )}
    <p style="margin-top:18px;font-size:11pt"><i>Người lập hợp đồng: ${esc(c.created_by_name)}${c.approved_by_name ? ` · Người duyệt: ${esc(c.approved_by_name)}` : ""}</i></p>
    ${c.settlement && c.settlement.confirmed_at ? settlementBody(c) : ""}`;
}

// Hợp đồng đã quyết toán: in thêm trang "Biên bản quyết toán hợp đồng"
function settlementBody(c) {
  const s = c.settlement;
  const due = Number(s.amount_due);
  const rows = c.items
    .filter((i) => i.return_no)
    .map(
      (i, k) => `<tr><td class="c">${k + 1}</td><td>${equipmentName(i)}<br><small>${esc(i.handover_no)} → ${esc(i.return_no)}</small></td>
        <td class="c">${esc(i.manufacture_year)}</td><td class="r">${num(i.return_rental_amount)}</td><td class="r">${num(i.overtime_fee)}</td>
        <td class="r">${num(i.compensation_amount)}</td></tr>`,
    )
    .join("");
  const status = { PAID: "Đã thanh toán đủ", PARTIAL: "Đã thanh toán một phần", UNPAID: "Chưa thanh toán", REFUNDED: "Đã hoàn tiền cho khách" }[s.payment_status] || "";
  return `
    <div style="page-break-before: always"></div>
    ${header(s.confirmed_at)}
    <h1>Biên bản quyết toán hợp đồng</h1>
    <div class="no">Kèm theo Hợp đồng cho thuê thiết bị số ${esc(c.contract_no)}/HĐTB-COMACPRO</div>
    <p>Hôm nay, ${dayText(s.confirmed_at)}, ${esc(COMPANY.name)} (Bên A) và ${esc(c.customer.name)} (Bên B) cùng quyết toán hợp đồng sau khi Bên A đã thu hồi đủ thiết bị:</p>
    <table>
      <colgroup><col style="width:7%"><col style="width:35%"><col style="width:10%"><col style="width:18%"><col style="width:15%"><col style="width:15%"></colgroup>
      <thead><tr><th>STT</th><th>Thiết bị (phiếu bàn giao → thu hồi)</th><th>Năm SX</th><th>Tiền thuê</th><th>Phí vượt giờ</th><th>Bồi thường</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="kv">
      <tr><td>Tiền thuê (đã trừ chiết khấu, cộng vận chuyển)</td><td class="r">${money(s.rental_total)}</td></tr>
      <tr><td>Phí vượt giờ</td><td class="r">${money(s.overtime_fee_total)}</td></tr>
      <tr><td>Tiền bồi thường (không chịu thuế GTGT)</td><td class="r">${money(s.compensation_total)}</td></tr>
      <tr><td>Thuế GTGT</td><td class="r">${money(s.vat_amount)}</td></tr>
      <tr><td>Trừ tiền đặt cọc đã nhận</td><td class="r">– ${money(s.deposit_amount)}</td></tr>
      <tr class="total"><td>${due >= 0 ? "BÊN B CÒN PHẢI THANH TOÁN" : "BÊN A HOÀN LẠI CHO BÊN B"}</td><td class="r">${money(Math.abs(due))}</td></tr>
      <tr><td>Đã thanh toán / đã hoàn</td><td class="r">${money(s.paid_amount)}</td></tr>
      <tr><td>Tình trạng thanh toán</td><td class="r">${esc(status)}</td></tr>
    </table>
    <p class="words">Bằng chữ: ${moneyInWords(Math.abs(due))}.</p>
    ${s.note ? `<p><i>Ghi chú: ${esc(s.note)}</i></p>` : ""}
    <p>Hai bên thống nhất số liệu quyết toán trên. Hợp đồng được thanh lý khi các bên hoàn tất nghĩa vụ thanh toán.</p>
    ${signs(["Đại diện bên A", "(Ký, ghi rõ họ tên, đóng dấu)", COMPANY.director], ["Đại diện bên B", "(Ký, ghi rõ họ tên)", c.customer.representative])}`;
}

// ===================== BIÊN BẢN BÀN GIAO =====================
function handoverBody(c, i) {
  const cu = c.customer;
  return `
    ${header(i.handover_at)}
    <h1>Biên bản bàn giao thiết bị</h1>
    <div class="no">Số: ${esc(i.handover_no)}</div>
    <p class="base">– Căn cứ Hợp đồng cho thuê thiết bị số ${esc(c.contract_no)}/HĐTB-COMACPRO;</p>
    <p>Hôm nay, vào lúc ${hm(i.handover_at)} ${dayText(i.handover_at)}, tại ${esc(c.delivery_address)}, chúng tôi gồm:</p>
    ${partyA("BÊN GIAO (Bên A)", `<p>Người giao: Ông/Bà <b>${esc(i.handed_by_name)}</b> – nhân viên ${esc(COMPANY.name)}</p>`)}
    ${partyB("BÊN NHẬN (Bên B)", cu, `<p>Người nhận: Ông/Bà <b>${esc(i.receiver_name)}</b>${i.receiver_phone ? ` &nbsp;&nbsp; Điện thoại: ${esc(i.receiver_phone)}` : ""}</p>`)}
    <p>Bên A tiến hành bàn giao cho Bên B thiết bị sau:</p>

    <h2>1. Thông tin thiết bị</h2>
    <table class="kv">
      <tr><td>Tên thiết bị</td><td>${equipmentName(i)}</td></tr>
      <tr><td>Số serial (số khung) / Năm sản xuất</td><td>${esc(i.serial_number)} / ${esc(i.manufacture_year)}</td></tr>
      <tr><td>Xuất phát từ bãi</td><td>${esc(i.from_warehouse_name || "—")}</td></tr>
      <tr><td>Thời gian thuê theo hợp đồng</td><td>${dmy(c.start_date)} – ${dmy(c.end_date)} (${c.pricing_type === "DAY" ? "tính theo ngày" : `tính theo giờ, dự kiến ${num(i.planned_duration)} giờ`})</td></tr>
    </table>

    <h2>2. Tình trạng thiết bị khi bàn giao</h2>
    <table class="kv">
      <tr><td>Số giờ máy (đồng hồ) lúc giao</td><td><b>${num(i.handover_hours)} giờ</b></td></tr>
      <tr><td>Mức nhiên liệu</td><td>${i.handover_fuel !== null && i.handover_fuel !== undefined ? `${i.handover_fuel}%` : "—"}</td></tr>
      <tr><td>Phụ kiện kèm theo</td><td>${esc(i.handover_accessories || "—")}</td></tr>
      <tr><td>Tình trạng máy</td><td>${esc(i.handover_condition || "Hoạt động bình thường")}</td></tr>
    </table>
    ${i.handover_meter_photo ? `<div class="photo"><img src="${absUrl(i.handover_meter_photo)}" alt="Ảnh đồng hồ giờ máy"><div>Ảnh chụp đồng hồ giờ máy lúc bàn giao</div></div>` : ""}

    <p>Bên B đã kiểm tra, nhận đủ thiết bị đúng tình trạng nêu trên và chịu trách nhiệm bảo quản, sử dụng thiết bị theo hợp đồng kể từ thời điểm nhận.</p>
    <p>Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản.</p>
    ${signs(["Bên giao", "(Ký, ghi rõ họ tên)", i.handed_by_name], ["Bên nhận", "(Ký, ghi rõ họ tên)", i.receiver_name])}`;
}

// ===================== BIÊN BẢN THU HỒI =====================
function returnBody(c, i) {
  const cu = c.customer;
  const used = Math.round((Number(i.return_hours) - Number(i.handover_hours)) * 10) / 10;
  const allowed = c.pricing_type === "DAY" ? 8 * Number(i.planned_duration) : Number(i.planned_duration);
  const actualOver = Math.round(Math.max(0, used - allowed) * 10) / 10;
  const billed = Number(i.overtime_hours);
  const extra = Number(i.overtime_fee);
  return `
    ${header(i.returned_at)}
    <h1>Biên bản thu hồi thiết bị</h1>
    <div class="no">Số: ${esc(i.return_no)}</div>
    <p class="base">– Căn cứ Hợp đồng cho thuê thiết bị số ${esc(c.contract_no)}/HĐTB-COMACPRO;</p>
    <p class="base">– Căn cứ Biên bản bàn giao thiết bị số ${esc(i.handover_no)} ngày ${dmy(i.handover_at)}.</p>
    <p>Hôm nay, vào lúc ${hm(i.returned_at)} ${dayText(i.returned_at)}, chúng tôi gồm:</p>
    ${partyB("BÊN TRẢ (Bên thuê)", cu)}
    ${partyA("BÊN NHẬN (Bên cho thuê)", `<p>Người nhận: Ông/Bà <b>${esc(i.received_by_name)}</b> – nhân viên ${esc(COMPANY.name)}</p>`)}
    <p>Hai bên tiến hành thu hồi thiết bị và xác nhận như sau:</p>

    <h2>1. Thông tin thiết bị</h2>
    <table class="kv">
      <tr><td>Tên thiết bị</td><td>${equipmentName(i)}</td></tr>
      <tr><td>Số serial (số khung) / Năm sản xuất</td><td>${esc(i.serial_number)} / ${esc(i.manufacture_year)}</td></tr>
      <tr><td>Nhận về bãi</td><td>${esc(i.to_warehouse_name || "—")}</td></tr>
    </table>

    <h2>2. Số giờ máy và tình trạng khi thu hồi</h2>
    <table class="kv">
      <tr><td>Số giờ máy lúc bàn giao</td><td>${num(i.handover_hours)} giờ</td></tr>
      <tr><td>Số giờ máy lúc thu hồi</td><td><b>${num(i.return_hours)} giờ</b></td></tr>
      <tr><td>Số giờ đã sử dụng</td><td>${num(used)} giờ (được phép ${num(allowed)} giờ)${
        billed > 0 ? ` – vượt ${num(actualOver)} giờ${actualOver !== billed ? `, làm tròn lên ${num(billed)} giờ` : ""}` : ""
      }</td></tr>
      ${Number(i.late_days) > 0 ? `<tr><td>Trả sau ngày kết thúc hợp đồng</td><td>${num(i.late_days)} ngày (giờ máy chạy thêm đã tính vào phí vượt giờ)</td></tr>` : ""}
      <tr><td>Mức nhiên liệu</td><td>${i.return_fuel !== null && i.return_fuel !== undefined ? `${i.return_fuel}%` : "—"}</td></tr>
      <tr><td>Tình trạng máy</td><td>${esc(i.return_condition || (i.is_damaged ? "Hư hỏng" : "Hoạt động bình thường"))}</td></tr>
      <tr><td>Hư hỏng</td><td>${i.is_damaged ? `Có – ${esc(i.damage_description || "")}` : "Không"}</td></tr>
    </table>
    <div class="photos">
      ${i.handover_meter_photo ? `<div class="photo"><img src="${absUrl(i.handover_meter_photo)}" alt=""><div>Đồng hồ giờ máy lúc bàn giao</div></div>` : ""}
      ${i.return_meter_photo ? `<div class="photo"><img src="${absUrl(i.return_meter_photo)}" alt=""><div>Đồng hồ giờ máy lúc thu hồi</div></div>` : ""}
    </div>

    <h2>3. Chi phí phát sinh của thiết bị này (chưa gồm thuế GTGT)</h2>
    <table class="kv">
      <tr><td>Phí vượt giờ (${num(i.overtime_hours)} giờ × ${num(i.hourly_rate)} đồng)</td><td class="r">${money(i.overtime_fee)}</td></tr>
      <tr><td>Tiền bồi thường hư hỏng</td><td class="r">${money(i.compensation_amount)}</td></tr>
      <tr class="total"><td>Cộng chi phí phát sinh</td><td class="r">${money(extra + Number(i.compensation_amount))}</td></tr>
    </table>
    <p>Các khoản trên được tổng hợp vào biên bản quyết toán hợp đồng ${esc(c.contract_no)}.</p>
    <p>Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản.</p>
    ${signs(["Bên trả", "(Ký, ghi rõ họ tên)", cu.representative], ["Bên nhận", "(Ký, ghi rõ họ tên)", i.received_by_name])}`;
}

// ----- Hàm gọi từ giao diện: trả về { title, html } để hiện trong PrintPreview -----
export async function contractDoc(contractId) {
  const c = await api.get(`/contracts/${contractId}`);
  const title = `Hợp đồng ${c.contract_no}${c.settlement?.confirmed_at ? " & biên bản quyết toán" : ""}`;
  return { title, html: page(title, contractBody(c), { draft: !c.deposit_paid_at }) };
}

// kind: "handover" | "return"; ticketNo: số phiếu (BG-… / TH-…)
export async function ticketDoc(contractId, kind, ticketNo) {
  const isReturn = kind === "return";
  const c = await api.get(`/contracts/${contractId}`);
  const item = c.items.find((x) => (isReturn ? x.return_no : x.handover_no) === ticketNo);
  if (!item) throw new Error(`Không tìm thấy phiếu ${ticketNo}.`);
  const title = `${isReturn ? "Biên bản thu hồi" : "Biên bản bàn giao"} ${ticketNo}`;
  return { title, html: page(title, isReturn ? returnBody(c, item) : handoverBody(c, item)) };
}
