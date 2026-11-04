// Vẽ danh sách lựa chọn; lựa chọn có "group" được gom vào <optgroup> theo nhóm
export function renderOptions(options) {
  const groups = [];
  for (const o of options) {
    const g = groups.find((x) => x.name === (o.group ?? null));
    if (g) g.items.push(o);
    else groups.push({ name: o.group ?? null, items: [o] });
  }
  return groups.map((g) =>
    g.name === null ? (
      g.items.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))
    ) : (
      <optgroup key={g.name} label={g.name}>
        {g.items.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </optgroup>
    )
  );
}

// ----- Loại thiết bị 2 cấp (nhóm → loại) -----

// Lựa chọn cho ô chọn loại trong form: chỉ chọn được loại (cấp 2), gom theo nhóm
export function categorySelectOptions(categories) {
  return categories
    .filter((c) => c.parent_id !== null)
    .map((c) => ({ value: String(c.id), label: c.name, group: c.parent_name }));
}

// Lựa chọn dạng cây cho bộ lọc (TreeSelect): danh mục cấp 1 ("g" + id), mở ra các loại cấp 2
export function categoryTreeOptions(categories) {
  return categories
    .filter((c) => c.parent_id === null)
    .map((g) => ({
      value: `g${g.id}`,
      label: g.name,
      children: categories.filter((x) => x.parent_id === g.id).map((c) => ({ value: String(c.id), label: c.name })),
    }));
}

// Dòng có thuộc lựa chọn lọc không (dòng cần có category_id và group_id)
export function matchCategory(row, value) {
  return value.startsWith("g") ? String(row.group_id) === value.slice(1) : String(row.category_id) === value;
}

// Lựa chọn bãi máy kèm số máy / sức chứa; bãi đã đầy thì không chọn được (trừ bãi máy đang đặt)
export function warehouseOptions(warehouses, currentId = null) {
  return warehouses
    .filter((w) => w.status === "ACTIVE")
    .map((w) => {
      const full = w.capacity !== null && w.equipment_count >= w.capacity && String(w.id) !== String(currentId);
      const usage = w.capacity !== null ? ` (${w.equipment_count}/${w.capacity}${full ? " – đã đầy" : ""})` : "";
      return { value: String(w.id), label: `${w.code} – ${w.name}${usage}`, disabled: full };
    });
}
