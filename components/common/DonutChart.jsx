import { useState } from "react";
import "./DonutChart.css";

// Biểu đồ tròn dạng vành khuyên (donut).
// data: [{ key, label, value, color }]; centerLabel: chữ nhỏ dưới tổng ở giữa vòng.
// Rê chuột vào một phần (hoặc dòng chú thích) thì phần đó nổi lên và giữa vòng hiện số liệu của phần đó.
function DonutChart({ data, centerLabel = "Tổng", size = 180 }) {
  const [active, setActive] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = 70;
  const stroke = 26;
  const C = 2 * Math.PI * r;
  const gap = total > 0 && data.filter((d) => d.value > 0).length > 1 ? 2 : 0; // khe trắng 2px giữa các phần

  // Độ dài cung của từng phần và vị trí bắt đầu (cộng dồn các phần trước)
  const lengths = data.map((d) => (total ? (d.value / total) * C : 0));
  const segments = data.map((d, i) => ({
    ...d,
    len: lengths[i],
    offset: lengths.slice(0, i).reduce((a, b) => a + b, 0),
  }));

  const shown = active ? data.find((d) => d.key === active) : null;
  const percent = (v) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div className="donut">
      <svg
        viewBox="0 0 180 180"
        width={size}
        height={size}
        role="img"
        aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}
      >
        <circle cx="90" cy="90" r={r} fill="none" stroke="#eef2f7" strokeWidth={stroke} />
        <g transform="rotate(-90 90 90)">
          {segments.map((s) =>
            s.len > 0 ? (
              <circle
                key={s.key}
                cx="90"
                cy="90"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.key ? stroke + 6 : stroke}
                strokeDasharray={`${Math.max(0, s.len - gap)} ${C}`}
                strokeDashoffset={-s.offset}
                opacity={active && active !== s.key ? 0.35 : 1}
                className="donut-segment"
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
              >
                <title>{`${s.label}: ${s.value} (${percent(s.value)}%)`}</title>
              </circle>
            ) : null,
          )}
        </g>
        <text x="90" y={shown ? 84 : 92} textAnchor="middle" className="donut-value">
          {shown ? shown.value : total}
        </text>
        <text x="90" y={shown ? 103 : 112} textAnchor="middle" className="donut-label">
          {shown ? shown.label : centerLabel}
        </text>
        {shown && (
          <text x="90" y="119" textAnchor="middle" className="donut-label">
            {percent(shown.value)}%
          </text>
        )}
      </svg>

      <ul className="donut-legend">
        {data.map((d) => (
          <li
            key={d.key}
            className={active === d.key ? "active" : ""}
            onMouseEnter={() => setActive(d.key)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="donut-dot" style={{ background: d.color }}></span>
            <span className="donut-name">{d.label}</span>
            <strong>{d.value}</strong>
            <span className="donut-percent">{percent(d.value)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DonutChart;
