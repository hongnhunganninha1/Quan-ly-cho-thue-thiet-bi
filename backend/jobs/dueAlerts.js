// Thông báo trên chuông: TÍNH TRỰC TIẾP từ hợp đồng mỗi lần mở / tải lại (không lưu bảng thông báo riêng),
// nên luôn khớp với tình trạng hợp đồng hiện tại – hợp đồng đã xử lý xong thì thông báo tự biến mất.
//   - Sắp đến hạn / quá hạn trả máy (mọi người thấy): hợp đồng đang thuê còn ≤ 3 ngày đến ngày kết thúc
//     hoặc đã quá ngày kết thúc mà còn máy chưa thu hồi.
//   - Hợp đồng mới chờ duyệt, nhắc duyệt (chỉ Quản lý): theo submitted_at / reminded_at của hợp đồng.
//   - Hợp đồng đã được duyệt (còn chờ đặt cọc, trong 7 ngày) / bị từ chối (gửi người lập).
//   - Nhắc khách đặt cọc (gửi người lập), quá hạn đặt cọc (gửi Quản lý): 3 ngày kể từ lúc duyệt.
//   - Cần bàn giao máy (gửi người lập): đã cọc, ngày bắt đầu là hôm nay / ngày mai / đã qua mà còn máy chưa giao.
//   - Cần quyết toán (gửi người lập): đã thu hồi đủ máy mà chưa quyết toán.
// Mỗi thông báo có id cố định theo (loại, hợp đồng, mốc thời gian); cảnh báo theo ngày có thêm ngày hôm nay
// nên mỗi sáng hiện lại thành "chưa đọc". Trạng thái đã đọc do trình duyệt lưu (frontend/src/App.jsx).
const pool = require("../config/db");

const DUE_SOON_DAYS = 3;
const DEPOSIT_DAYS = 3; // hạn đặt cọc tính từ lúc duyệt (giống contract.routes.js)
const RECENT_DAYS = 7; // tin "đã được duyệt" hiện trong 7 ngày (khi hợp đồng còn chờ đặt cọc)
const fmtDate = (d) => new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

const TITLES = {
  DUE_SOON: "Hợp đồng sắp đến hạn trả máy",
  OVERDUE: "Hợp đồng quá hạn chưa thu hồi",
  APPROVAL_REMINDER: "Nhắc duyệt hợp đồng",
  APPROVAL_REQUEST: "Hợp đồng mới chờ duyệt",
  CONTRACT_APPROVED: "Hợp đồng đã được duyệt",
  CONTRACT_REJECTED: "Hợp đồng bị từ chối",
  DEPOSIT_DUE: "Nhắc khách đặt cọc",
  DEPOSIT_OVERDUE: "Hợp đồng quá hạn đặt cọc",
  HANDOVER_DUE: "Hợp đồng cần bàn giao máy",
  SETTLEMENT_DUE: "Hợp đồng cần quyết toán",
};
// Bấm vào thông báo thì mở trang nào (key của menu bên frontend)
const TARGETS = {
  DUE_SOON: "rent-contract:ACTIVE",
  OVERDUE: "rent-return",
  APPROVAL_REMINDER: "rent-contract:PENDING_APPROVAL",
  APPROVAL_REQUEST: "rent-contract:PENDING_APPROVAL",
  CONTRACT_APPROVED: "rent-contract:APPROVED",
  CONTRACT_REJECTED: "rent-contract:DRAFT",
  DEPOSIT_DUE: "rent-contract:APPROVED",
  DEPOSIT_OVERDUE: "rent-contract:APPROVED",
  HANDOVER_DUE: "rent-handover",
  SETTLEMENT_DUE: "rent-return:settle",
};

const stamp = (d) => new Date(d).getTime();

// Danh sách thông báo của một tài khoản (mới nhất trước, tối đa 50)
async function buildNotifications(user) {
  const isAdmin = user.role === "ADMIN";
  const todayKey = new Date().toLocaleDateString("sv"); // yyyy-mm-dd
  const today = `${todayKey} 00:00:00`; // cảnh báo theo ngày: mốc đầu ngày (cùng dạng chuỗi ngày giờ MySQL trả về)
  const list = [];
  // forUser: chỉ người lập hợp đồng thấy; forAdmin: chỉ Quản lý thấy; không ghi gì: mọi người thấy
  const add = (type, c, message, createdAt, key, { forUser = null, forAdmin = false } = {}) => {
    if (forAdmin && !isAdmin) return;
    if (forUser !== null && forUser !== user.id) return;
    list.push({
      id: `${type}-${c.id}-${key}`,
      title: TITLES[type],
      message,
      createdAt,
      target: TARGETS[type],
    });
  };

  // 1. Sắp đến hạn / quá hạn trả máy (dựa vào ngày kết thúc của hợp đồng)
  const [due] = await pool.query(
    `SELECT rc.id, rc.contract_no, DATEDIFF(rc.end_date, CURDATE()) AS days_left, COUNT(cd.id) AS unreturned
       FROM rental_contracts rc
       JOIN contract_details cd ON cd.contract_id = rc.id AND cd.status = 'HANDED_OVER'
      WHERE rc.status = 'ACTIVE' AND rc.end_date <= CURDATE() + INTERVAL ? DAY
      GROUP BY rc.id`,
    [DUE_SOON_DAYS]
  );
  for (const c of due) {
    const d = Number(c.days_left);
    const message =
      d < 0
        ? `${c.contract_no} đã quá hạn ${-d} ngày, còn ${c.unreturned} máy chưa thu hồi`
        : d === 0
          ? `${c.contract_no} đến hạn trả ${c.unreturned} máy hôm nay`
          : `${c.contract_no} còn ${d} ngày đến hạn trả ${c.unreturned} máy`;
    add(d < 0 ? "OVERDUE" : "DUE_SOON", c, message, today, todayKey);
  }

  // 2. Chờ duyệt / nhắc duyệt (Quản lý) – chỉ hợp đồng do nhân viên lập
  if (isAdmin) {
    const [pending] = await pool.query(
      `SELECT rc.id, rc.contract_no, rc.submitted_at, rc.reminded_at, rc.updated_at, em.full_name AS creator_name,
              cu.name AS customer_name
         FROM rental_contracts rc
         JOIN customers cu ON cu.id = rc.customer_id
         JOIN users u      ON u.id = rc.created_by
         JOIN roles r      ON r.id = u.role_id
         JOIN employees em ON em.id = u.employee_id
        WHERE rc.status = 'PENDING_APPROVAL' AND r.code <> 'ADMIN'`
    );
    for (const c of pending) {
      const sent = c.submitted_at || c.updated_at;
      add("APPROVAL_REQUEST", c, `${c.creator_name} gửi duyệt hợp đồng ${c.contract_no} (${c.customer_name})`, sent, stamp(sent));
      if (c.reminded_at && stamp(c.reminded_at) >= stamp(sent)) {
        const waited = Math.floor((Date.now() - stamp(sent)) / 86400000);
        add("APPROVAL_REMINDER", c,
          `${c.creator_name} nhắc duyệt ${c.contract_no}` + (waited > 0 ? ` (đã chờ ${waited} ngày)` : ""),
          c.reminded_at, stamp(c.reminded_at));
      }
    }
  }

  // 3. Đã được duyệt (trong 7 ngày) / bị từ chối → người lập (Quản lý tự lập tự duyệt thì không cần báo)
  const [decided] = await pool.query(
    `SELECT rc.id, rc.contract_no, rc.status, rc.created_by, rc.approved_by, rc.approved_at, rc.reject_reason, rc.updated_at
       FROM rental_contracts rc
      WHERE rc.created_by = ?
        AND ((rc.status = 'APPROVED' AND rc.deposit_paid_at IS NULL AND rc.approved_at >= NOW() - INTERVAL ? DAY AND rc.approved_by <> rc.created_by)
             OR rc.status = 'REJECTED')`,
    [user.id, RECENT_DAYS]
  );
  for (const c of decided) {
    if (c.status === "REJECTED") {
      if (isAdmin) continue; // Quản lý tự từ chối hợp đồng của mình thì không cần báo
      add("CONTRACT_REJECTED", c, `Hợp đồng ${c.contract_no} bị từ chối. Lý do: ${c.reject_reason || "—"}`, c.updated_at,
        stamp(c.updated_at), { forUser: c.created_by });
    } else if (c.approved_at) {
      add("CONTRACT_APPROVED", c,
        `Hợp đồng ${c.contract_no} đã được duyệt, vui lòng nhắc khách đặt cọc trong ${DEPOSIT_DAYS} ngày.`,
        c.approved_at, stamp(c.approved_at), { forUser: c.created_by });
    }
  }

  // 4. Đã duyệt mà chưa đặt cọc: nhắc người lập khi còn ≤ 1 ngày; quá hạn thì báo thêm Quản lý
  const [deposits] = await pool.query(
    `SELECT rc.id, rc.contract_no, rc.created_by, cu.name AS customer_name,
            TIMESTAMPDIFF(HOUR, NOW(), rc.approved_at + INTERVAL ? DAY) AS hours_left
       FROM rental_contracts rc JOIN customers cu ON cu.id = rc.customer_id
      WHERE rc.status = 'APPROVED' AND rc.deposit_paid_at IS NULL
        AND rc.approved_at + INTERVAL ? DAY <= NOW() + INTERVAL 1 DAY`,
    [DEPOSIT_DAYS, DEPOSIT_DAYS]
  );
  for (const c of deposits) {
    const h = Number(c.hours_left);
    if (h > 0) {
      const left = h >= 24 ? "còn 1 ngày" : `còn ${h} giờ`;
      add("DEPOSIT_DUE", c, `${c.contract_no} (${c.customer_name}) ${left} là hết hạn đặt cọc, vui lòng nhắc khách`,
        today, todayKey, { forUser: c.created_by });
    } else {
      const late = Math.max(1, Math.ceil(-h / 24));
      add("DEPOSIT_DUE", c, `${c.contract_no} (${c.customer_name}) đã quá hạn đặt cọc ${late} ngày, vui lòng liên hệ khách`,
        today, todayKey, { forUser: c.created_by });
      add("DEPOSIT_OVERDUE", c, `${c.contract_no} (${c.customer_name}) quá hạn đặt cọc ${late} ngày, xem xét huỷ hợp đồng`,
        today, todayKey, { forAdmin: true });
    }
  }

  // 5. Đã đặt cọc, đến (hoặc qua) ngày bắt đầu mà còn máy chưa bàn giao → nhắc người lập đi bàn giao
  const [handovers] = await pool.query(
    `SELECT rc.id, rc.contract_no, rc.created_by, rc.start_date, cu.name AS customer_name,
            DATEDIFF(rc.start_date, CURDATE()) AS days_left, COUNT(cd.id) AS pending
       FROM rental_contracts rc
       JOIN customers cu ON cu.id = rc.customer_id
       JOIN contract_details cd ON cd.contract_id = rc.id AND cd.status = 'PENDING'
      WHERE rc.status IN ('APPROVED','ACTIVE') AND rc.deposit_paid_at IS NOT NULL
        AND rc.start_date <= CURDATE() + INTERVAL 1 DAY
      GROUP BY rc.id`
  );
  for (const c of handovers) {
    const d = Number(c.days_left);
    const when = d === 1 ? `bắt đầu ngày mai (${fmtDate(c.start_date)})` : d === 0 ? "bắt đầu hôm nay" : `đã qua ngày bắt đầu ${-d} ngày`;
    add("HANDOVER_DUE", c, `${c.contract_no} (${c.customer_name}) ${when}, còn ${c.pending} máy chưa bàn giao`,
      today, todayKey, { forUser: c.created_by });
  }

  // 6. Đã thu hồi đủ máy (Chờ quyết toán) mà chưa quyết toán → nhắc người lập
  const [settles] = await pool.query(
    `SELECT rc.id, rc.contract_no, rc.created_by, cu.name AS customer_name,
            MAX(r.returned_at) AS last_return, DATEDIFF(CURDATE(), DATE(MAX(r.returned_at))) AS days_waited
       FROM rental_contracts rc
       JOIN customers cu ON cu.id = rc.customer_id
       JOIN contract_details cd ON cd.contract_id = rc.id
       JOIN equipment_returns r ON r.contract_detail_id = cd.id
      WHERE rc.status = 'COMPLETED'
        AND NOT EXISTS (SELECT 1 FROM settlements s WHERE s.contract_id = rc.id)
      GROUP BY rc.id`
  );
  for (const c of settles) {
    const d = Math.max(0, Number(c.days_waited));
    const since = d === 0 ? "hôm nay" : `từ ${fmtDate(c.last_return)} (${d} ngày)`;
    add("SETTLEMENT_DUE", c, `${c.contract_no} (${c.customer_name}) đã thu hồi đủ máy ${since}, vui lòng quyết toán với khách`,
      today, todayKey, { forUser: c.created_by });
  }

  return list.sort((a, b) => stamp(b.createdAt) - stamp(a.createdAt)).slice(0, 50);
}

module.exports = { buildNotifications };
