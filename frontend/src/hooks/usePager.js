import { useState } from "react";

export const PAGE_SIZES = [10, 20, 50];

// Phân trang phía trình duyệt cho một danh sách đã lọc.
//   rows     : các dòng sau khi lọc / sắp xếp
//   resetKey : đổi tab / từ khoá / bộ lọc thì truyền giá trị khác → tự quay về trang 1
// Trả về { pageRows, page, pageSize, total, totalPages, setPage, setPageSize, start }
function usePager(rows, resetKey = "") {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const [pageSize, setSize] = useState(PAGE_SIZES[0]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const wanted = state.key === resetKey ? state.page : 1; // bộ lọc vừa đổi thì về trang 1
  const page = Math.min(Math.max(1, wanted), totalPages);
  const start = (page - 1) * pageSize;

  return {
    pageRows: rows.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
    start,
    setPage: (p) => setState({ key: resetKey, page: p }),
    setPageSize: (n) => {
      setSize(n);
      setState({ key: resetKey, page: 1 });
    },
  };
}

export default usePager;
