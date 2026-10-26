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
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))
    ) : (
      <optgroup key={g.name} label={g.name}>
        {g.items.map((o) => (
          <option key={o.value} value={o.value}>
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

// Lựa chọn cho bộ lọc: chọn cả nhóm ("g" + id) hoặc từng loại; loại thụt vào dưới nhóm
export function categoryFilterOptions(categories) {
  const result = [];
  for (const g of categories.filter((c) => c.parent_id === null)) {
    result.push({ value: `g${g.id}`, label: g.name });
    for (const c of categories.filter((x) => x.parent_id === g.id)) {
      result.push({ value: String(c.id), label: `\u2003${c.name}` });
    }
  }
  return result;
}

// Dòng có thuộc lựa chọn lọc không (dòng cần có category_id và group_id)
export function matchCategory(row, value) {
  return value.startsWith("g") ? String(row.group_id) === value.slice(1) : String(row.category_id) === value;
}
