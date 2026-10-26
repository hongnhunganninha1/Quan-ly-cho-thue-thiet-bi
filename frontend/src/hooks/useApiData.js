import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

// Tải dữ liệu từ một API GET khi mở trang.
// Trả về { data, error, loading, reload }. path = null thì không tải.
function useApiData(path, initial = null) {
  const [data, setData] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(path));
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    api
      .get(path)
      .then((d) => {
        if (!active) return;
        setData(d);
        setError("");
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { data, error, loading, reload };
}

export default useApiData;
