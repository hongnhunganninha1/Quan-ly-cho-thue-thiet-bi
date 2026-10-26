import CatalogPage from "./CatalogPage";

// Màn Quản lý hãng thiết bị
function BrandPage() {
  return (
    <CatalogPage
      title="Quản lý hãng thiết bị"
      description="Các hãng sản xuất thiết bị (Komatsu, Hitachi, Caterpillar…)."
      endpoint="/brands"
      itemName="hãng thiết bị"
      searchPlaceholder="Tìm theo tên hãng, quốc gia…"
      searchText={(b) => [b.name, b.country, b.website].join(" ")}
      columns={[
        { key: "name", label: "Tên hãng", render: (b) => <span className="cell-main">{b.name}</span> },
        { key: "country", label: "Quốc gia" },
        {
          key: "website",
          label: "Website",
          render: (b) =>
            b.website ? (
              <a href={b.website} target="_blank" rel="noreferrer">
                {b.website.replace(/^https?:\/\//, "")}
              </a>
            ) : (
              <span className="text-muted">—</span>
            ),
        },
        { key: "equipment_count", label: "Số thiết bị", align: "right" },
      ]}
      fields={[
        { name: "name", label: "Tên hãng", required: true, maxLength: 100, placeholder: "VD: Komatsu" },
        { name: "country", label: "Quốc gia", maxLength: 50, placeholder: "VD: Nhật Bản" },
        { name: "website", label: "Website", full: true, maxLength: 255, placeholder: "https://…" },
      ]}
      emptyForm={{}}
      rowLabel={(b) => b.name}
      deleteBlocked={(b) => (b.equipment_count > 0 ? "Hãng này đang có thiết bị, không thể xoá" : null)}
    />
  );
}

export default BrandPage;
