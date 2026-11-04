import { useRef, useState } from "react";
import CatalogPage from "../catalog/CatalogPage";
import EquipmentDetailModal from "./EquipmentDetailModal";
import StatusBadge from "../../components/common/StatusBadge";
import EquipmentThumb from "../../components/common/EquipmentThumb";
import { EyeIcon, HistoryIcon, SwitchIcon } from "../../components/common/Icons";
import ModelInput from "./ModelInput";
import ImageField from "./ImageField";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import { categorySelectOptions, categoryTreeOptions, matchCategory, warehouseOptions } from "../../utils/options";
import { EQUIPMENT_STATUS, ITEM_CONDITION, toOptions } from "../../utils/labels";
import "./Equipment.css";
import { todayStr } from "../../utils/dateLimits";

// Màn Quản lý hồ sơ thiết bị
// navParam (khi đi từ màn Loại thiết bị): "add-<id loại>" → mở sẵn form thêm máy thuộc loại đó;
// "type-<id loại>" → lọc sẵn danh sách theo loại đó
function EquipmentPage({ user, navParam = "" }) {
  const [presetMode, presetCategory] = (navParam || "").split("-");
  const [viewing, setViewing] = useState(null); // { id, tab, form } của thiết bị đang xem hồ sơ
  const [refresh, setRefresh] = useState(0);
  const { data: categories } = useApiData("/categories", []);
  const { data: brands, reload: reloadBrands } = useApiData("/brands", []);
  const { data: warehouses, reload: reloadWarehouses } = useApiData("/warehouses", []);

  const categoryOptions = categorySelectOptions(categories);
  // Tên tự ghép theo quy định: Năm SX - Hãng Model - Loại (giống cách backend ghép khi lưu)
  const previewName = (form) => {
    const brand = String(form.brand_name || "").trim();
    const category = categories.find((c) => String(c.id) === String(form.category_id))?.name;
    const parts = [
      form.manufacture_year || "____",
      `${brand || "Hãng"} ${String(form.model || "Model").trim()}`,
      category || "Loại thiết bị",
    ];
    return parts.join(" - ");
  };

  // Sau khi lưu thông tin máy: tải ảnh mới lên, hoặc xoá ảnh nếu người dùng bấm "Bỏ ảnh"
  // Ảnh tem đã dùng để đọc Model / Số serial / Số máy trong form đang mở: { model, serial_number, engine_number }
  const nameplates = useRef({});

  // Lưu ảnh tem vào Giấy tờ của máy (loại "Ảnh tem máy"), số giấy tờ = các mã đọc từ ảnh đó.
  // Một ảnh dùng cho nhiều ô (VD cùng tem có cả model và serial) chỉ lưu một lần.
  const saveNameplates = async (id, values) => {
    const LABELS = { model: "Model", serial_number: "Serial", engine_number: "Số máy" };
    const groups = new Map();
    Object.entries(nameplates.current).forEach(([field, file]) => {
      if (!file) return;
      const key = `${file.name}|${file.size}|${file.lastModified}`;
      const g = groups.get(key) || { file, codes: [] };
      if (values[field]) g.codes.push(`${LABELS[field]} ${values[field]}`);
      groups.set(key, g);
    });
    for (const { file, codes } of groups.values()) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("doc_type", "NAMEPLATE");
      fd.append("doc_number", codes.join(" · ").slice(0, 50));
      await api.upload(`/equipments/${id}/documents`, fd);
    }
    nameplates.current = {};
  };

  const saveImage = async (result, values, row) => {
    const id = row ? row.id : result.id;
    if (result?.brand_created) reloadBrands(); // vừa tự thêm hãng mới
    reloadWarehouses(); // cập nhật số máy / sức chứa của các bãi

    if (values.image_url instanceof File) {
      const fd = new FormData();
      fd.append("image", values.image_url);
      await api.upload(`/equipments/${id}/image`, fd);
    } else if (row?.image_url && !values.image_url) {
      await api.del(`/equipments/${id}/image`);
    }
    await saveNameplates(id, values);
  };


  return (
    <>
      <CatalogPage
        title="Hồ sơ thiết bị"
        description="Thông tin, giấy tờ và lịch sử của từng máy. Giá thuê do Quản lý đặt ở mục Thiết bị → Giá thuê."
        endpoint="/equipments"
        itemName="thiết bị"
        refreshSignal={refresh}
        searchPlaceholder="Tìm theo mã, tên, model, số serial, số máy…"
        searchText={(e) => [e.code, e.name, e.model, e.serial_number, e.engine_number, e.brand_name].join(" ")}
        filters={[
          {
            key: "category",
            label: "Danh mục",
            allLabel: "Tất cả danh mục",
            tree: true, // hiện danh mục cấp 1, bấm mũi tên mở ra cấp 2
            options: categoryTreeOptions(categories),
            match: matchCategory,
          },
          { key: "status", label: "Trạng thái", options: toOptions(EQUIPMENT_STATUS) },
          { key: "item_condition", label: "Tình trạng", options: toOptions(ITEM_CONDITION) },
          {
            key: "warehouse_id",
            label: "Tất cả các bãi",
            width: 150,
            // Chỉ lọc theo bãi đang hoạt động (bãi ngừng hoạt động không còn máy)
            options: warehouses.filter((w) => w.status === "ACTIVE").map((w) => ({ value: String(w.id), label: w.name })),
          },
        ]}
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
            key: "warehouse_name",
            label: "Vị trí",
            render: (e) =>
              e.warehouse_name || <span className="text-muted">{e.status === "RENTED" ? "Tại công trình" : "—"}</span>,
          },
          // Giá thuê xem ở màn Giá thuê và trong hồ sơ máy (bấm vào tên), nên ở đây hiện Xuất xứ
          {
            key: "origin_country",
            label: "Xuất xứ",
            render: (e) => e.origin_country || <span className="text-muted">—</span>,
          },
          {
            key: "status",
            label: "Trạng thái",
            render: (e) => <StatusBadge map={EQUIPMENT_STATUS} value={e.status} />,
          },
        ]}
        fieldsFor={(row) => [
          // Xem trước tên đặt trên cùng form: điền các ô bên dưới thì tên tự cập nhật
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
            name: "brand_name",
            label: "Hãng",
            type: "custom",
            required: true,
            hint: "Chọn trong danh sách hoặc gõ tên hãng mới (hệ thống tự thêm vào Quản lý hãng).",
            render: ({ id, value, setValue, invalid, autoFocus }) => (
              <>
                <input
                  id={id}
                  list="brand-list"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="VD: Komatsu"
                  maxLength={50}
                  aria-invalid={invalid}
                  autoFocus={autoFocus}
                  autoComplete="off"
                />
                <datalist id="brand-list">
                  {brands.map((b) => (
                    <option key={b.id} value={b.name} />
                  ))}
                </datalist>
              </>
            ),
          },
          {
            name: "model",
            label: "Model",
            type: "custom",
            required: true,
            hint: "Nhập tay hoặc bấm Đọc từ ảnh để tự nhận model từ ảnh chụp tem máy (dòng MODEL / MODEL NO / TYPE / Ký hiệu).",
            render: (p) => <ModelInput {...p} kind="model" onFile={(f) => (nameplates.current.model = f)} />,
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
            name: "serial_number",
            label: "Số serial (số khung)",
            type: "custom",
            required: true,
            hint: "Nhập tay hoặc đọc từ ảnh tem máy (dòng SERIAL NO / S/N / PIN / VIN / FRAME NO / Số khung).",
            render: (p) => <ModelInput {...p} kind="serial" placeholder="VD: KMTPC200C310552" onFile={(f) => (nameplates.current.serial_number = f)} />,
          },
          {
            name: "engine_number",
            label: "Số máy (số động cơ)",
            type: "custom",
            hint: "Nhập tay hoặc đọc từ ảnh tem động cơ (dòng ENGINE NO).",
            render: (p) => <ModelInput {...p} kind="engine" placeholder="VD: SAA6D107E-26612" onFile={(f) => (nameplates.current.engine_number = f)} />,
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
          { name: "purchase_price", label: "Giá mua (₫)", type: "money", placeholder: "VD: 1.500.000.000" },
          {
            name: "operating_hours",
            label: "Số giờ máy hiện tại",
            type: "custom",
            // Máy mới: khoá ô, thêm mới luôn là 0 giờ; khi sửa thì giữ số giờ hiện tại (do bàn giao / thu hồi cập nhật)
            hint: row?.status === "RENTED" ? "Máy đang cho thuê, giờ máy do bàn giao / thu hồi cập nhật." : "Máy mới mặc định 0 giờ, không cần nhập. Máy đã qua sử dụng: nhập theo đồng hồ đếm giờ.",
            render: ({ id, form, value, setValue, invalid }) => {
              const locked = form.item_condition === "NEW" || row?.status === "RENTED";
              const shown = locked ? (row ? row.operating_hours : 0) : value;
              return (
                <input
                  id={id}
                  type="number"
                  min={0}
                  step="any"
                  value={shown}
                  onChange={(e) => setValue(e.target.value.replace(/^0+(?=\d)/, ""))} // bỏ số 0 thừa ở đầu: 0 → gõ 1500 thành 1500
                  disabled={locked}
                  aria-invalid={invalid}
                />
              );
            },
          },
          {
            name: "warehouse_id",
            label: "Bãi đặt máy",
            type: "select",
            required: true,
            options: warehouseOptions(warehouses, row?.warehouse_id), // bãi đã đầy thì không chọn được
            emptyOption: "— Chọn bãi —",
            disabled: (form, row) => row?.status === "RENTED",
            hint: "Số trong ngoặc là số máy / sức chứa. Bãi đã đầy thì không chọn được. Máy đang cho thuê thì vị trí do bàn giao / thu hồi cập nhật.",
          },
          { name: "note", label: "Ghi chú", type: "textarea", full: true },
        ]}
        afterSave={saveImage}
        onOpenForm={() => (nameplates.current = {})} // mở form mới thì bỏ ảnh tem của lần trước
        formSize="xl"
        initialFilters={presetCategory ? { category: presetCategory } : {}}
        openAddWith={presetMode === "add" && presetCategory ? { category_id: presetCategory } : null}
        // Đang lọc theo 1 loại thiết bị (cấp 2) thì bấm "Thêm" sẽ điền sẵn loại đó
        emptyForm={(f) => ({
          operating_hours: "0",
          item_condition: "USED",
          brand_name: "",
          ...(f.category && !String(f.category).startsWith("g") ? { category_id: String(f.category) } : {}),
        })} // mặc định máy đã qua sử dụng
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
