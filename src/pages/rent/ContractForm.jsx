import { useEffect, useMemo, useState } from "react";
import "../catalog/CatalogPage.css";
import "./Rent.css";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import EquipmentThumb from "../../components/common/EquipmentThumb";
import FormModal from "../../components/common/FormModal";
import { CUSTOMER_EMPTY, CUSTOMER_FIELDS } from "../catalog/customerFields";
import { daysInclusive, formatDate, formatMoney, normalizeText, todayISO } from "../../utils/format";
import { dateError } from "../../utils/dateLimits";
import DateInput from "../../components/common/DateInput";

// Tính tiền giống backend (utils/calc.js): VAT trên (tiền thuê − chiết khấu + vận chuyển)
function calcTotals(lines, transportFee, discountRate, vatRate) {
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const discount = Math.round((subtotal * discountRate) / 100);
  const vat = Math.round(((subtotal - discount + transportFee) * vatRate) / 100);
  return { subtotal, discount, vat, total: subtotal - discount + transportFee + vat };
}

const num = (v) => (v === "" || v === null || v === undefined ? 0 : Number(v));

// Form lập / sửa hợp đồng thuê.
// contract: hợp đồng đang sửa (null khi lập mới); onCancel(); onSaved(message)
function ContractForm({ contract, onCancel, onSaved }) {
  const isEdit = Boolean(contract);
  const [form, setForm] = useState(() => ({
    customer_id: contract ? String(contract.customer_id) : "",
    site_name: contract?.site_name || "",
    site_address: contract?.site_address || "",
    start_date: contract?.start_date?.slice(0, 10) || todayISO(),
    end_date: contract?.end_date?.slice(0, 10) || todayISO(),
    pricing_type: contract?.pricing_type || "DAY",
    transport_fee: contract ? String(contract.transport_fee) : "0",
    discount_rate: contract ? String(contract.discount_rate) : "0",
    vat_rate: contract ? String(contract.vat_rate) : "10",
    note: contract?.note || "",
  }));
  // Máy đã chọn: { [equipment_id]: số giờ dự kiến (chỉ dùng khi thuê theo giờ) }
  const [selected, setSelected] = useState(() =>
    Object.fromEntries((contract?.items || []).map((i) => [i.equipment_id, String(i.planned_duration)])),
  );
  const [machines, setMachines] = useState([]);
  const [machineError, setMachineError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [onlyFree, setOnlyFree] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { data: customers, reload: reloadCustomers } = useApiData("/customers", []);
  const [addingCustomer, setAddingCustomer] = useState(false); // đang mở form thêm khách hàng mới
  const [customerNotice, setCustomerNotice] = useState("");

  // Khách mới chưa có trong danh mục: thêm ngay tại đây, thêm xong tự chọn vào hợp đồng
  const addCustomer = async (values) => {
    try {
      const r = await api.post("/customers", values);
      reloadCustomers(); // tải lại danh sách để khách mới hiện trong ô chọn
      setForm((f) => ({ ...f, customer_id: String(r.id) }));
      setCustomerNotice(`${r.message} Đã chọn vào hợp đồng.`);
      setAddingCustomer(false);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  const datesValid =
    form.start_date &&
    form.end_date &&
    form.end_date >= form.start_date &&
    !dateError(form.start_date) &&
    !dateError(form.end_date);
  const days = datesValid ? daysInclusive(form.start_date, form.end_date) : 0;

  // Tải danh sách máy kèm lịch trống mỗi khi đổi ngày thuê
  useEffect(() => {
    if (!datesValid) return;
    let active = true;
    api
      .get(
        `/equipments/availability?from=${form.start_date}&to=${form.end_date}&excludeContractId=${contract?.id || 0}`,
      )
      .then((rows) => {
        if (!active) return;
        setMachines(rows);
        setMachineError("");
      })
      .catch((err) => active && setMachineError(err.message));
    return () => {
      active = false;
    };
  }, [form.start_date, form.end_date, datesValid, contract?.id]);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggle = (m) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[m.id] !== undefined) delete next[m.id];
      else next[m.id] = "8";
      return next;
    });
  };

  // Các dòng máy đã chọn kèm đơn giá, số lượng thời gian và thành tiền
  const lines = useMemo(
    () =>
      Object.keys(selected)
        .map((id) => machines.find((m) => m.id === Number(id)))
        .filter(Boolean)
        .map((m) => {
          const unit = form.pricing_type === "DAY" ? m.daily_rate : m.hourly_rate;
          const duration = form.pricing_type === "DAY" ? days : num(selected[m.id]);
          return { ...m, unit, duration, amount: Math.round((unit || 0) * duration) };
        }),
    [selected, machines, form.pricing_type, days],
  );

  const totals = calcTotals(lines, num(form.transport_fee), num(form.discount_rate), num(form.vat_rate));

  const visibleMachines = machines.filter((m) => {
    if (selected[m.id] !== undefined) return true;
    if (onlyFree && m.availability !== "FREE") return false;
    const kw = normalizeText(keyword.trim());
    return !kw || normalizeText(`${m.code} ${m.name} ${m.model} ${m.category_name} ${m.brand_name}`).includes(kw);
  });

  const customer = customers.find((c) => String(c.id) === form.customer_id);

  const save = async (submit) => {
    if (!form.customer_id) return setError("Vui lòng chọn khách hàng.");
    if (!form.site_name.trim() || !form.site_address.trim())
      return setError("Vui lòng nhập tên và địa chỉ công trình.");
    const dateMsg = dateError(form.start_date, "Ngày bắt đầu") || dateError(form.end_date, "Ngày kết thúc");
    if (dateMsg) return setError(dateMsg);
    if (!datesValid) return setError("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
    if (lines.length === 0) return setError("Vui lòng chọn ít nhất một thiết bị.");
    const busy = lines.find((l) => l.availability !== "FREE");
    if (busy) return setError(`Máy ${busy.code} không còn trống trong thời gian này, hãy bỏ chọn.`);

    const body = {
      ...form,
      submit,
      items: lines.map((l) => ({ equipment_id: l.id, planned_duration: l.duration })),
    };
    setSaving(true);
    setError("");
    try {
      const r = isEdit ? await api.put(`/contracts/${contract.id}`, body) : await api.post("/contracts", body);
      onSaved(r.message);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>{isEdit ? `Sửa hợp đồng ${contract.contract_no}` : "Lập hợp đồng thuê"}</h1>
        </div>
        <button className="btn btn-secondary" onClick={onCancel}>
          ‹ Quay lại danh sách
        </button>
      </div>

      {contract?.status === "REJECTED" && contract.reject_reason && (
        <div className="alert alert-danger">
          <strong>Lý do bị từ chối:</strong> {contract.reject_reason}
        </div>
      )}

      <div className="contract-form">
        <div>
          {/* Khách hàng và công trình */}
          <section className="panel">
            <header className="panel-header">
              <h2>1. Khách hàng và công trình</h2>
            </header>
            <div className="panel-body">
              <div className="form-grid">
                <div className="form-field form-field-full">
                  <label htmlFor="cf-customer">
                    Khách hàng <span className="required-mark">*</span>
                  </label>
                  <div className="customer-pick">
                    <select id="cf-customer" value={form.customer_id} onChange={set("customer_id")}>
                      <option value="">— Chọn khách hàng —</option>
                      {/* Khách đã ngừng giao dịch không lập hợp đồng mới (vẫn hiện nếu là khách của hợp đồng đang sửa) */}
                      {customers
                        .filter((c) => c.status !== "STOPPED" || String(c.id) === String(form.customer_id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} – {c.name}
                          </option>
                        ))}
                    </select>
                    <button type="button" className="btn btn-secondary" onClick={() => setAddingCustomer(true)}>
                      + Khách hàng mới
                    </button>
                  </div>
                  {customerNotice && <small className="form-hint text-success">{customerNotice}</small>}
                  {customer && (
                    <small className="form-hint">
                      {customer.customer_type === "COMPANY" ? `MST ${customer.tax_code}` : `CCCD ${customer.id_number}`}{" "}
                      · ĐT {customer.phone}
                      {customer.representative ? ` · Đại diện: ${customer.representative}` : ""}
                    </small>
                  )}
                </div>
                <div className="form-field">
                  <label htmlFor="cf-site">
                    Tên công trình <span className="required-mark">*</span>
                  </label>
                  <input id="cf-site" value={form.site_name} onChange={set("site_name")} maxLength={200} />
                </div>
                <div className="form-field">
                  <label htmlFor="cf-address">
                    Địa chỉ công trình <span className="required-mark">*</span>
                  </label>
                  <input id="cf-address" value={form.site_address} onChange={set("site_address")} maxLength={255} />
                </div>
                <div className="form-field">
                  <label htmlFor="cf-start">
                    Ngày bắt đầu <span className="required-mark">*</span>
                  </label>
                  <DateInput
                    id="cf-start"
                    value={form.start_date}
                    onChange={(v) => setForm((f) => ({ ...f, start_date: v }))}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="cf-end">
                    Ngày kết thúc <span className="required-mark">*</span>
                  </label>
                  <DateInput
                    id="cf-end"
                    value={form.end_date}
                    min={form.start_date}
                    onChange={(v) => setForm((f) => ({ ...f, end_date: v }))}
                  />
                  <small className="form-hint">
                    {datesValid ? `Thời gian thuê: ${days} ngày` : "Ngày kết thúc phải sau ngày bắt đầu"}
                  </small>
                </div>
                <div className="form-field form-field-full">
                  <label htmlFor="cf-note">Ghi chú</label>
                  <textarea id="cf-note" rows={2} value={form.note} onChange={set("note")} />
                </div>
              </div>
            </div>
          </section>

          {/* Chọn thiết bị */}
          <section className="panel">
            <header className="panel-header">
              <h2>2. Thiết bị thuê ({lines.length})</h2>
              <div className="pricing-toggle" role="group" aria-label="Hình thức tính giá">
                {[
                  ["DAY", "Tính theo ngày"],
                  ["HOUR", "Tính theo giờ"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    className={form.pricing_type === v ? "active" : ""}
                    onClick={() => setForm((p) => ({ ...p, pricing_type: v }))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>
            <div className="panel-body">
              {lines.length > 0 && (
                <div className="table-wrapper" style={{ marginBottom: 14 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Máy</th>
                        <th className="align-right">Đơn giá</th>
                        <th className="align-right">{form.pricing_type === "DAY" ? "Số ngày" : "Số giờ dự kiến"}</th>
                        <th className="align-right">Thành tiền</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l) => (
                        <tr key={l.id}>
                          <td>
                            <span className="cell-main">
                              {l.code} – {l.name}
                            </span>
                            {l.availability !== "FREE" && (
                              <span className="danger-text">Không còn trống trong thời gian này</span>
                            )}
                          </td>
                          <td className="align-right">
                            {formatMoney(l.unit)}/{form.pricing_type === "DAY" ? "ngày" : "giờ"}
                          </td>
                          <td className="align-right">
                            {form.pricing_type === "DAY" ? (
                              days
                            ) : (
                              <input
                                className="duration-input"
                                type="number"
                                min="1"
                                step="0.5"
                                value={selected[l.id]}
                                onChange={(e) => setSelected((p) => ({ ...p, [l.id]: e.target.value }))}
                                aria-label={`Số giờ thuê máy ${l.code}`}
                              />
                            )}
                          </td>
                          <td className="align-right">
                            <strong>{formatMoney(l.amount)}</strong>
                          </td>
                          <td>
                            <button className="text-action danger" onClick={() => toggle(l)}>
                              Bỏ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="toolbar" style={{ padding: "0 0 10px", border: "none" }}>
                <label className="search-box">
                  <input
                    type="search"
                    placeholder="Tìm máy theo mã, tên, loại…"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </label>
                <label className="form-check">
                  <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
                  <span>Chỉ hiện máy trống</span>
                </label>
              </div>

              {machineError && <div className="modal-error">{machineError}</div>}
              {!datesValid ? (
                <p className="text-muted">Chọn ngày thuê hợp lệ để xem máy còn trống.</p>
              ) : (
                <div className="picker-list">
                  {visibleMachines.length === 0 && <p className="table-message">Không có máy phù hợp.</p>}
                  {visibleMachines.map((m) => {
                    const checked = selected[m.id] !== undefined;
                    const disabled = !checked && m.availability !== "FREE";
                    return (
                      <label
                        key={m.id}
                        className={`picker-item ${checked ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                      >
                        <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(m)} />
                        <EquipmentThumb src={m.image_url} size={40} />
                        <span>
                          <span className="cell-main">
                            {m.code} – {m.name}
                          </span>
                          <span className="cell-sub">
                            {m.category_name} · {m.brand_name}
                            {m.warehouse_name ? ` · ${m.warehouse_name}` : ""}
                            {m.availability === "BUSY" &&
                              ` · Bận: ${m.conflicts.map((c) => `${c.contract_no} (${formatDate(c.start_date)}–${formatDate(c.end_date)})`).join(", ")}`}
                            {m.availability === "NO_PRICE" && " · Chưa có giá thuê"}
                            {m.availability === "INACTIVE" && " · Ngừng hoạt động"}
                          </span>
                        </span>
                        <span className="picker-price">
                          {m.daily_rate ? (
                            <>
                              <strong>{formatMoney(m.daily_rate)}</strong>/ngày
                              <span className="cell-sub">{formatMoney(m.hourly_rate)}/giờ</span>
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Tổng tiền */}
        <aside className="panel form-sticky">
          <header className="panel-header">
            <h2>3. Giá trị hợp đồng</h2>
          </header>
          <div className="panel-body">
            <table className="summary-table">
              <tbody>
                <tr>
                  <td>Tiền thuê ({lines.length} máy)</td>
                  <td>{formatMoney(totals.subtotal)}</td>
                </tr>
                <tr>
                  <td>
                    <span className="summary-inline">
                      Chiết khấu
                      <input
                        type="number"
                        min="0"
                        max="50"
                        step="0.5"
                        value={form.discount_rate}
                        onChange={set("discount_rate")}
                        aria-label="Chiết khấu (%)"
                      />
                      %
                    </span>
                  </td>
                  <td>− {formatMoney(totals.discount)}</td>
                </tr>
                <tr>
                  <td>
                    <span className="summary-inline">
                      Vận chuyển
                      <input
                        className="wide"
                        type="number"
                        min="0"
                        step="100000"
                        value={form.transport_fee}
                        onChange={set("transport_fee")}
                        aria-label="Phí vận chuyển"
                      />
                    </span>
                  </td>
                  <td>{formatMoney(num(form.transport_fee))}</td>
                </tr>
                <tr>
                  <td>
                    <span className="summary-inline">
                      VAT
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={form.vat_rate}
                        onChange={set("vat_rate")}
                        aria-label="Thuế VAT (%)"
                      />
                      %
                    </span>
                  </td>
                  <td>{formatMoney(totals.vat)}</td>
                </tr>
                <tr className="total">
                  <td>Tổng cộng</td>
                  <td>{formatMoney(totals.total)}</td>
                </tr>
              </tbody>
            </table>

            {error && (
              <div className="modal-error" style={{ marginTop: 12 }}>
                {error}
              </div>
            )}

            <div className="form-buttons">
              <button className="btn btn-primary" disabled={saving} onClick={() => save(true)}>
                {saving ? "Đang lưu…" : "Lưu và gửi duyệt"}
              </button>
              <button className="btn btn-secondary" disabled={saving} onClick={() => save(false)}>
                Lưu nháp
              </button>
            </div>
            <p className="calc-note">Sau khi được Quản lý duyệt, khách có 3 ngày để đặt cọc trước khi bàn giao máy.</p>
          </div>
        </aside>
      </div>

      {addingCustomer && (
        <FormModal
          title="Thêm khách hàng mới"
          subtitle="Mã khách hàng được tạo tự động. Thêm xong khách được chọn luôn vào hợp đồng."
          fields={CUSTOMER_FIELDS}
          initialValues={CUSTOMER_EMPTY}
          submitLabel="Thêm và chọn"
          onSubmit={addCustomer}
          onClose={() => setAddingCustomer(false)}
        />
      )}
    </div>
  );
}

export default ContractForm;
