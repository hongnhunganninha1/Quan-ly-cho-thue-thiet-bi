// Ảnh nhỏ của thiết bị trong bảng. Chưa có ảnh thì hiện biểu tượng máy xây dựng.
function EquipmentThumb({ src, alt = "", size = 48 }) {
  const style = { width: size, height: size };
  if (src) return <img className="eq-thumb" src={src} alt={alt} style={style} loading="lazy" />;
  return (
    <span className="eq-thumb eq-thumb-empty" style={style} aria-hidden="true">
      <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="14" width="11" height="4" rx="2" />
        <path d="M5 14v-3h5l2 3M10 11l5-5 4 3-2 3" />
        <path d="M17 12l2 3h-3" />
      </svg>
    </span>
  );
}

export default EquipmentThumb;
