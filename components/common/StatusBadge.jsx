// Nhãn trạng thái có màu. map: một bảng trong utils/labels.js (VD: CONTRACT_STATUS); value: mã trạng thái.
function StatusBadge({ map, value }) {
  const item = map[value];
  if (!item) return <span className="badge badge-neutral">{value}</span>;
  return <span className={`badge ${item.badge}`}>{item.label}</span>;
}

export default StatusBadge;
