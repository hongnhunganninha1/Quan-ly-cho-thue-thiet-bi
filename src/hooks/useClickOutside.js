import { useEffect, useRef } from "react";

// Gọi onOutside khi người dùng bấm ra ngoài phần tử được gắn ref (dùng để đóng menu xổ xuống).
// Cách dùng: const ref = useClickOutside(open, () => setOpen(false)); rồi gắn ref={ref} vào khung bao.
function useClickOutside(active, onOutside) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;

    const handleMouseDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [active, onOutside]);

  return ref;
}

export default useClickOutside;
