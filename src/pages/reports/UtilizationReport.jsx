import { useState } from "react";
import ReportShell from "./ReportShell";
import useApiData from "../../hooks/useApiData";
import StatusBadge from "../../components/common/StatusBadge";
import { formatDate, formatReportNumber as n, todayISO } from "../../utils/format";
import { EQUIPMENT_STATUS } from "../../utils/labels";
import { dateError } from "../../utils/dateLimits";
import DateInput from "../../components/common/DateInput";

function monthStart(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Mức hiệu suất: mỗi khoảng % một màu (từ cao xuống thấp)
const LEVELS = [
  { min: 80, key: "high", label: "Cao", range: "≥ 80%" },
  { min: 60, key: "good", label: "Khá", range: "60 – 79%" },
  { min: 30, key: "medium", label: "Trung bình", range: "30 – 59%" },
  { min: 0, key: "low", label: "Thấp", range: "< 30%" },
];
const levelOf = (rate) => LEVELS.find((l) => rate >= l.min);

// Báo cáo hiệu suất sử dụng = số ngày máy được thuê ÷ số ngày trong kỳ
function UtilizationReport({ user }) {
  const [range, setRange] = useState({ from: monthStart(-2), to: todayISO() });
  const [draft, setDraft] = useState(range);
  const dateMsg = dateError(range.from, "Từ ngày") || dateError(range.to, "Đến ngày");
  const valid = !dateMsg && range.from && range.to && range.to >= range.from;
  const { data, error } = useApiData(valid ? `/reports/utilization?from=${range.from}&to=${range.to}` : null);
  const rows = data || [];
  const avg = rows.length ? Math.round((rows.reduce((s, r) => s + r.rate, 0) / rows.length) * 10) / 10 : 0;
  const idle = rows.filter((r) => r.rented_days === 0).length;

  return (
    <ReportShell
      title="Báo cáo hiệu suất sử dụng"
      description="Tỉ lệ thời gian mỗi máy được cho thuê (tính từ ngày bàn giao đến ngày thu hồi) trong kỳ đã chọn."
      user={user}
      print={
        data && {
          formCode: "BC03-HS",
          period: `Từ ngày ${formatDate(range.from)} đến ngày ${formatDate(range.to)} (${rows[0]?.period_days || 0} ngày)`,
          unit: "ngày",
          sections: [
            {
              columns: [
                { label: "Mã máy", align: "left", width: 100 },
                { label: "Tên thiết bị", align: "left" },
                { label: "Số lượt thuê", align: "right", width: 70 },
                { label: "Số ngày được thuê", align: "right", width: 80 },
                { label: "Số ngày trong kỳ", align: "right", width: 80 },
                { label: "Hiệu suất (%)", align: "right", width: 75 },
                { label: "Xếp loại", align: "center", width: 85 },
              ],
              rows: [
                ...rows.map((r) => ({
                  cells: [
                    r.code,
                    r.name,
                    n(r.rentals),
                    n(r.rented_days),
                    n(r.period_days),
                    n(r.rate, 1),
                    levelOf(r.rate).label,
                  ],
                })),
                {
                  kind: "total",
                  cells: [
                    "Bình quân",
                    `${rows.length} máy`,
                    n(rows.reduce((s, r) => s + r.rentals, 0)),
                    n(rows.reduce((s, r) => s + r.rented_days, 0)),
                    "",
                    n(avg, 1),
                    levelOf(avg).label,
                  ],
                },
              ],
            },
          ],
          notes: [
            "Ghi chú: (4) = (2) / (3) × 100. Xếp loại: Cao ≥ 80%; Khá 60 – 79%; Trung bình 30 – 59%; Thấp < 30%.",
          ],
        }
      }
      canExport={Boolean(rows.length)}
      filters={
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setRange(draft);
          }}
        >
          <label>
            Từ ngày
            <DateInput value={draft.from} onChange={(v) => setDraft((d) => ({ ...d, from: v }))} />
          </label>
          <label>
            Đến ngày
            <DateInput value={draft.to} min={draft.from} onChange={(v) => setDraft((d) => ({ ...d, to: v }))} />
          </label>
          <button className="btn btn-primary" type="submit">
            Xem báo cáo
          </button>
        </form>
      }
    >
      {!valid && <div className="modal-error">{dateMsg || "Ngày kết thúc phải sau ngày bắt đầu."}</div>}
      {error && <div className="modal-error">{error}</div>}
      {data && (
        <>
          <div className="report-kpis">
            <div className="kpi">
              <span>Kỳ báo cáo</span>
              <strong style={{ fontSize: 17 }}>
                {formatDate(range.from)} – {formatDate(range.to)}
              </strong>
              <small>{rows[0]?.period_days || 0} ngày</small>
            </div>
            <div className="kpi">
              <span>Hiệu suất trung bình</span>
              <strong className={`level-text level-${levelOf(avg).key}`}>{avg}%</strong>
              <small>Mức {levelOf(avg).label.toLowerCase()}</small>
            </div>
            <div className="kpi">
              <span>Máy không được thuê trong kỳ</span>
              <strong>{idle}</strong>
              <small>trên {rows.length} máy</small>
            </div>
          </div>

          <section className="catalog-card">
            <div className="level-legend">
              <span className="text-muted">Mức hiệu suất:</span>
              {LEVELS.map((l) => (
                <span key={l.key} className="level-legend-item">
                  <i className={`level-dot level-${l.key}`} />
                  {l.label} ({l.range}) · <strong>{rows.filter((r) => levelOf(r.rate) === l).length}</strong> máy
                </span>
              ))}
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Máy</th>
                    <th>Loại</th>
                    <th>Trạng thái</th>
                    <th className="align-right">Lượt thuê</th>
                    <th className="align-right">Ngày được thuê</th>
                    <th>Hiệu suất</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="cell-main">{r.code}</span>
                        <span className="cell-sub">{r.name}</span>
                      </td>
                      <td>{r.category_name}</td>
                      <td>
                        <StatusBadge map={EQUIPMENT_STATUS} value={r.status} />
                      </td>
                      <td className="align-right">{r.rentals}</td>
                      <td className="align-right">
                        {r.rented_days} / {r.period_days}
                      </td>
                      <td>
                        <div className="meter" title={`${r.rate}% – mức ${levelOf(r.rate).label.toLowerCase()}`}>
                          <div className="meter-track">
                            <div
                              className={`meter-fill level-${levelOf(r.rate).key}`}
                              style={{ width: `${r.rate}%` }}
                            />
                          </div>
                          <span className={`meter-value level-text level-${levelOf(r.rate).key}`}>{r.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ReportShell>
  );
}

export default UtilizationReport;
