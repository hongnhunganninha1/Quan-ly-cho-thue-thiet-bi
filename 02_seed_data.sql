-- =====================================================================
--  File 02: Initial data (run after 01_schema.sql)
--  Only master data: roles, departments, employees & accounts, warehouses, equipment categories, brands.
--  Company founded 14/08/2023: employee hire dates start from then.
--  Default passwords:  Manager -> Admin@123     Staff -> Nhanvien@123
-- =====================================================================
USE kltn_1;
SET NAMES utf8mb4;

-- ---------- Roles & departments ----------
INSERT INTO roles (id, code, name, description) VALUES
 (1, 'ADMIN', 'Quản lý',       'Toàn quyền: quản lý nhân viên & tài khoản, duyệt hợp đồng, thiết lập giá thuê, mọi nghiệp vụ và báo cáo'),
 (2, 'STAFF', 'Nhân viên',     'Mọi nghiệp vụ và báo cáo, trừ quản lý nhân viên/tài khoản và duyệt hợp đồng');

INSERT INTO departments (id, code, name) VALUES
 (1, 'BOD',     'Ban Giám đốc'),
 (2, 'IT_AI',   'Phòng IT-AI'),
 (3, 'MKT',     'Phòng Marketing'),
 (4, 'HCNS_KT', 'Phòng HCNS - Kế toán'),
 (5, 'KD_VH',   'Phòng Kinh doanh - Vận hành'),
 (6, 'XNK',     'Phòng Xuất nhập khẩu');

-- ---------- Employees & user accounts ----------
INSERT INTO employees (id, code, full_name, gender, date_of_birth, id_number, phone, email, department_id, position, hire_date, status) VALUES
 (1, 'NV0001', 'Đặng Việt Dũng',   'MALE',   '1977-09-20', '001075000111', '0903111222', 'dvd@comacpro.com',   1, 'Giám đốc',              '2023-08-14', 'WORKING'),
 (2, 'NV0004', 'Trần Minh Quân',  'MALE',   '1990-07-21', '001090000444', '0912456789', 'quantm@comacpro.com',  2, 'Trưởng phòng KD-VH',        '2023-09-04', 'WORKING'),
 (3, 'NV0012', 'Phạm Văn Dũng',   'MALE',   '1984-11-02', '001084001212', '0986234567', 'dungpv@comacpro.com',  5, 'Trưởng phòng IT-AI',    '2023-08-21', 'WORKING'),
 (4, 'NV0015', 'Nguyễn Văn An',   'MALE',   '1995-05-30', '001095001515', '0975345678', 'annv@comacpro.com',    5, 'Nhân viên kinh doanh',  '2024-03-01', 'WORKING'),
 (5, 'NV0017', 'Lê Thị Hương',    'FEMALE', '1996-09-14', '001196001717', '0968777123', 'huonglt@comacpro.com', 5, 'Nhân viên kinh doanh',    '2024-06-10', 'WORKING'),
 (6, 'NV0019', 'Hoàng Minh Tuấn', 'MALE',   '1993-01-08', '001093001919', '0934222111', 'tuanhm@comacpro.com',  5, 'Nhân viên vận hành',    '2024-10-21', 'WORKING'),
 (7, 'NV0020', 'Lê Thu Hà',       'FEMALE', '1988-12-25', '001188002020', '0904888999', 'halt@comacpro.com',    4, 'Trưởng phòng HCNS-KT',  '2023-08-28', 'WORKING'),
 (8, 'NV0031', 'Võ Thị Mai',      'FEMALE', '1999-04-18', '001199003131', '0917909212', 'maivt@comacpro.com',   5, 'Nhân viên kinh doanh',  '2026-09-01', 'WORKING');

-- Accounts log in with the employee's company email (employees.email)
INSERT INTO users (id, employee_id, password_hash, role_id, status, must_change_password, last_login_at) VALUES
 (1, 2, '$2b$10$to7KeNW5dQnWvHavsHcMkef8w3sdcbGHNoqGU3IGhocOpi6eCrRI6', 1, 'ACTIVE', FALSE, '2026-10-01 08:12:00'),
 (2, 3, '$2b$10$to7KeNW5dQnWvHavsHcMkef8w3sdcbGHNoqGU3IGhocOpi6eCrRI6', 1, 'ACTIVE', FALSE, '2026-10-01 08:05:00'),
 (3, 4, '$2b$10$rOyqsREgRdGds4GpbBoRwOxhcKXLSpqiDEuJnUhsmst0S8nCyU52O', 2, 'ACTIVE', FALSE, '2026-10-01 07:58:00'),
 (4, 5, '$2b$10$rOyqsREgRdGds4GpbBoRwOxhcKXLSpqiDEuJnUhsmst0S8nCyU52O', 2, 'ACTIVE', FALSE, '2026-09-30 17:40:00'),
 (5, 6, '$2b$10$rOyqsREgRdGds4GpbBoRwOxhcKXLSpqiDEuJnUhsmst0S8nCyU52O', 2, 'ACTIVE', FALSE, '2026-09-29 18:02:00');

-- ---------- Warehouses (equipment yards), categories, brands ----------
INSERT INTO warehouses (id, code, name, address, area_m2, capacity) VALUES
 (1, 'KB01', 'Bãi Long Biên', 'Số 12 Nguyễn Văn Linh, Long Biên, Hà Nội', 4500, 20),
 (2, 'KB02', 'Bãi Đông Dư',   'KCN Phú Thị, Gia Lâm, Hà Nội',             3800, 15),
 (3, 'KB03', 'Bãi Đông Anh',  'Xã Nguyên Khê, Đông Anh, Hà Nội',          5200, 25);

-- Equipment categories follow the comacpro.net marketplace:
--   group (level 1) = top-level marketplace category, type (level 2) = most detailed marketplace type.
--   description = the English name used on comacpro.net.
-- Level 1: groups (parent_id = NULL)
INSERT INTO equipment_categories (id, parent_id, code, name, description) VALUES
 (1, NULL, 'LD', 'Máy làm đất', 'Earthmoving Equipment'),
 (2, NULL, 'NN', 'Thiết bị nâng người', 'Aerial Platform'),
 (3, NULL, 'TN', 'Thiết bị nâng hạ', 'Lifting Equipment'),
 (4, NULL, 'XN', 'Thiết bị nâng chuyển hàng', 'Material Handling'),
 (5, NULL, 'MD', 'Thiết bị làm đường', 'Road Equipment'),
 (6, NULL, 'BT', 'Thiết bị bê tông', 'Concrete Equipment'),
 (7, NULL, 'KM', 'Thiết bị khai thác mỏ, đá & tái chế', 'Mining, Quarry & Recycling'),
 (8, NULL, 'CK', 'Thiết bị khoan & đóng cọc', 'Drilling & Piling'),
 (9, NULL, 'PT', 'Thiết bị phụ trợ công trường', 'Site Preparation & Utility Equipment'),
 (10, NULL, 'VC', 'Xe công trình & vận tải', 'Construction Vehicles & Transport'),
 (11, NULL, 'PK', 'Phụ kiện & phụ tùng', 'Accessories & Spare Parts'),
 (12, NULL, 'KH', 'Thiết bị khác', 'Miscellaneous Equipment');

-- Level 2: types (code = group code + '-' + abbreviation). Equipment is attached to level-2 types only.
INSERT INTO equipment_categories (id, parent_id, code, name, description) VALUES
 (101, 1, 'LD-DX', 'Máy đào bánh xích', 'Crawler / Tracked Excavator'),
 (102, 1, 'LD-DL', 'Máy đào bánh lốp', 'Wheel Excavator'),
 (103, 1, 'LD-DCD', 'Máy đào cần dài', 'Long Reach Excavator'),
 (104, 1, 'LD-DGD', 'Máy đào gầu dây', 'Dragline Excavator'),
 (105, 1, 'LD-DGT', 'Máy đào gầu thuận', 'Front Shovel Excavator'),
 (106, 1, 'LD-DM', 'Máy đào mini', 'Mini Excavator'),
 (107, 1, 'LD-XL', 'Máy xúc lật', 'Wheel Loader'),
 (108, 1, 'LD-XLM', 'Máy xúc lật mini', 'Skid Steer Loader'),
 (109, 1, 'LD-XLX', 'Máy xúc lật bánh xích', 'Crawler / Tracked Loader'),
 (110, 1, 'LD-DXL', 'Máy đào xúc liên hợp', 'Backhoe Loader'),
 (111, 1, 'LD-UX', 'Máy ủi bánh xích', 'Crawler / Tracked Bulldozer'),
 (112, 1, 'LD-UL', 'Máy ủi bánh lốp', 'Wheel Bulldozer'),
 (113, 1, 'LD-UM', 'Máy ủi mini', 'Mini / Compact Bulldozer'),
 (201, 2, 'NN-CN', 'Xe nâng người dạng cần', 'Boom Lift / Man Lift'),
 (202, 2, 'NN-CK', 'Xe nâng người cắt kéo', 'Scissor Lift'),
 (203, 2, 'NN-TD', 'Xe nâng người thẳng đứng', 'Vertical Man Lift'),
 (204, 2, 'NN-CNH', 'Xe nâng người chân nhện', 'Spider Lift'),
 (301, 3, 'TN-CTT', 'Cần trục tháp', 'Tower Crane'),
 (302, 3, 'TN-CCT', 'Cổng trục', 'Gantry Crane'),
 (303, 3, 'TN-CTR', 'Cầu trục', 'Bridge / Overhead Crane'),
 (304, 3, 'TN-CCX', 'Cần trục côngxon', 'Jib Crane'),
 (305, 3, 'TN-CX', 'Cần cẩu bánh xích', 'Crawler Crane'),
 (306, 3, 'TN-CL', 'Cần cẩu bánh lốp', 'Rough-terrain Crane'),
 (307, 3, 'TN-CDH', 'Cần cẩu đa địa hình', 'All-terrain Crane'),
 (308, 3, 'TN-XC', 'Xe cẩu', 'Truck Crane (Truck Mounted Crane)'),
 (309, 3, 'TN-XTC', 'Xe tải gắn cẩu', 'Telescopic Cargo / Loader Crane'),
 (310, 3, 'TN-CS', 'Cẩu sàn tự hành', 'Carry Deck Crane'),
 (311, 3, 'TN-XOL', 'Xe nâng ống lồng', 'Telehandler'),
 (401, 4, 'XN-DS', 'Xe nâng dầu', 'Diesel Forklift'),
 (402, 4, 'XN-XG', 'Xe nâng xăng / gas', 'Gasoline / LPG Forklift'),
 (403, 4, 'XN-DI', 'Xe nâng điện', 'Electric Forklift'),
 (404, 4, 'XN-CBD', 'Xe nâng cao bán tự động', 'Semi-electric Stacker'),
 (405, 4, 'XN-CT', 'Xe nâng cao dắt tay', 'Manual Stacker'),
 (406, 4, 'XN-CD', 'Xe nâng cao chạy điện', 'Electric Stacker'),
 (407, 4, 'XN-RT', 'Xe nâng tầm với', 'Reach Truck'),
 (408, 4, 'XN-TT', 'Xe nâng tay thấp', 'Hand Pallet Truck'),
 (409, 4, 'XN-TTD', 'Xe nâng tay thấp chạy điện', 'Electric Pallet Truck'),
 (501, 5, 'MD-LT', 'Máy lu tĩnh', 'Static Roller'),
 (502, 5, 'MD-LR', 'Máy lu rung', 'Vibrating Roller'),
 (503, 5, 'MD-LL', 'Máy lu lưới', 'Grid Roller'),
 (504, 5, 'MD-LCC', 'Máy lu chân cừu', 'Padfoot / Tamping Roller'),
 (505, 5, 'MD-LBL', 'Máy lu bánh lốp', 'Pneumatic Roller'),
 (506, 5, 'MD-SL', 'Máy san bánh lốp', 'Wheeled (Motor) Grader'),
 (507, 5, 'MD-SX', 'Máy san bánh xích', 'Tracked Grader'),
 (508, 5, 'MD-SM', 'Máy san mini', 'Mini / Compact Grader'),
 (509, 5, 'MD-RT', 'Máy rải thảm bê tông nhựa', 'Asphalt Paver'),
 (510, 5, 'MD-CB', 'Máy cào bóc mặt đường', 'Asphalt Cold Milling Machine'),
 (511, 5, 'MD-TTN', 'Trạm trộn bê tông nhựa', 'Asphalt Mixing Plant'),
 (512, 5, 'MD-TN', 'Xe tưới nhựa đường', 'Asphalt Sprayer / Sealer'),
 (601, 6, 'BT-TR', 'Máy trộn bê tông', 'Concrete Mixer'),
 (602, 6, 'BT-XB', 'Xe bơm bê tông', 'Concrete Pump Truck'),
 (603, 6, 'BT-BT', 'Máy bơm bê tông tĩnh', 'Stationary Concrete Pump'),
 (604, 6, 'BT-BV', 'Máy bơm vữa xi măng', 'Cement Grout Pump'),
 (605, 6, 'BT-CPP', 'Cần phân phối bê tông', 'Placing Boom'),
 (606, 6, 'BT-XN', 'Máy xoa nền bê tông', 'Power Trowel'),
 (607, 6, 'BT-TG', 'Thước gạt bê tông', 'Flat Truss Screed'),
 (608, 6, 'BT-CS', 'Máy cắt sàn bê tông', 'Concrete Floor Saw'),
 (609, 6, 'BT-DD', 'Đầm dùi bê tông', 'Internal Vibrator'),
 (610, 6, 'BT-DCT', 'Đầm rung cầm tay', 'Handheld External Vibrator'),
 (611, 6, 'BT-GB', 'Gầu đổ bê tông', 'Concrete Bucket'),
 (612, 6, 'BT-CT', 'Thiết bị gia công cốt thép', 'Rebar Tools & Equipment'),
 (701, 7, 'KM-XHL', 'Máy xúc lật hầm lò', 'Underground Mining Loader'),
 (702, 7, 'KM-KN', 'Máy khoan neo cáp', 'Cable Bolter'),
 (703, 7, 'KM-XM', 'Xe tải mỏ', 'Mining Truck / Hauler'),
 (704, 7, 'KM-NG', 'Máy nghiền', 'Crusher'),
 (705, 7, 'KM-SA', 'Máy sàng', 'Screener'),
 (706, 7, 'KM-BT', 'Băng tải', 'Conveyor'),
 (801, 8, 'CK-KCN', 'Máy khoan cọc nhồi', 'Rotary Drilling Rig'),
 (802, 8, 'CK-KN', 'Máy khoan ngang', 'Horizontal Drilling Rig'),
 (803, 8, 'CK-KG', 'Máy khoan giếng nước', 'Water Well Drilling Rig'),
 (804, 8, 'CK-KNC', 'Máy khoan neo, khoan cọc', 'Heavy / Anchor / Bore Pile Rig'),
 (805, 8, 'CK-DC', 'Máy đóng cọc', 'Piling Rig'),
 (806, 8, 'CK-BR', 'Búa rung đóng cọc', 'Vibratory Pile Driver'),
 (807, 8, 'CK-BTL', 'Búa đóng cọc thủy lực', 'Hydraulic Pile Hammer'),
 (808, 8, 'CK-BD', 'Búa đóng cọc diesel', 'Diesel Pile Hammer'),
 (901, 9, 'PT-MPD', 'Máy phát điện', 'Generator'),
 (902, 9, 'PT-MNK', 'Máy nén khí', 'Compressor'),
 (903, 9, 'PT-MH', 'Máy hàn', 'Welding Machine'),
 (904, 9, 'PT-TD', 'Tháp đèn chiếu sáng', 'Light Tower'),
 (905, 9, 'PT-BN', 'Máy bơm nước', 'Dewatering / Water Pump'),
 (906, 9, 'PT-NTL', 'Bộ nguồn thủy lực', 'Hydraulic Power Pack'),
 (1001, 10, 'VC-XB', 'Xe ben', 'Dump Truck'),
 (1002, 10, 'VC-BN', 'Xe bồn chở nước', 'Water Tanker / Water Truck'),
 (1003, 10, 'VC-NL', 'Xe chở nhiên liệu, xe dịch vụ', 'Fuel Truck / Service Truck'),
 (1004, 10, 'VC-RM', 'Rơ moóc lùn chở máy', 'Lowbed Trailer / Transporter'),
 (1005, 10, 'VC-CT', 'Xe công trường', 'Site Vehicle'),
 (1006, 10, 'VC-XK', 'Xe khác', 'Other Vehicles'),
 (1101, 11, 'PK-LD', 'Phụ kiện, phụ tùng máy làm đất', 'Earthmoving Accessories & Spare Parts'),
 (1102, 11, 'PK-TN', 'Phụ kiện, phụ tùng thiết bị nâng hạ', 'Lifting Accessories & Spare Parts'),
 (1103, 11, 'PK-XN', 'Phụ kiện, phụ tùng thiết bị nâng chuyển hàng', 'Material Handling Accessories & Spare Parts'),
 (1104, 11, 'PK-MD', 'Phụ kiện, phụ tùng thiết bị làm đường', 'Road Equipment Accessories & Spare Parts'),
 (1105, 11, 'PK-BT', 'Phụ kiện, phụ tùng thiết bị bê tông', 'Concrete Equipment Accessories & Spare Parts'),
 (1106, 11, 'PK-CK', 'Phụ kiện, phụ tùng thiết bị khoan', 'Drilling Equipment Accessories & Spare Parts'),
 (1107, 11, 'PK-LO', 'Lốp & phụ kiện thông dụng', 'Tyres & Universal'),
 (1108, 11, 'PK-KH', 'Phụ kiện khác', 'Others Accessories'),
 (1201, 12, 'KH-TB', 'Máy, thiết bị khác', 'Miscellaneous Equipment');

INSERT INTO brands (id, name, country) VALUES
 (1, 'Komatsu', 'Nhật Bản'), 
 (2, 'Hitachi', 'Nhật Bản'), 
 (3, 'Doosan', 'Hàn Quốc'), 
 (4, 'Kato', 'Nhật Bản'),
 (5, 'Tadano', 'Nhật Bản'), 
 (6, 'Sakai', 'Nhật Bản'), 
 (7, 'Caterpillar', 'Hoa Kỳ'), 
 (8, 'Liugong', 'Trung Quốc');


