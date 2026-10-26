import CatalogPage from "./CatalogPage";
import { formatNumber } from "../../utils/format";

const STATUSES = [
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Ngừng hoạt động" },
];

// Màn Quản lý bãi máy
function WarehousePage() {
  return (
    <CatalogPage
      title="Quản lý bãi máy"
      description="Các bãi tập kết, cất giữ thiết bị của công ty."
      endpoint="/warehouses"
      itemName="bãi máy"
      searchPlaceholder="Tìm theo mã, tên bãi, địa chỉ…"
      searchText={(w) => [w.code, w.name, w.address].join(" ")}
      filters={[{ key: "status", label: "Trạng thái", options: STATUSES }]}
      columns={[
        { key: "code", label: "Mã bãi", render: (w) => <strong>{w.code}</strong> },
        { key: "name", label: "Tên bãi máy", render: (w) => <span className="cell-main">{w.name}</span> },
        { key: "address", label: "Địa chỉ", wrap: true },
        {
          key: "area_m2",
          label: "Diện tích (m²)",
          align: "right",
          render: (w) => (w.area_m2 !== null ? formatNumber(w.area_m2) : <span className="text-muted">—</span>),
        },
        {
          key: "equipment_count",
          label: "Thiết bị / Sức chứa",
          align: "right",
          render: (w) => (
            <>
              <strong>{w.equipment_count}</strong>
              <span className="text-muted"> / {w.capacity ?? "—"}</span>
            </>
          ),
        },
        {
          key: "status",
          label: "Trạng thái",
          render: (w) =>
            w.status === "ACTIVE" ? (
              <span className="badge badge-success">Đang hoạt động</span>
            ) : (
              <span className="badge badge-neutral">Ngừng hoạt động</span>
            ),
        },
      ]}
      fields={[
        { name: "name", label: "Tên bãi máy", required: true, full: true, maxLength: 100, placeholder: "VD: Bãi Long Biên" },
        { name: "address", label: "Địa chỉ", required: true, full: true, maxLength: 255 },
        { name: "area_m2", label: "Diện tích (m²)", type: "number" },
        { name: "capacity", label: "Sức chứa (số thiết bị)", type: "number" },
        {
          name: "status",
          label: "Trạng thái",
          type: "select",
          options: STATUSES,
          hint: "Chỉ ngừng hoạt động được khi bãi không còn thiết bị.",
        },
      ]}
      emptyForm={{ status: "ACTIVE" }}
      rowLabel={(w) => `${w.code} – ${w.name}`}
      deleteBlocked={(w) => (w.equipment_count > 0 ? "Bãi đang chứa thiết bị, không thể xoá" : null)}
      createSubtitle="Mã bãi được tạo tự động (KB01, KB02…)."
      editSubtitle={(w) => `Mã bãi: ${w.code}`}
    />
  );
}

export default WarehousePage;
