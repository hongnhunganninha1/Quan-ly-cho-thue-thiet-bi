import { useState } from "react";
import CatalogPage from "../catalog/CatalogPage";
import StatusBadge from "../../components/common/StatusBadge";
import { formatDate, formatMoney } from "../../utils/format";
import { EQUIPMENT_STATUS } from "../../utils/labels";
import PriceHistoryModal from "./PriceHistoryModal";
import "./Equipment.css";

// Màn Quản lý giá thuê (chỉ Quản lý): đặt giá theo giờ và theo ngày cho từng máy.
// Giá được chép vào hợp đồng lúc lập, nên đổi giá không làm thay đổi hợp đồng cũ.
// Mỗi lần đổi giá được ghi vào lịch sử (giá cũ → giá mới, lý do, người đổi).
function PricePage() {
  const [historyOf, setHistoryOf] = useState(null); // máy đang xem lịch sử giá

  return (
    <>
      <CatalogPage
        title="Quản lý giá thuê"
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
            render: (e) => (
              <>
                <span className="cell-main">{e.name}</span>
                <span className="cell-sub">{e.category_name}</span>
              </>
            ),
          },
          { key: "status", label: "Trạng thái", render: (e) => <StatusBadge map={EQUIPMENT_STATUS} value={e.status} /> },
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
          {
            key: "price_changed_at",
            label: "Đổi giá gần nhất",
            render: (e) => (e.price_changed_at ? formatDate(e.price_changed_at) : <span className="text-muted">—</span>),
          },
        ]}
        rowActions={(e) => [
          { key: "history", label: "Lịch sử giá", disabled: !e.price_changed_at, onClick: () => setHistoryOf(e) },
        ]}
        fields={[
          { name: "hourly_rate", label: "Giá thuê theo giờ (₫)", type: "number", required: true, hint: "Dùng cho hợp đồng tính theo giờ và phí vượt giờ." },
          { name: "daily_rate", label: "Giá thuê theo ngày (₫)", type: "number", required: true, hint: "Dùng cho hợp đồng tính theo ngày và phí trễ hạn." },
          {
            name: "reason",
            label: "Lý do điều chỉnh",
            type: "textarea",
            full: true,
            maxLength: 200,
            placeholder: "VD: Điều chỉnh theo giá thị trường quý IV/2026",
            hint: "Được lưu vào lịch sử thay đổi giá.",
          },
        ]}
        formSize="md"
        rowLabel={(e) => `${e.code} – ${e.name}`}
        editSubtitle={(e) => `${e.code} – ${e.name}. Hợp đồng đã lập vẫn giữ giá cũ.`}
      />
      {historyOf && <PriceHistoryModal equipment={historyOf} onClose={() => setHistoryOf(null)} />}
    </>
  );
}

export default PricePage;
