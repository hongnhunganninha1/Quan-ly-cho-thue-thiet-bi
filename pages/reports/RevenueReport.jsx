import { useState } from "react";
import ReportShell from "./ReportShell";
import useApiData from "../../hooks/useApiData";
import { formatMoney, formatReportNumber as n } from "../../utils/format";

// Báo cáo doanh thu theo tháng (tính theo ngày xác nhận quyết toán)
function RevenueReport({ user }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, error } = useApiData(`/reports/revenue?year=${year}`);
  const months = data?.months || [];
  const sum = (key) => months.reduce((s, m) => s + Number(m[key] || 0), 0);
  const max = Math.max(1, ...months.map((m) => Number(m.revenue)));
  const years = Array.from(new Set([new Date().getFullYear(), ...(data?.years || [])])).sort((a, b) => b - a);
  const best = months.reduce((b, m) => (Number(m.revenue) > Number(b?.revenue || 0) ? m : b), null);

  return (
    <ReportShell
      title="Báo cáo doanh thu"
      description="Doanh thu ghi nhận theo tháng xác nhận quyết toán hợp đồng (chưa gồm VAT)."
      user={user}
      print={{
        formCode: "BC02-DT",
        period: `Từ ngày 01/01/${year} đến ngày 31/12/${year}`,
        unit: "đồng",
        signerType: "finance",
        sections: [
          {
            columns: [
              { label: "Tháng", align: "left", width: 105 },
              { label: "Số hợp đồng quyết toán", align: "right", width: 90 },
              { label: "Tiền thuê máy", align: "right" },
              { label: "Phí trễ hạn, vượt giờ", align: "right" },
              { label: "Tiền bồi thường", align: "right" },
              { label: "Doanh thu (chưa VAT)", align: "right" },
              { label: "Thuế GTGT", align: "right" },
              { label: "Tổng tiền thanh toán", align: "right" },
            ],
            rows: [
              ...months.map((m) => ({
                cells: [
                  `Tháng ${Number(m.period.slice(5))}`,
                  n(m.contracts),
                  n(m.rental_revenue),
                  n(m.extra_fees),
                  n(m.compensation),
                  n(m.revenue),
                  n(m.vat),
                  n(Number(m.revenue) + Number(m.vat)),
                ],
              })),
              {
                kind: "total",
                cells: [
                  "Cộng cả năm",
                  n(sum("contracts")),
                  n(sum("rental_revenue")),
                  n(sum("extra_fees")),
                  n(sum("compensation")),
                  n(sum("revenue")),
                  n(sum("vat")),
                  n(sum("revenue") + sum("vat")),
                ],
              },
            ],
          },
        ],
        notes: [
          "Ghi chú: Doanh thu ghi nhận theo ngày xác nhận quyết toán hợp đồng. (5) = (2) + (3) + (4); (7) = (5) + (6). Thuế GTGT không tính trên tiền bồi thường.",
        ],
      }}
      canExport={Boolean(data)}
      filters={
        <div className="filter-bar">
          <label>
            Năm
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
    >
      {error && <div className="modal-error">{error}</div>}
      {data && (
        <>
          <div className="report-kpis">
            <div className="kpi">
              <span>Doanh thu năm {year}</span>
              <strong>{formatMoney(sum("revenue"))}</strong>
              <small>VAT: {formatMoney(sum("vat"))}</small>
            </div>
            <div className="kpi">
              <span>Hợp đồng đã quyết toán</span>
              <strong>{sum("contracts")}</strong>
            </div>
            <div className="kpi">
              <span>Phí trễ hạn + vượt giờ</span>
              <strong>{formatMoney(sum("extra_fees"))}</strong>
            </div>
            <div className="kpi">
              <span>Tháng cao nhất</span>
              <strong>{best ? `Tháng ${Number(best.period.slice(5))}` : "—"}</strong>
              <small>{best ? formatMoney(best.revenue) : "Chưa có doanh thu"}</small>
            </div>
          </div>

          <section className="catalog-card">
            <header className="panel-header">
              <h2>Doanh thu theo tháng</h2>
            </header>
            <div className="bar-chart" role="img" aria-label={`Biểu đồ doanh thu các tháng năm ${year}`}>
              {months.map((m) => (
                <div className="bar-col" key={m.period}>
                  <span className="bar-tip">
                    Tháng {Number(m.period.slice(5))}: {formatMoney(m.revenue)} · {m.contracts} HĐ
                  </span>
                  <div className="bar" style={{ height: `${(Number(m.revenue) / max) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="bar-labels">
              {months.map((m) => (
                <span key={m.period}>T{Number(m.period.slice(5))}</span>
              ))}
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tháng</th>
                    <th className="align-right">Số HĐ</th>
                    <th className="align-right">Tiền thuê</th>
                    <th className="align-right">Phí trễ hạn + vượt giờ</th>
                    <th className="align-right">Bồi thường</th>
                    <th className="align-right">Doanh thu</th>
                    <th className="align-right">VAT</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.period}>
                      <td>Tháng {Number(m.period.slice(5))}</td>
                      <td className="align-right">{m.contracts}</td>
                      <td className="align-right">{formatMoney(m.rental_revenue)}</td>
                      <td className="align-right">{formatMoney(m.extra_fees)}</td>
                      <td className="align-right">{formatMoney(m.compensation)}</td>
                      <td className="align-right">
                        <strong>{formatMoney(m.revenue)}</strong>
                      </td>
                      <td className="align-right">{formatMoney(m.vat)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Cả năm</td>
                    <td className="align-right">{sum("contracts")}</td>
                    <td className="align-right">{formatMoney(sum("rental_revenue"))}</td>
                    <td className="align-right">{formatMoney(sum("extra_fees"))}</td>
                    <td className="align-right">{formatMoney(sum("compensation"))}</td>
                    <td className="align-right">{formatMoney(sum("revenue"))}</td>
                    <td className="align-right">{formatMoney(sum("vat"))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </ReportShell>
  );
}

export default RevenueReport;
