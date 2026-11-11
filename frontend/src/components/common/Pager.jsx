import { PAGE_SIZES } from "../../hooks/usePager";

// Ô chọn số dòng mỗi trang (đặt ở góc phải thanh công cụ của bảng)
export function PageSizeSelect({ pager }) {
  return (
    <select
      className="toolbar-select page-size-select"
      value={pager.pageSize}
      onChange={(e) => pager.setPageSize(Number(e.target.value))}
      aria-label="Số dòng mỗi trang"
      title="Số dòng mỗi trang"
    >
      {PAGE_SIZES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

// Các số trang hiển thị: 3 trang liền nhau quanh trang hiện tại (VD 1 2 3 …, 2 3 4 …),
// còn trang phía trước / phía sau thì hiện "…"; về trang đầu / trang cuối bằng nút « »
function pageList(page, totalPages) {
  const first = Math.max(1, Math.min(page - 1, totalPages - 2));
  const last = Math.min(totalPages, first + 2);
  const pages = [];
  if (first > 1) pages.push("…");
  for (let p = first; p <= last; p++) pages.push(p);
  if (last < totalPages) pages.push("…");
  return pages;
}

// Chân bảng: "Hiển thị 1 – 10 / 25 bản ghi" bên trái, nút chuyển trang « ‹ 1 2 3 › » bên phải
function PagerFooter({ pager }) {
  const { page, totalPages, total, start, pageRows, setPage } = pager;
  const from = total === 0 ? 0 : start + 1;
  const to = start + pageRows.length;
  return (
    <div className="pager">
      <span className="pager-info">
        Hiển thị {from} – {to} / {total} bản ghi
      </span>
      <div className="pager-buttons">
        <button disabled={page === 1} onClick={() => setPage(1)} aria-label="Trang đầu" title="Trang đầu">
          «
        </button>
        <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Trang trước" title="Trang trước">
          ‹
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap${i}`} className="pager-gap">
              …
            </span>
          ) : (
            <button key={p} className={p === page ? "active" : ""} onClick={() => setPage(p)}>
              {p}
            </button>
          ),
        )}
        <button disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Trang sau" title="Trang sau">
          ›
        </button>
        <button disabled={page === totalPages} onClick={() => setPage(totalPages)} aria-label="Trang cuối" title="Trang cuối">
          »
        </button>
      </div>
    </div>
  );
}

export default PagerFooter;
