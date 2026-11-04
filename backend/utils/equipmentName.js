// Tên thiết bị theo quy định của công ty: "Năm SX - Hãng Model - Loại thiết bị"
// VD: 2018 - Komatsu PC200-8 - Máy xúc đào bánh xích
// Tên luôn do hệ thống ghép, người dùng không nhập tay để tránh đặt tên lệch chuẩn.

function buildEquipmentName({ year, brand, model, category }) {
  return `${year} - ${brand} ${String(model).trim()} - ${category}`;
}

// Ghép lại tên cho các máy khi đổi tên hãng hoặc tên loại thiết bị (where: "e.brand_id = ?" hoặc "e.category_id = ?")
async function refreshEquipmentNames(conn, where, params) {
  await conn.query(
    `UPDATE equipments e
       JOIN brands b               ON b.id = e.brand_id
       JOIN equipment_categories c ON c.id = e.category_id
        SET e.name = CONCAT(e.manufacture_year, ' - ', b.name, ' ', e.model, ' - ', c.name)
      WHERE ${where}`,
    params
  );
}

module.exports = { buildEquipmentName, refreshEquipmentNames };
