// Gọi API backend. Mọi màn hình dùng chung các hàm api.get / post / put / patch / del ở đây.
// Token đăng nhập được tự động gắn vào header Authorization.

const TOKEN_KEY = "kltn_token";

// "Ghi nhớ đăng nhập": lưu token ở localStorage (đóng trình duyệt vẫn còn),
// không ghi nhớ thì lưu ở sessionStorage (đóng thẻ là mất).
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token, remember) {
  clearToken();
  try {
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    // trình duyệt chặn lưu trữ: vẫn dùng được đến khi tải lại trang
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // bỏ qua
  }
}

// Hàm App đăng ký để xử lý khi token hết hạn (đưa về màn đăng nhập)
let onUnauthorized = null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

async function request(method, path, body) {
  const token = getToken();
  const isForm = body instanceof FormData; // gửi file thì trình duyệt tự đặt Content-Type
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined && !isForm && { "Content-Type": "application/json" }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined || isForm ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error("Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa.");
  }

  // 502 / 504: Vite không chuyển được yêu cầu sang backend (backend chưa chạy hoặc vừa bị lỗi)
  if (res.status === 502 || res.status === 504) {
    throw new Error("Không kết nối được máy chủ. Kiểm tra cửa sổ Terminal của backend đã chạy (npm run dev) chưa.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Đang đăng nhập mà bị 401 nghĩa là phiên đã hết hạn / tài khoản bị khoá
    if (res.status === 401 && token && onUnauthorized) onUnauthorized(data.message);
    const error = new Error(data.message || `Lỗi ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body = {}) => request("POST", path, body),
  put: (path, body = {}) => request("PUT", path, body),
  patch: (path, body = {}) => request("PATCH", path, body),
  del: (path) => request("DELETE", path),
  upload: (path, formData) => request("POST", path, formData), // gửi form có file
};
