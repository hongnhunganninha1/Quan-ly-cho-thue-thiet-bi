import { useState } from "react";
import CatalogPage from "../catalog/CatalogPage";
import StatusBadge from "../../components/common/StatusBadge";
import { formatMoney } from "../../utils/format";
import { EQUIPMENT_STATUS } from "../../utils/labels";
import PriceHistoryModal from "./PriceHistoryModal";
import EquipmentDetailModal from "./EquipmentDetailModal";
import "./Equipment.css";

// Màn Quản lý giá thuê (chỉ Quản lý): đặt giá theo giờ và theo ngày cho từng máy.
// Giá được chép vào hợp đồng lúc lập, nên đổi giá không làm thay đổi hợp đồng cũ.
// Mỗi lần sửa giá được ghi vào "Lịch sử giá" (giá cũ → giá mới, lý do, người sửa).
// Giá đã áp dụng cho từng hợp đồng xem ở Danh sách thiết bị → Lịch sử cho thuê.
function PricePage() {
  const [priceOf, setPriceOf] = useState(null); // máy đang xem lịch sử giá
  const [viewing, setViewing] = useState(null); // máy đang xem chi tiết (bấm vào tên máy)

  return (
    <>
      <CatalogPage
        title="Bảng giá thuê"
        endpoint="/equipments"
        itemName="giá thuê"
        hideAdd
        hideDelete
        canEdit={(e) => e.status !== "LIQUIDATED"}
        updatePath={(e) => `/equipments/${e.id}/price`}
        searchPlaceholder="Tìm theo mã, tên thiết bị…"
        searchText={(e) => [e.code, e.name, e.model, e.category_name].join(" ")}
        filters={[
          { key: "has_price", label: "Giá", options: [{ value: "NO", label: "Chưa có giá" }, { value: "YES", label: "Đã có giá" }] },
        ]}
        columns={[
          { key: "code", label: "Mã máy", render: (e) => <strong>{e.code}</strong> },
          {
            key: "name",
            label: "Thiết bị",
            // Bấm vào tên máy để mở hồ sơ chi tiết thiết bị (tên đã có loại thiết bị nên không ghi thêm)
            render: (e) => (
              <button className="link-cell" onClick={() => setViewing(e.id)} title="Xem chi tiết thiết bị">
                {e.name}
              </button>
            ),
          },
          {
            key: "hourly_rate",
            label: "Giá theo giờ",
            align: "right",
            render: (e) => (e.hourly_rate ? formatMoney(e.hourly_rate) : <span className="badge badge-warning">Chưa có giá</span>),
          },
          {
            key: "daily_rate",
            label: "Giá theo ngày",
            align: "right",
            render: (e) => (e.daily_rate ? <strong>{formatMoney(e.daily_rate)}</strong> : <span className="text-muted">—</span>),
          },
          { key: "status", label: "Trạng thái", render: (e) => <StatusBadge map={EQUIPMENT_STATUS} value={e.status} /> },
        ]}
        rowActions={(e) => [
          { key: "price", label: "Lịch sử giá", disabled: !e.price_changed_at, onClick: () => setPriceOf(e) },
        ]}
        fields={[
          { name: "hourly_rate", label: "Giá thuê theo giờ (₫)", type: "money", required: true, hint: "Dùng cho hợp đồng tính theo giờ và phí vượt giờ." },
          { name: "daily_rate", label: "Giá thuê theo ngày (₫)", type: "money", required: true, hint: "Dùng cho hợp đồng tính theo ngày (1 ngày = 1 ca 8 giờ). Phải thấp hơn 8 × giá giờ." },
          {
            name: "reason",
            label: "Lý do điều chỉnh",
            type: "textarea",
            full: true,
            maxLength: 255,
            placeholder: "VD: Điều chỉnh theo giá thị trường quý IV/2026",
            hint: "Được lưu vào lịch sử thay đổi giá.",
          },
        ]}
        formSize="md"
        rowLabel={(e) => `${e.code} – ${e.name}`}
        // Chỉ nhắc "hợp đồng đã lập giữ giá cũ" khi máy đã có giá (đổi giá lần 2 trở đi)
        editSubtitle={(e) => `${e.code} – ${e.name}.` + (e.daily_rate ? " Hợp đồng đã lập vẫn giữ giá cũ." : " Máy chưa có giá, đặt giá xong mới đưa vào hợp đồng được.")}
      />
      {priceOf && <PriceHistoryModal equipment={priceOf} onClose={() => setPriceOf(null)} />}
      {viewing && <EquipmentDetailModal id={viewing} onClose={() => setViewing(null)} />}
          </>
  );
}

export default PricePage;
