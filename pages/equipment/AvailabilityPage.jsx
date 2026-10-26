import { useMemo, useState } from "react";
import "../catalog/CatalogPage.css";
import "./Equipment.css";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import StatusBadge from "../../components/common/StatusBadge";
import EquipmentThumb from "../../components/common/EquipmentThumb";
import { daysInclusive, formatDate, formatMoney, normalizeText, todayISO } from "../../utils/format";
import { CONTRACT_STATUS, EQUIPMENT_STATUS } from "../../utils/labels";
import { categoryFilterOptions, matchCategory, renderOptions } from "../../utils/options";
import { exportExcel } from "../../utils/exportExcel";
import { dateError } from "../../utils/dateLimits";
import DateInput from "../../components/common/DateInput";

const AVAILABILITY = {
  FREE: { label: "Trống cả khoảng", badge: "badge-success" },
  BUSY: { label: "Trùng lịch", badge: "badge-danger" },
  NO_PRICE: { label: "Chưa có giá", badge: "badge-warning" },
  INACTIVE: { label: "Ngừng hoạt động", badge: "badge-neutral" },
};

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayDiff(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
}

const VIEW_MIN_DAYS = 30; // thanh lịch luôn hiển thị ít nhất 30 ngày kể từ ngày bắt đầu

// Màu đoạn lịch trên thanh theo trạng thái hợp đồng
function bookingClass(b) {
  if (b.overdue) return "bk-overdue";
  return (
    { PENDING_APPROVAL: "bk-pending", APPROVED: "bk-approved", ACTIVE: "bk-active" }[b.contract_status] || "bk-active"
  );
}

// Thanh lịch của một máy: vùng xanh là khoảng khách cần, các đoạn màu là lịch đã đặt
function ScheduleBar({ bookings, from, to, viewTo }) {
  const total = dayDiff(from, viewTo) + 1;
  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div className="sched">
      <div className="sched-track">
        <div className="sched-range" style={{ left: 0, width: pct(dayDiff(from, to) + 1) }} />
        {bookings.map((b) => {
          const s = b.start_date < from ? from : b.start_date;
          const e = b.overdue || b.end_date > viewTo ? viewTo : b.end_date;
          if (s > viewTo) return null;
          return (
            <div
              key={b.contract_id}
              className={`sched-bk ${bookingClass(b)}`}
              style={{ left: pct(dayDiff(from, s)), width: pct(dayDiff(s, e) + 1) }}
              title={`${b.contract_no} · ${b.customer_name}\n${formatDate(b.start_date)} – ${formatDate(b.end_date)} (${
                b.overdue ? "quá hạn chưa trả" : CONTRACT_STATUS[b.contract_status].label.toLowerCase()
              })`}
            />
          );
        })}
      </div>
      <div className="sched-scale">
        <span>{formatDate(from).slice(0, 5)}</span>
        <span>{formatDate(viewTo).slice(0, 5)}</span>
      </div>
    </div>
  );
}

// Màn Tra cứu lịch trống: chọn khoảng ngày, xem máy nào còn trống để lập hợp đồng
function AvailabilityPage({ onNavigate }) {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(addDays(todayISO(), 6));
  const [category, setCategory] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { data: categories } = useApiData("/categories", []);
  const { data: warehouses } = useApiData("/warehouses", []);
  const [warehouse, setWarehouse] = useState(""); // "" = tất cả, "SITE" = đang ở công trình

  const search = async (e) => {
    e?.preventDefault();
    if (!from || !to) return setError("Vui lòng chọn khoảng ngày.");
    const dateMsg = dateError(from, "Từ ngày") || dateError(to, "Đến ngày");
    if (dateMsg) return setError(dateMsg);
    if (to < from) return setError("Ngày kết thúc phải sau ngày bắt đầu.");
    setLoading(true);
    try {
      setRows(await api.get(`/equipments/availability?from=${from}&to=${to}`));
      setShown({ from, to });
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const kw = normalizeText(keyword.trim());
    return rows.filter(
      (r) =>
        (!category || matchCategory(r, category)) &&
        (!warehouse || (warehouse === "SITE" ? !r.warehouse_id : String(r.warehouse_id) === warehouse)) &&
        (!onlyFree || r.availability === "FREE") &&
        (!kw || normalizeText(`${r.code} ${r.name} ${r.model} ${r.brand_name}`).includes(kw)),
    );
  }, [rows, category, warehouse, onlyFree, keyword]);

  const freeCount = filtered.filter((r) => r.availability === "FREE").length;

  // Xuất danh sách đang hiển thị (đã lọc) ra Excel
  const exportFile = () => {
    const d = (x) => formatDate(x);
    exportExcel({
      fileName: `tra-cuu-lich-trong_${shown.from}_${shown.to}.xlsx`,
      sheetName: "Lịch trống",
      title: "TRA CỨU LỊCH TRỐNG THIẾT BỊ",
      subtitle: `Khoảng ngày khách cần: ${d(shown.from)} – ${d(shown.to)} (${daysInclusive(shown.from, shown.to)} ngày) · Xuất lúc ${new Date().toLocaleString("vi-VN")}`,
      columns: [
        { label: "STT", width: 6 },
        { label: "Mã máy", width: 15 },
        { label: "Thiết bị", width: 40 },
        { label: "Nhóm / loại", width: 30 },
        { label: "Vị trí", width: 18 },
        { label: "Trạng thái hiện tại", width: 18 },
        { label: "Giá ngày (đ)", width: 14, type: "number" },
        { label: "Giá giờ (đ)", width: 13, type: "number" },
        { label: "Kết quả", width: 16 },
        { label: "Lịch trùng", width: 42 },
        { label: "Gợi ý", width: 34 },
      ],
      rows: filtered.map((r, i) => [
        i + 1,
        r.code,
        r.name,
        `${r.group_name ? `${r.group_name} › ` : ""}${r.category_name}`,
        r.warehouse_name || (r.status === "RENTED" ? "Tại công trình" : ""),
        EQUIPMENT_STATUS[r.status]?.label,
        r.daily_rate === null ? null : Number(r.daily_rate),
        r.hourly_rate === null ? null : Number(r.hourly_rate),
        AVAILABILITY[r.availability].label,
        r.conflicts
          .map(
            (c) =>
              `${c.contract_no} – ${c.customer_name}: ${d(c.start_date)} – ${d(c.end_date)}${c.overdue ? " (quá hạn chưa trả)" : ""}`,
          )
          .join("\n"),
        [
          r.free_until ? `Vẫn trống ${d(shown.from)} – ${d(r.free_until)}` : "",
          r.availability === "BUSY"
            ? r.suggest_from
              ? `Trống đủ ${daysInclusive(shown.from, shown.to)} ngày từ ${d(r.suggest_from)}`
              : "Chưa xác định (máy quá hạn chưa trả)"
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ]),
    });
  };
  // Khoảng ngày của thanh lịch (giữ theo lần tra cứu gần nhất)
  const [shown, setShown] = useState(null);
  const viewTo = shown
    ? shown.to > addDays(shown.from, VIEW_MIN_DAYS - 1)
      ? shown.to
      : addDays(shown.from, VIEW_MIN_DAYS - 1)
    : null;

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Tra cứu lịch trống</h1>
        </div>
        <div className="heading-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={exportFile}
            disabled={!rows || filtered.length === 0}
            title={rows ? "Xuất danh sách đang hiển thị ra file Excel" : "Tra cứu trước rồi mới xuất file"}
          >
            Xuất Excel
          </button>
          <button className="btn btn-accent" onClick={() => onNavigate("rent-contract")}>
            Lập hợp đồng
          </button>
        </div>
      </div>

      <section className="catalog-card">
        <form className="filter-bar availability-filters" onSubmit={search}>
          <label>
            Từ ngày
            <DateInput className="filter-date" value={from} onChange={setFrom} />
          </label>
          <label>
            Đến ngày
            <DateInput className="filter-date" value={to} min={from} onChange={setTo} />
          </label>
          <label>
            Loại thiết bị
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Tất cả</option>
              {renderOptions(categoryFilterOptions(categories))}
            </select>
          </label>
          <label>
            Bãi máy
            <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
              <option value="">Tất cả</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
              <option value="SITE">Đang ở công trình</option>
            </select>
          </label>
          <label className="search-field">
            Tìm máy
            <input
              type="search"
              placeholder="Mã, tên, model…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
          <label className="filter-check">
            <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
            <span>Chỉ máy trống</span>
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Đang tra cứu…" : "Tra cứu"}
          </button>
        </form>

        {error && (
          <div className="modal-error" style={{ margin: 16 }}>
            {error}
          </div>
        )}

        {rows && shown && (
          <>
            <div className="summary-chips">
              <span className="badge badge-info">
                Khách cần: {formatDate(shown.from)} – {formatDate(shown.to)} ({daysInclusive(shown.from, shown.to)}{" "}
                ngày)
              </span>
              <span className="badge badge-success">{freeCount} máy trống cả khoảng</span>
              <span className="badge badge-neutral">{filtered.length} máy trong danh sách</span>
            </div>
            <div className="sched-legend">
              <span>
                <i className="sched-range-swatch" /> Khoảng khách cần
              </span>
              <span>
                <i className="sched-bk bk-pending" /> Chờ duyệt
              </span>
              <span>
                <i className="sched-bk bk-approved" /> Đã duyệt (giữ chỗ)
              </span>
              <span>
                <i className="sched-bk bk-active" /> Đang thuê
              </span>
              <span>
                <i className="sched-bk bk-overdue" /> Quá hạn chưa trả
              </span>
              <span className="text-muted">
                Thanh lịch hiển thị {formatDate(shown.from)} – {formatDate(viewTo)}; rê chuột vào đoạn màu để xem hợp
                đồng.
              </span>
            </div>
          </>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Thiết bị</th>
                <th>Vị trí / trạng thái hiện tại</th>
                <th className="align-right">Giá ngày / giờ</th>
                <th className="col-schedule">Lịch thuê</th>
                <th>Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {!rows ? (
                <tr>
                  <td colSpan={5} className="table-message">
                    Chọn khoảng ngày rồi bấm Tra cứu.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table-message">
                    Không có máy phù hợp.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="cell-wrap">
                      <div className="thumb-cell">
                        <EquipmentThumb src={r.image_url} alt={r.name} size={40} />
                        <div>
                          <span className="cell-main">{r.name}</span>
                          <span className="cell-sub">
                            <strong>{r.code}</strong> · {r.group_name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cell-main">
                        {r.warehouse_name || (
                          <span className="text-muted">{r.status === "RENTED" ? "Tại công trình" : "—"}</span>
                        )}
                      </span>
                      <StatusBadge map={EQUIPMENT_STATUS} value={r.status} />
                    </td>
                    <td className="align-right">
                      {r.daily_rate ? (
                        <>
                          <span className="cell-main">{formatMoney(r.daily_rate)}</span>
                          <span className="cell-sub">{formatMoney(r.hourly_rate)}/giờ</span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="col-schedule">
                      <ScheduleBar bookings={r.bookings} from={shown.from} to={shown.to} viewTo={viewTo} />
                    </td>
                    <td className="cell-wrap col-result">
                      <StatusBadge map={AVAILABILITY} value={r.availability} />
                      <div className="conflict-list">
                        {r.availability === "FREE" && <span>Lập hợp đồng được cho khoảng ngày này.</span>}
                        {r.availability === "INACTIVE" && (
                          <span>Máy đang hỏng / bảo dưỡng, sửa xong thì đổi về Sẵn sàng.</span>
                        )}
                        {r.availability === "NO_PRICE" && <span>Máy trống nhưng chưa có giá thuê.</span>}
                        {r.conflicts.map((c) => (
                          <span key={c.contract_id}>
                            Trùng {c.contract_no}: {formatDate(c.start_date)} – {formatDate(c.end_date)}
                            {c.overdue
                              ? " (quá hạn chưa trả)"
                              : ` (${CONTRACT_STATUS[c.contract_status].label.toLowerCase()})`}
                          </span>
                        ))}
                        {r.free_until && (
                          <span className="text-success">
                            Vẫn trống {formatDate(shown.from)} – {formatDate(r.free_until)}
                          </span>
                        )}
                        {r.availability === "BUSY" &&
                          (r.suggest_from ? (
                            <span className="text-success">
                              Gợi ý: trống đủ {daysInclusive(shown.from, shown.to)} ngày từ {formatDate(r.suggest_from)}
                            </span>
                          ) : (
                            <span>Chưa xác định ngày trống (máy quá hạn chưa trả).</span>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default AvailabilityPage;
