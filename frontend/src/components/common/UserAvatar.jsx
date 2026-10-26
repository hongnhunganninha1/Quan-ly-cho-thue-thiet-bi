// Ảnh đại diện tròn của người dùng; chưa có ảnh thì hiện chữ cái đầu của tên
function UserAvatar({ name = "", url, size = 36 }) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (url) return <img className="avatar avatar-img" src={url} alt={name} style={style} />;
  return (
    <div className="avatar" style={style} aria-hidden="true">
      {name.trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}
    </div>
  );
}

export default UserAvatar;
