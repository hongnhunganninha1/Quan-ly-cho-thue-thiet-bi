import { useState } from "react";
import ReportShell from "./ReportShell";
import useApiData from "../../hooks/useApiData";
import StatusBadge from "../../components/common/StatusBadge";
import { formatDate, formatMoney, formatReportNumber as n, todayISO } from "../../utils/format";
import { CONTRACT_STATUS, PRICING_TYPE, toOptions } from "../../utils/labels";
import { dateError } from "../../utils/dateLimits";
import DateInput from "../../components/common/DateInput";

// Báo cáo hợp đồng thuê: các hợp đồng có ngày bắt đầu trong kỳ
function ContractReport({ user }) {
  const year = new Date().getFullYear();
  const [filter, setFilter] = useState({ from: `${year}-01-01`, to: todayISO(), status: "" });
  const [draft, setDraft] = useState(filter);
  const dateMsg = dateError(filter.from, "Từ ngày") || dateError(filter.to, "Đến ngày");
  const valid = !dateMsg && filter.from && filter.to && filter.to >= filter.from;
  const { data, error } = useApiData(
    valid ? `/reports/contracts?from=${filter.from}&to=${filter.to}&status=${filter.status}` : null,
  );
  const rows = data || [];
  const counted = rows.filter((r) => !["CANCELLED", "REJECTED", "DRAFT"].includes(r.status));
  const totalValue = counted.reduce((s, r) => s + Number(r.total_amount), 0);
  const overdue = rows.filter((r) => r.overdue_days > 0).length;
  const dueSoon = rows.filter((r) => r.due_soon).length;

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <ReportShell
      title="Báo cáo hợp đồng thuê"
      description="Danh sách hợp đồng có ngày bắt đầu thuê trong kỳ, kèm giá trị và tình trạng."
      user={user}
      print={{
        formCode: "BC04-HD",
        period: `Từ ngày ${formatDate(filter.from)} đến ngày ${formatDate(filter.to)}${filter.status ? ` – Trạng thái: ${CONTRACT_STATUS[filter.status].label}` : ""}`,
        unit: "đồng",
        sections: [
          {
            columns: [
              { label: "Số hợp đồng", align: "left", width: 110 },
              { label: "Khách hàng", align: "left" },
              { label: "Ngày bắt đầu", align: "center", width: 85 },
              { label: "Ngày kết thúc", align: "center", width: 85 },
              { label: "Hình thức thuê", align: "center", width: 80 },
              { label: "Giá trị hợp đồng", align: "right", width: 120 },
              { label: "Tiền đặt cọc", align: "right", width: 110 },
              { label: "Tình trạng", align: "left", width: 120 },
            ],
            rows: [
              ...rows.map((r) => ({
                cells: [
                  r.contract_no,
                  r.customer_name,
                  formatDate(r.start_date),
                  formatDate(r.end_date),
                  PRICING_TYPE[r.pricing_type],
                  n(r.total_amount),
                  n(r.deposit_amount),
                  CONTRACT_STATUS[r.status].label + (r.overdue_days > 0 ? ` (quá hạn ${r.overdue_days} ngày)` : ""),
                ],
              })),
              {
                kind: "total",
                cells: [
                  "Tổng cộng",
                  `${counted.length} hợp đồng có hiệu lực`,
                  "",
                  "",
                  "",
                  n(totalValue),
                  n(counted.reduce((s, r) => s + Number(r.deposit_amount || 0), 0)),
                  "",
                ],
              },
            ],
          },
        ],
        notes: ["Ghi chú: Dòng Tổng cộng không tính hợp đồng nháp, bị từ chối và đã huỷ."],
      }}
      canExport={Boolean(rows.length)}
      filters={
        <form
          className="filter-bar"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter(draft);
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
          <label>
            Trạng thái
            <select value={draft.status} onChange={set("status")}>
              <option value="">Tất cả</option>
              {toOptions(CONTRACT_STATUS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
              <span>Số hợp đồng</span>
              <strong>{rows.length}</strong>
              <small>{counted.length} hợp đồng có hiệu lực</small>
            </div>
            <div className="kpi">
              <span>Tổng giá trị (có hiệu lực)</span>
              <strong>{formatMoney(totalValue)}</strong>
            </div>
            <div className="kpi">
              <span>Đang quá hạn trả máy</span>
              <strong>{overdue}</strong>
              <small>{dueSoon} hợp đồng sắp đến hạn (≤ 3 ngày)</small>
            </div>
          </div>

          <section className="catalog-card">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Số hợp đồng</th>
                    <th>Khách hàng</th>
                    <th>Thời gian</th>
                    <th>Hình thức</th>
                    <th className="align-right">Giá trị</th>
                    <th className="align-right">Tiền cọc</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="table-message">
                        Không có hợp đồng nào trong kỳ.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <strong>{r.contract_no}</strong>
                        </td>
                        <td>{r.customer_name}</td>
                        <td>
                          {formatDate(r.start_date)} – {formatDate(r.end_date)}
                          {r.overdue_days > 0 && <span className="danger-text">Quá hạn {r.overdue_days} ngày</span>}
                          {r.due_soon === 1 && <span className="warn-text">Sắp đến hạn</span>}
                        </td>
                        <td>{PRICING_TYPE[r.pricing_type]}</td>
                        <td className="align-right">{formatMoney(r.total_amount)}</td>
                        <td className="align-right">
                          {r.deposit_amount ? formatMoney(r.deposit_amount) : <span className="text-muted">—</span>}
                        </td>
                        <td>
                          <StatusBadge map={CONTRACT_STATUS} value={r.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ReportShell>
  );
}

export default ContractReport;
