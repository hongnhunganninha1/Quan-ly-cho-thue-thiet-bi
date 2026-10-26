import { useState } from "react";
import CatalogPage from "../catalog/CatalogPage";
import EquipmentDetailModal from "./EquipmentDetailModal";
import StatusBadge from "../../components/common/StatusBadge";
import EquipmentThumb from "../../components/common/EquipmentThumb";
import { EyeIcon, HistoryIcon, SwitchIcon } from "../../components/common/Icons";
import ModelInput from "./ModelInput";
import ImageField from "./ImageField";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import { formatDate, formatMoney } from "../../utils/format";
import { categoryFilterOptions, categorySelectOptions, matchCategory } from "../../utils/options";
import { EQUIPMENT_STATUS, ITEM_CONDITION, toOptions } from "../../utils/labels";
import "./Equipment.css";
import { todayStr } from "../../utils/dateLimits";

// Các cách sắp xếp danh sách thiết bị
const byText = (a, b) => a.localeCompare(b, "vi");
const byPrice = (dir) => (a, b) => {
  if (a.daily_rate === null) return b.daily_rate === null ? 0 : 1; // máy chưa có giá luôn ở cuối
  if (b.daily_rate === null) return -1;
  return dir * (a.daily_rate - b.daily_rate);
};
const SORTS = [
  {
    value: "newest",
    label: "Mới nhất",
    compare: (a, b) => byText(b.created_at, a.created_at) || byText(b.code, a.code),
  },
  {
    value: "oldest",
    label: "Cũ nhất",
    compare: (a, b) => byText(a.created_at, b.created_at) || byText(a.code, b.code),
  },
  { value: "price-asc", label: "Giá thấp đến cao", compare: byPrice(1) },
  { value: "price-desc", label: "Giá cao đến thấp", compare: byPrice(-1) },
  { value: "name-asc", label: "Tên A–Z", compare: (a, b) => byText(a.name, b.name) },
  { value: "name-desc", label: "Tên Z–A", compare: (a, b) => byText(b.name, a.name) },
];

// Màn Quản lý hồ sơ thiết bị
function EquipmentPage({ user }) {
  const [viewing, setViewing] = useState(null); // { id, tab, form } của thiết bị đang xem hồ sơ
  const [refresh, setRefresh] = useState(0);
  const { data: categories } = useApiData("/categories", []);
  const { data: brands } = useApiData("/brands", []);
  const { data: warehouses } = useApiData("/warehouses", []);

  const categoryOptions = categorySelectOptions(categories);
  const brandOptions = brands.map((b) => ({ value: String(b.id), label: b.name }));
  // Tên tự ghép theo quy định: Năm SX - Hãng Model - Loại (giống cách backend ghép khi lưu)
  const previewName = (form) => {
    const brand = brands.find((b) => String(b.id) === String(form.brand_id))?.name;
    const category = categories.find((c) => String(c.id) === String(form.category_id))?.name;
    const parts = [
      form.manufacture_year || "____",
      `${brand || "Hãng"} ${String(form.model || "Model").trim()}`,
      category || "Loại thiết bị",
    ];
    return parts.join(" - ");
  };

  // Sau khi lưu thông tin máy: tải ảnh mới lên, hoặc xoá ảnh nếu người dùng bấm "Bỏ ảnh"
  const saveImage = async (result, values, row) => {
    const id = row ? row.id : result.id;
    if (values.image_url instanceof File) {
      const fd = new FormData();
      fd.append("image", values.image_url);
      await api.upload(`/equipments/${id}/image`, fd);
    } else if (row?.image_url && !values.image_url) {
      await api.del(`/equipments/${id}/image`);
    }
  };

  const warehouseOptions = warehouses
    .filter((w) => w.status === "ACTIVE")
    .map((w) => ({ value: String(w.id), label: `${w.code} – ${w.name}` }));

  return (
    <>
      <CatalogPage
        title="Quản lý hồ sơ thiết bị"
        description="Thông tin, giấy tờ và lịch sử của từng máy. Giá thuê do Quản lý đặt ở mục Quản lý giá thuê."
        endpoint="/equipments"
        itemName="thiết bị"
        refreshSignal={refresh}
        searchPlaceholder="Tìm theo mã, tên, model, số serial, số máy…"
        searchText={(e) => [e.code, e.name, e.model, e.serial_number, e.engine_number, e.brand_name].join(" ")}
        filters={[
          { key: "category", label: "Danh mục", options: categoryFilterOptions(categories), match: matchCategory },
          { key: "status", label: "Trạng thái", options: toOptions(EQUIPMENT_STATUS) },
          { key: "item_condition", label: "Tình trạng", options: toOptions(ITEM_CONDITION) },
          {
            key: "warehouse_id",
            label: "Bãi",
            options: warehouses.map((w) => ({ value: String(w.id), label: w.name })),
          },
        ]}
        dateFilter={{ key: "created_at", label: "Ngày nhập" }}
        sorts={SORTS}
        pageSizes={[10, 20, 50]}
        columns={[
          {
            key: "name",
            label: "Thiết bị",
            wrap: true,
            render: (e) => (
              <div className="thumb-cell">
                <button
                  className="thumb-button"
                  onClick={() => setViewing({ id: e.id })}
                  aria-label={`Xem hồ sơ ${e.name}`}
                >
                  <EquipmentThumb src={e.image_url} alt={e.name} />
                </button>
                <div>
                  <button className="link-cell" onClick={() => setViewing({ id: e.id })}>
                    {e.name}
                  </button>
                  <span className="cell-sub">
                    <strong>{e.code}</strong> · <StatusBadge map={ITEM_CONDITION} value={e.item_condition} />
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "category_name",
            label: "Danh mục",
            render: (e) => (
              <>
                <span className="cell-main">{e.category_name}</span>
                <span className="cell-sub">{e.group_name}</span>
              </>
            ),
          },
          {
            key: "created_at",
            label: "Ngày nhập",
            render: (e) => formatDate(e.created_at),
          },
          {
            key: "warehouse_name",
            label: "Vị trí",
            render: (e) =>
              e.warehouse_name || <span className="text-muted">{e.status === "RENTED" ? "Tại công trình" : "—"}</span>,
          },
          {
            key: "daily_rate",
            label: "Giá thuê",
            align: "right",
            render: (e) =>
              e.daily_rate ? (
                <>
                  <span className="cell-main">{formatMoney(e.daily_rate)}/ngày</span>
                  <span className="cell-sub">{formatMoney(e.hourly_rate)}/giờ</span>
                </>
              ) : (
                <span className="badge badge-warning">Chưa có giá</span>
              ),
          },
          {
            key: "status",
            label: "Trạng thái",
            render: (e) => <StatusBadge map={EQUIPMENT_STATUS} value={e.status} />,
          },
        ]}
        fields={[
          { name: "section-1", label: "Thông tin chung", type: "section" },
          {
            name: "image_url",
            label: "Ảnh thiết bị",
            type: "custom",
            full: true,
            hint: "Ảnh này hiển thị trong danh sách và hồ sơ thiết bị. JPG, PNG, WEBP · chọn ảnh xong được căn chỉnh khung 4:3 trước khi lưu.",
            render: (p) => <ImageField {...p} />,
          },
          {
            name: "manufacture_year",
            label: "Năm sản xuất",
            type: "number",
            required: true,
            placeholder: "VD: 2018",
          },
          {
            name: "item_condition",
            label: "Tình trạng",
            type: "select",
            required: true,
            options: toOptions(ITEM_CONDITION),
          },
          {
            name: "brand_id",
            label: "Hãng",
            type: "select",
            required: true,
            options: brandOptions,
            emptyOption: "— Chọn hãng —",
          },
          {
            name: "model",
            label: "Model",
            type: "custom",
            required: true,
            hint: "Nhập tay hoặc bấm Đọc từ ảnh để tự nhận số model từ ảnh chụp tem máy.",
            render: (p) => <ModelInput {...p} kind="model" />,
          },
          {
            name: "category_id",
            label: "Loại thiết bị",
            type: "select",
            required: true,
            full: true,
            options: categoryOptions,
            emptyOption: "— Chọn loại —",
          },
          {
            name: "name_preview",
            label: "Xem trước tên thiết bị (hệ thống tự tạo, không cần nhập)",
            type: "custom",
            full: true,
            render: ({ form }) => (
              <div className="name-preview">
                <span className="name-preview-rule">Năm SX - Hãng Model - Loại</span>
                <strong>{previewName(form)}</strong>
              </div>
            ),
          },
          {
            name: "serial_number",
            label: "Số serial (số khung)",
            type: "custom",
            required: true,
            hint: "Nhập tay hoặc đọc từ ảnh tem máy (dòng SERIAL NO / PIN / FRAME NO).",
            render: (p) => <ModelInput {...p} kind="serial" placeholder="VD: KMTPC200C310552" />,
          },
          {
            name: "engine_number",
            label: "Số máy (số động cơ)",
            type: "custom",
            hint: "Nhập tay hoặc đọc từ ảnh tem động cơ (dòng ENGINE NO).",
            render: (p) => <ModelInput {...p} kind="engine" placeholder="VD: SAA6D107E-26612" />,
          },
          { name: "origin_country", label: "Xuất xứ", maxLength: 50 },
          {
            name: "specifications",
            label: "Thông số kỹ thuật",
            maxLength: 500,
            placeholder: "VD: Gầu 0,8 m³; 110 kW; 20 tấn",
          },
          { name: "section-2", label: "Mua sắm & vận hành", type: "section" },
          { name: "purchase_date", label: "Ngày mua", type: "date", max: todayStr(), maxLabel: "hôm nay" },
          { name: "purchase_price", label: "Giá mua (₫)", type: "number" },
          {
            name: "operating_hours",
            label: "Số giờ máy hiện tại",
            type: "number",
            hint: "Theo đồng hồ đếm giờ của máy.",
            disabled: (form, row) => row?.status === "RENTED",
          },
          {
            name: "warehouse_id",
            label: "Bãi đặt máy",
            type: "select",
            required: true,
            options: warehouseOptions,
            emptyOption: "— Chọn bãi —",
            disabled: (form, row) => row?.status === "RENTED",
            hint: "Máy đang cho thuê thì vị trí do bàn giao / thu hồi cập nhật.",
          },
          { name: "note", label: "Ghi chú", type: "textarea", full: true },
        ]}
        afterSave={saveImage}
        formSize="xl"
        emptyForm={{ operating_hours: "0", item_condition: "NEW" }}
        rowLabel={(e) => `${e.code} – ${e.name}`}
        deleteBlocked={(e) => (e.rental_count > 0 ? "Máy đã có trong hợp đồng, không thể xoá" : null)}
        canEdit={(e) => e.status !== "LIQUIDATED"}
        rowActions={(e) =>
          [
            {
              key: "view",
              first: true,
              label: "Xem hồ sơ",
              icon: <EyeIcon />,
              onClick: () => setViewing({ id: e.id }),
            },
            {
              key: "rentals",
              label: "Lịch sử thuê",
              icon: <HistoryIcon />,
              onClick: () => setViewing({ id: e.id, tab: "rentals" }),
            },
            user?.role === "ADMIN" && {
              key: "status",
              label: "Cập nhật trạng thái",
              icon: <SwitchIcon />,
              disabled: ["RESERVED", "RENTED", "LIQUIDATED"].includes(e.status),
              title: ["RESERVED", "RENTED"].includes(e.status)
                ? "Máy đang theo hợp đồng, trạng thái do hợp đồng cập nhật"
                : e.status === "LIQUIDATED"
                  ? "Máy đã thanh lý"
                  : "",
              onClick: () => setViewing({ id: e.id, form: "status" }),
            },
          ].filter(Boolean)
        }
        createSubtitle="Mã máy tự sinh dạng SKU + năm + tháng nhập + số thứ tự (VD: SKU26100001). Máy mới chưa có giá thuê; Quản lý đặt giá trước khi cho thuê."
        editSubtitle={(e) => `Mã máy: ${e.code}`}
      />

      {viewing && (
        <EquipmentDetailModal
          id={viewing.id}
          initialTab={viewing.tab}
          initialForm={viewing.form}
          canManageStatus={user?.role === "ADMIN"}
          onClose={() => setViewing(null)}
          onChanged={() => setRefresh((x) => x + 1)}
        />
      )}
    </>
  );
}

export default EquipmentPage;
