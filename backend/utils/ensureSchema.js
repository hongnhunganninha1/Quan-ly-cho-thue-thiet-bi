// Tự bổ sung các cột mới khi CSDL đang dùng được tạo từ bản SQL cũ,
// để không phải xoá CSDL tạo lại (mất dữ liệu) mỗi lần hệ thống thêm chức năng.
const pool = require("../config/db");

const COLUMNS = [
  // [bảng, cột, định nghĩa cột]
  ["equipment_categories", "parent_id", "INT NULL COMMENT 'NULL = nhóm (cấp 1); có giá trị = loại (cấp 2)' AFTER id"],
  ["employees", "avatar_url", "VARCHAR(255) NULL AFTER address"],
  ["customers", "status", "ENUM('ACTIVE','STOPPED') NOT NULL DEFAULT 'ACTIVE'"],
  ["equipments", "item_condition", "ENUM('NEW','USED') NOT NULL DEFAULT 'USED' AFTER manufacture_year"],
  ["rental_contracts", "submitted_at", "DATETIME NULL COMMENT 'Thời điểm gửi duyệt' AFTER status"],
  ["rental_contracts", "reminded_at", "DATETIME NULL COMMENT 'Lần gần nhất nhân viên bấm Nhắc duyệt' AFTER submitted_at"],
  ["equipments", "status_note", "VARCHAR(200) NULL COMMENT 'Lý do ngừng hoạt động / thanh lý' AFTER status"],
  ["handovers", "meter_photo_url", "VARCHAR(255) NULL COMMENT 'Ảnh chụp đồng hồ giờ máy lúc giao' AFTER operating_hours"],
  ["equipment_returns", "meter_photo_url", "VARCHAR(255) NULL COMMENT 'Ảnh chụp đồng hồ giờ máy lúc nhận' AFTER operating_hours"],
];

// Độ dài cột đã rà soát lại cho sát thực tế (VD: họ tên người 50 ký tự, số điện thoại 11, mã số thuế 14)
// [bảng, cột, độ dài mới, định nghĩa đầy đủ]
const COLUMN_SIZES = [
  ["roles", "code", 10, "VARCHAR(10) NOT NULL"],
  ["roles", "name", 50, "VARCHAR(50) NOT NULL"],
  ["departments", "code", 10, "VARCHAR(10) NOT NULL"],
  ["employees", "code", 10, "VARCHAR(10) NOT NULL"],
  ["employees", "full_name", 50, "VARCHAR(50) NOT NULL"],
  ["employees", "id_number", 12, "VARCHAR(12) NULL"],
  ["employees", "phone", 11, "VARCHAR(11) NULL"],
  ["employees", "position", 50, "VARCHAR(50) NULL"],
  ["users", "password_hash", 60, "CHAR(60) NOT NULL COMMENT 'bcrypt hash, always 60 characters'"],
  ["customers", "code", 10, "VARCHAR(10) NOT NULL"],
  ["customers", "id_number", 14, "VARCHAR(14) NOT NULL COMMENT 'COMPANY: tax code; INDIVIDUAL: citizen ID (CCCD)'"],
  ["customers", "representative", 50, "VARCHAR(50) NOT NULL COMMENT 'INDIVIDUAL: same as name'"],
  ["customers", "representative_title", 50, "VARCHAR(50) NULL"],
  ["customers", "phone", 11, "VARCHAR(11) NOT NULL"],
  ["customers", "bank_account", 20, "VARCHAR(20) NULL"],
  ["warehouses", "code", 10, "VARCHAR(10) NOT NULL"],
  ["equipment_categories", "code", 10, "VARCHAR(10) NOT NULL"],
  ["brands", "name", 50, "VARCHAR(50) NOT NULL"],
  ["equipments", "code", 15, "VARCHAR(15) NOT NULL COMMENT 'SKU + yy + mm + 4-digit sequence, e.g. SKU26070001'"],
  ["equipments", "model", 50, "VARCHAR(50) NOT NULL"],
  ["equipments", "status_note", 255, "VARCHAR(255) NULL COMMENT 'Reason for INACTIVE / LIQUIDATED (current status only)'"],
  ["departments", "name", 50, "VARCHAR(50) NOT NULL"],
  ["equipments", "serial_number", 50, "VARCHAR(50) NOT NULL"],
  ["equipments", "engine_number", 50, "VARCHAR(50) NULL"],
  ["equipment_documents", "doc_number", 50, "VARCHAR(50) NULL"],
  ["rental_contracts", "contract_no", 20, "VARCHAR(20) NOT NULL COMMENT 'e.g. HD-2026-0001 (sequence restarts every year)'"],
  ["handovers", "handover_no", 20, "VARCHAR(20) NOT NULL COMMENT 'e.g. BG-2026-0001 (sequence restarts every year)'"],
  ["handovers", "receiver_name", 50, "VARCHAR(50) NOT NULL"],
  ["handovers", "receiver_phone", 11, "VARCHAR(11) NULL"],
  ["equipment_returns", "return_no", 20, "VARCHAR(20) NOT NULL COMMENT 'e.g. TH-2026-0001 (sequence restarts every year)'"],
];

// Ràng buộc kiểm tra dữ liệu (CHECK) bổ sung: số không âm, tỉ lệ 0–100 %, định dạng số điện thoại / CCCD…
// [bảng, tên ràng buộc, điều kiện]
const CHECKS = [
  ["employees", "chk_emp_id_number", "id_number REGEXP '^[0-9]{12}$'"],
  ["employees", "chk_emp_phone", "phone REGEXP '^0[0-9]{9,10}$'"],
  ["employees", "chk_emp_hire_date", "hire_date IS NULL OR date_of_birth IS NULL OR hire_date >= date_of_birth"],
  ["users", "chk_user_failed", "failed_login_count BETWEEN 0 AND 5"],
  ["customers", "chk_cus_phone", "phone REGEXP '^0[0-9]{9,10}$'"],
  ["warehouses", "chk_wh_area", "area_m2 IS NULL OR area_m2 > 0"],
  ["warehouses", "chk_wh_capacity", "capacity IS NULL OR capacity > 0"],
  ["equipments", "chk_eq_year", "manufacture_year BETWEEN 1950 AND 2100"],
  ["equipments", "chk_eq_hours", "operating_hours >= 0"],
  ["equipments", "chk_eq_price", "purchase_price IS NULL OR purchase_price >= 0"],
  ["equipment_documents", "chk_doc_dates", "expiry_date IS NULL OR issued_date IS NULL OR expiry_date >= issued_date"],
  ["rental_contracts", "chk_rc_rates", "discount_rate BETWEEN 0 AND 100 AND vat_rate BETWEEN 0 AND 100"],
  ["rental_contracts", "chk_rc_amounts", "subtotal >= 0 AND transport_fee >= 0 AND discount_amount >= 0 AND vat_amount >= 0 AND total_amount >= 0 AND (deposit_amount IS NULL OR deposit_amount >= 0)"],
  ["contract_details", "chk_cd_values", "unit_price > 0 AND hourly_rate > 0 AND planned_duration > 0 AND amount >= 0"],
  ["handovers", "chk_ho_hours", "operating_hours >= 0"],
  ["equipment_returns", "chk_ret_values", "operating_hours >= 0 AND rental_amount >= 0 AND late_days >= 0 AND late_fee >= 0 AND overtime_hours >= 0 AND overtime_fee >= 0 AND compensation_amount >= 0"],
  ["settlements", "chk_st_values", "rental_total >= 0 AND late_fee_total >= 0 AND overtime_fee_total >= 0 AND compensation_total >= 0 AND vat_amount >= 0 AND deposit_amount >= 0 AND paid_amount >= 0"],
];

// Lịch sử sửa giá thuê: bảng ghi vết (audit), không phải thực thể nghiệp vụ nên không vẽ trên ERD
const PRICE_HISTORY_SQL = `
  CREATE TABLE equipment_price_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    equipment_id    INT NOT NULL,
    old_hourly_rate DECIMAL(15,0) NULL COMMENT 'NULL = first price set',
    old_daily_rate  DECIMAL(15,0) NULL,
    new_hourly_rate DECIMAL(15,0) NOT NULL,
    new_daily_rate  DECIMAL(15,0) NOT NULL,
    reason          VARCHAR(255) NULL,
    changed_by      INT NULL,
    changed_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ph_eq   FOREIGN KEY (equipment_id) REFERENCES equipments(id) ON DELETE CASCADE,
    CONSTRAINT fk_ph_user FOREIGN KEY (changed_by)   REFERENCES users(id),
    INDEX idx_ph_eq_time (equipment_id, changed_at)
  ) COMMENT='Rental price change history (audit log)'`;

const REPORT_VIEW_SQL = `
  CREATE OR REPLACE VIEW v_report_equipment_status AS
  SELECT g.id AS group_id, g.code AS group_code, g.name AS group_name,
         c.id AS category_id, c.code AS category_code, c.name AS category_name,
         COUNT(e.id) AS total,
         SUM(e.status = 'AVAILABLE') AS available,
         SUM(e.status = 'RESERVED')  AS reserved,
         SUM(e.status = 'RENTED')    AS rented,
         SUM(e.status = 'INACTIVE')  AS inactive
    FROM equipment_categories c
    JOIN equipment_categories g ON g.id = c.parent_id
    JOIN equipments e ON e.category_id = c.id AND e.status <> 'LIQUIDATED'
   GROUP BY g.id, g.code, g.name, c.id, c.code, c.name`;

async function ensureSchema() {
  for (const [table, column, definition] of COLUMNS) {
    const [[found]] = await pool.query(
      `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (found.total === 0) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      console.log(`Đã thêm cột ${table}.${column} vào CSDL.`);
    }
  }
  // Khách hàng: gộp MST (tax_code) và CCCD (id_number) thành 1 cột id_number; cá nhân thì người đại diện = tên
  const [[taxCol]] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'tax_code'`
  );
  if (taxCol.total > 0) {
    await pool.query("ALTER TABLE customers DROP CONSTRAINT chk_cus_identity").catch(() => {});
    await pool.query("UPDATE customers SET id_number = tax_code WHERE customer_type = 'COMPANY'");
    await pool.query("UPDATE customers SET representative = name WHERE customer_type = 'INDIVIDUAL' OR representative IS NULL OR representative = ''");
    await pool.query("ALTER TABLE customers DROP COLUMN tax_code");
    await pool.query(
      `ALTER TABLE customers
         MODIFY id_number VARCHAR(20) NOT NULL COMMENT 'COMPANY: tax code; INDIVIDUAL: citizen ID (CCCD)',
         MODIFY representative VARCHAR(100) NOT NULL COMMENT 'INDIVIDUAL: same as name',
         ADD CONSTRAINT chk_cus_identity CHECK (
           (customer_type = 'COMPANY'    AND id_number REGEXP '^[0-9]{10}(-[0-9]{3})?$') OR
           (customer_type = 'INDIVIDUAL' AND id_number REGEXP '^[0-9]{12}$'))`
    );
    console.log("Đã gộp Mã số thuế và CCCD của khách hàng thành cột id_number.");
  }

  // Tài khoản: bỏ cột username, đăng nhập bằng email công ty của nhân viên (employees.email)
  const [[userCol]] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username'`
  );
  if (userCol.total > 0) {
    // Nhân viên có tài khoản mà chưa có email thì tạm lấy tên đăng nhập cũ + @comacpro.com
    await pool.query(
      `UPDATE employees e JOIN users u ON u.employee_id = e.id
          SET e.email = CONCAT(u.username, '@comacpro.com')
        WHERE e.email IS NULL OR e.email = ''`
    );
    await pool.query("ALTER TABLE users DROP COLUMN username");
    console.log("Đã chuyển tài khoản sang đăng nhập bằng email công ty.");
  }

  // Thu gọn độ dài cột; dữ liệu đang có dài hơn độ dài mới thì bỏ qua cột đó (không làm mất dữ liệu)
  for (const [table, column, size, definition] of COLUMN_SIZES) {
    const [[col]] = await pool.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS len, DATA_TYPE AS type FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    const wantType = definition.startsWith("CHAR") ? "char" : "varchar";
    if (!col || (Number(col.len) === size && col.type === wantType)) continue;
    const [[{ longest }]] = await pool.query(`SELECT COALESCE(MAX(CHAR_LENGTH(${column})), 0) AS longest FROM ${table}`);
    if (longest > size) {
      console.log(`Chưa thu gọn ${table}.${column} xuống ${size} ký tự vì đang có dữ liệu dài ${longest} ký tự.`);
      continue;
    }
    await pool.query(`ALTER TABLE ${table} MODIFY ${column} ${definition}`);
    console.log(`Đã đổi độ dài cột ${table}.${column} thành ${size} ký tự.`);
  }

  // Năm sản xuất bắt buộc nhập (form đã bắt buộc, CSDL cũ còn cho NULL)
  const [[year]] = await pool.query(
    `SELECT IS_NULLABLE AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'equipments' AND COLUMN_NAME = 'manufacture_year'`
  );
  if (year?.n === "YES") {
    const [[{ missing }]] = await pool.query("SELECT COUNT(*) AS missing FROM equipments WHERE manufacture_year IS NULL");
    if (missing === 0) await pool.query("ALTER TABLE equipments MODIFY manufacture_year SMALLINT NOT NULL");
  }

  // Thêm các ràng buộc CHECK còn thiếu; dữ liệu cũ không thoả thì bỏ qua và báo ra màn hình
  for (const [table, name, condition] of CHECKS) {
    const [[found]] = await pool.query(
      `SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
      [table, name]
    );
    if (found.total > 0) continue;
    try {
      await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK (${condition})`);
      console.log(`Đã thêm ràng buộc ${table}.${name}.`);
    } catch (err) {
      console.log(`Chưa thêm được ràng buộc ${table}.${name} (dữ liệu cũ chưa thoả): ${err.message}`);
    }
  }

  // Quản lý được duyệt hợp đồng do chính mình lập (mỗi phòng chỉ có một trưởng phòng) → bỏ ràng buộc cấm tự duyệt
  const [[selfApprove]] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'rental_contracts' AND CONSTRAINT_NAME = 'chk_rc_self_approve'`
  );
  if (selfApprove.total > 0) await pool.query("ALTER TABLE rental_contracts DROP CONSTRAINT chk_rc_self_approve");

  // Máy nằm trong hợp đồng chờ duyệt / đã duyệt (chưa bàn giao) mà vẫn "Sẵn sàng" (dữ liệu tạo trước khi
  // gửi duyệt có giữ chỗ) → chuyển sang "Đã giữ chỗ". Chạy lại nhiều lần cũng không đổi gì thêm.
  const [fixed] = await pool.query(
    `UPDATE equipments e SET e.status = 'RESERVED', e.status_note = NULL
      WHERE e.status = 'AVAILABLE' AND EXISTS (
        SELECT 1 FROM contract_details cd JOIN rental_contracts rc ON rc.id = cd.contract_id
         WHERE cd.equipment_id = e.id AND cd.status = 'PENDING' AND rc.status IN ('PENDING_APPROVAL','APPROVED'))`
  );
  if (fixed.affectedRows > 0) console.log(`Đã chuyển ${fixed.affectedRows} máy trong hợp đồng chờ duyệt sang Đã giữ chỗ.`);

  // Hợp đồng: bỏ "Tên công trình", "Địa chỉ công trình" đổi thành "Địa điểm nhận máy" (khớp ERD)
  const [siteCols] = await pool.query(
    `SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rental_contracts'
        AND COLUMN_NAME IN ('site_name', 'site_address', 'delivery_address')`
  );
  const hasCol = (n) => siteCols.some((c) => c.name === n);
  if (hasCol("site_address") && !hasCol("delivery_address")) {
    await pool.query(
      "ALTER TABLE rental_contracts CHANGE site_address delivery_address VARCHAR(255) NOT NULL COMMENT 'Địa điểm nhận máy'"
    );
  }
  if (hasCol("site_name")) await pool.query("ALTER TABLE rental_contracts DROP COLUMN site_name");

  // Cột refresh_token không dùng đến (đăng nhập dùng JWT có hạn) nên bỏ
  const [[rt]] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'refresh_token'`
  );
  if (rt.total > 0) await pool.query("ALTER TABLE users DROP COLUMN refresh_token");

  // Loại giấy tờ "Ảnh tem máy" (ảnh tem dùng để đọc model / số serial / số máy, lưu làm bằng chứng)
  const [[dt]] = await pool.query(
    `SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'equipment_documents' AND COLUMN_NAME = 'doc_type'`
  );
  if (dt && !dt.t.includes("NAMEPLATE")) {
    await pool.query(
      "ALTER TABLE equipment_documents MODIFY doc_type ENUM('PHOTO','NAMEPLATE','CUSTOMS','CO','CQ','REGISTRATION','INSPECTION','MANUAL','OTHER') NOT NULL COMMENT 'NAMEPLATE = photo of the nameplate used to read model / serial / engine number'"
    );
    console.log("Đã thêm loại giấy tờ Ảnh tem máy.");
  }

  // Bỏ bảng thông báo: thông báo được tính trực tiếp từ hợp đồng (jobs/dueAlerts.js)
  const [[nt]] = await pool.query(
    "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications'"
  );
  if (nt.total > 0) {
    await pool.query("DROP TABLE notifications");
    console.log("Đã bỏ bảng notifications (thông báo nay tính trực tiếp từ hợp đồng).");
  }

  // Bảng lịch sử sửa giá thuê. Tạo mới lần đầu thì ghi luôn giá hiện tại của các máy làm mốc ban đầu.
  const [[priceTable]] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'equipment_price_history'`
  );
  if (priceTable.total === 0) {
    await pool.query(PRICE_HISTORY_SQL);
    await pool.query(
      `INSERT INTO equipment_price_history (equipment_id, new_hourly_rate, new_daily_rate, reason, changed_at)
       SELECT id, hourly_rate, daily_rate, 'Giá đang áp dụng khi bắt đầu ghi lịch sử', NOW()
         FROM equipments WHERE daily_rate IS NOT NULL`
    );
    console.log("Đã tạo bảng equipment_price_history (lịch sử sửa giá thuê).");
  }
  // Giá ban đầu (dòng "đặt giá lần đầu" chưa ghi người sửa) → ghi là Quản lý Trần Minh Quân (quantm@comacpro.com),
  // không có tài khoản này thì lấy Quản lý đầu tiên
  const [[manager]] = await pool.query(
    `SELECT u.id FROM users u
       JOIN employees e ON e.id = u.employee_id
       JOIN roles r     ON r.id = u.role_id
      WHERE r.code = 'ADMIN'
      ORDER BY (e.email = 'quantm@comacpro.com') DESC, u.id
      LIMIT 1`
  );
  if (manager) {
    const [fixed] = await pool.query(
      "UPDATE equipment_price_history SET changed_by = ? WHERE changed_by IS NULL AND old_daily_rate IS NULL",
      [manager.id]
    );
    if (fixed.affectedRows > 0) console.log(`Đã ghi người nhập giá ban đầu cho ${fixed.affectedRows} dòng lịch sử giá.`);
  }

  // View báo cáo kiểm kê theo nhóm -> loại (CSDL tạo từ bản cũ chưa có cột group_id)
  const [[viewCol]] = await pool.query(
    `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'v_report_equipment_status' AND COLUMN_NAME = 'group_id'`
  );
  if (viewCol.total === 0) {
    await pool.query(REPORT_VIEW_SQL);
    console.log("Đã cập nhật view v_report_equipment_status (gom theo nhóm thiết bị).");
  }

  // Bỏ bảng lịch sử trạng thái thiết bị (và trigger ghi bảng đó) nếu CSDL còn từ bản cũ
  await pool.query("DROP TRIGGER IF EXISTS trg_equipment_status_log");
  await pool.query("DROP TABLE IF EXISTS equipment_status_logs");
}

module.exports = ensureSchema;
