// Dòng bản quyền hiển thị ở cuối mọi màn hình
export const COPYRIGHT = "© 2026 Bản quyền thuộc về Comacpro";

function Footer({ className = "" }) {
  return <footer className={`app-footer ${className}`}>{COPYRIGHT}</footer>;
}

export default Footer;
