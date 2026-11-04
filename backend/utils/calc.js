// Các công thức tính tiền của nghiệp vụ cho thuê (dùng chung cho hợp đồng, thu hồi, quyết toán)

// Không tính phí trễ hạn riêng: máy trả sau ngày kết thúc thì số giờ máy chạy thêm đã tính vào phí vượt giờ.
// Số ngày trả trễ (late_days) vẫn được ghi lại để theo dõi; late_fee luôn = 0.
const HOURS_PER_DAY = 8; // thuê theo ngày: mỗi ngày được chạy 8 giờ máy (1 ca), vượt thì tính phí vượt giờ
const MAX_HOURLY_DAYS = 2; // thuê theo giờ chỉ cho việc ngắn hạn: trong ngày hoặc tối đa 2 ngày; dài hơn thì thuê theo ngày
const MIN_HOURLY_HOURS = 4; // thuê theo giờ: mỗi máy tối thiểu 4 giờ (nửa ca) – công vận chuyển, lắp đặt máy không đáng cho thuê ít hơn

// Số ngày tính cả ngày đầu và ngày cuối: 01/07 → 10/07 = 10 ngày
function daysInclusive(startDate, endDate) {
  const a = Date.UTC(...String(startDate).slice(0, 10).split("-").map((v, i) => (i === 1 ? v - 1 : +v)));
  const b = Date.UTC(...String(endDate).slice(0, 10).split("-").map((v, i) => (i === 1 ? v - 1 : +v)));
  return Math.round((b - a) / 86400000) + 1;
}

// Tổng tiền hợp đồng.
// items: [{ amount }]; VAT tính trên (tiền thuê − chiết khấu + phí vận chuyển).
function contractTotals(items, { transport_fee = 0, discount_rate = 0, vat_rate = 10 }) {
  const subtotal = items.reduce((s, i) => s + Number(i.amount), 0);
  const discount_amount = Math.round((subtotal * discount_rate) / 100);
  const vat_amount = Math.round(((subtotal - discount_amount + Number(transport_fee)) * vat_rate) / 100);
  const total_amount = subtotal - discount_amount + Number(transport_fee) + vat_amount;
  return { subtotal, discount_amount, vat_amount, total_amount };
}

// Tính các khoản khi thu hồi một máy.
// d: dòng chi tiết hợp đồng kèm thông tin bàn giao (xem return.routes.js)
function returnFees(d, { returned_at, operating_hours, compensation_amount = 0 }) {
  const late_days = Math.max(0, daysInclusive(d.end_date, returned_at) - 1);
  const late_fee = 0; // không thu phí trễ hạn (đã tính qua phí vượt giờ)

  const usedHours = Math.max(0, Number(operating_hours) - Number(d.handover_hours));
  const allowedHours = d.pricing_type === "DAY" ? HOURS_PER_DAY * Number(d.planned_duration) : Number(d.planned_duration);
  // Giờ vượt thực tế (đồng hồ đo đến 0,1 giờ), sau đó LÀM TRÒN LÊN giờ chẵn: phần lẻ dưới 1 giờ tính là 1 giờ
  const actual_overtime = Math.round(Math.max(0, usedHours - allowedHours) * 10) / 10;
  const overtime_hours = Math.ceil(actual_overtime);
  const overtime_fee = Math.round(overtime_hours * d.hourly_rate);

  return {
    rental_amount: Number(d.amount),
    used_hours: Math.round(usedHours * 10) / 10,
    allowed_hours: allowedHours,
    actual_overtime,
    late_days,
    late_fee,
    overtime_hours,
    overtime_fee,
    compensation_amount: Math.round(Number(compensation_amount) || 0),
  };
}

// Tổng hợp quyết toán của một hợp đồng từ các phiếu thu hồi.
// VAT tính trên tiền thuê và các phí, không tính trên tiền bồi thường.
function settlementTotals(contract, returns) {
  const rental_total = Number(contract.total_amount) - Number(contract.vat_amount); // đã trừ chiết khấu, cộng vận chuyển
  const late_fee_total = returns.reduce((s, r) => s + Number(r.late_fee), 0);
  const overtime_fee_total = returns.reduce((s, r) => s + Number(r.overtime_fee), 0);
  const compensation_total = returns.reduce((s, r) => s + Number(r.compensation_amount), 0);
  const vat_amount = Math.round(((rental_total + late_fee_total + overtime_fee_total) * Number(contract.vat_rate)) / 100);
  const deposit_amount = Number(contract.deposit_amount || 0);
  const amount_due = rental_total + late_fee_total + overtime_fee_total + compensation_total + vat_amount - deposit_amount;
  return { rental_total, late_fee_total, overtime_fee_total, compensation_total, vat_amount, deposit_amount, amount_due };
}

// Trạng thái thanh toán. amount_due < 0: công ty phải hoàn lại cọc thừa cho khách.
function paymentStatus(amountDue, paidAmount) {
  if (amountDue === 0) return "PAID";
  if (amountDue < 0) return paidAmount >= -amountDue ? "REFUNDED" : "UNPAID";
  if (paidAmount <= 0) return "UNPAID";
  return paidAmount >= amountDue ? "PAID" : "PARTIAL";
}

module.exports = { daysInclusive, contractTotals, returnFees, settlementTotals, paymentStatus, HOURS_PER_DAY, MIN_HOURLY_HOURS, MAX_HOURLY_DAYS };
