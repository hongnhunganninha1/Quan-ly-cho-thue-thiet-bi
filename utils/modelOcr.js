// Đọc chữ trên ảnh chụp tem / biển tên máy (nameplate) bằng Tesseract.js (OCR chạy ngay trên trình duyệt)
// để gợi ý Model, Số serial (số khung) và Số máy (số động cơ).
// Kết quả OCR không đúng 100% nên hệ thống chỉ GỢI Ý các mã tìm được, người dùng chọn hoặc sửa lại trước khi lưu.

import workerUrl from "tesseract.js/dist/worker.min.js?url";
import coreUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";

// Từ khoá in trước từng loại mã trên tem máy
const KEYWORDS = {
  model: /\b(MODEL\s*NO|MODEL|MODELE|MACHINE\s*TYPE|TYPE\s*NO|TYPE)\b\.?\s*[:.-]?\s*/,
  serial: /\b(SERIAL\s*NO|SERIAL\s*NUMBER|SERIAL|S\/N|SN|PRODUCT\s*ID(ENTIFICATION)?\s*(NO|NUMBER)?|PIN|VIN|FRAME\s*NO|CHASSIS\s*NO|CHASSIS|MACHINE\s*NO)\b\.?\s*[:.-]?\s*/,
  engine: /\b(ENGINE\s*SERIAL\s*NO|ENGINE\s*NO|ENGINE\s*NUMBER|ENGINE|ENG\s*NO|E\/N)\b\.?\s*[:.-]?\s*/,
};
// Dòng chứa các từ khoá này là thông tin khác (năm, trọng lượng…) nên xếp sau cùng
const OTHER = /\b(YEAR|WEIGHT|POWER|KW|KG|MADE|DATE|CAPACITY)\b/;

// Điều kiện của từng loại mã: có cả chữ / số, độ dài hợp lý
const VALID = {
  model: (t) => t.length >= 3 && t.length <= 20 && /[A-Z]/.test(t) && /\d/.test(t),
  serial: (t) => t.length >= 5 && t.length <= 30 && /\d/.test(t),
  engine: (t) => t.length >= 4 && t.length <= 30 && /\d/.test(t),
};

// Làm sạch 1 token: bỏ ký tự thừa ở 2 đầu, thống nhất dấu gạch
function clean(token) {
  return token
    .toUpperCase()
    .replace(/[–—_]/g, "-")
    .replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "");
}

// Trả về tối đa `limit` mã có thể là `kind` ("model" | "serial" | "engine"),
// ưu tiên mã đứng ngay sau từ khoá tương ứng (VD: "MODEL: PC200-8", "SERIAL NO. KMT…").
export function findCandidates(text, kind = "model", limit = 6) {
  const lines = String(text || "")
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const own = KEYWORDS[kind];
  const others = Object.entries(KEYWORDS).filter(([k]) => k !== kind).map(([, re]) => re);
  const first = []; // đứng sau đúng từ khoá
  const normal = []; // mã khác trong ảnh
  const late = []; // nằm trên dòng của loại mã khác
  const all = () => [...first, ...normal, ...late];

  const push = (list, raw) => {
    const t = clean(raw);
    if (/^[A-Z0-9][A-Z0-9\-/.]*$/.test(t) && VALID[kind](t) && !all().includes(t)) list.push(t);
  };

  lines.forEach((line, i) => {
    // "ENGINE SERIAL NO" là số động cơ, không phải số khung
    const m = kind === "serial" && KEYWORDS.engine.test(line) ? null : line.match(own);
    if (m) {
      const rest = line.slice(m.index + m[0].length).trim();
      const parts = (rest || lines[i + 1] || "").split(/\s+/); // mã có thể nằm ở dòng dưới
      // Ghép "PC200 -8" hoặc "ZX 200-5G" thành một mã
      if (parts[1] && /^-?[A-Z0-9-]{1,6}$/.test(parts[1]) && (parts[1].startsWith("-") || /^\D+$/.test(parts[0]))) {
        push(first, parts[0] + parts[1]);
      }
      push(first, parts[0]);
    }
    const otherLine = !m && (OTHER.test(line) || others.some((re) => re.test(line)));
    line.split(/[\s,;:|()[\]]+/).forEach((tok) => push(otherLine ? late : normal, tok));
  });

  return all().slice(0, limit);
}

// Bộ nhận dạng chữ để sẵn trong dự án (không tải từ Internet) nên chạy được cả khi không có mạng:
//  - worker và lõi WebAssembly lấy từ thư viện tesseract.js trong node_modules,
//  - dữ liệu tiếng Anh (eng.traineddata.gz) đặt ở frontend/public/tesseract.
const OCR_OPTIONS = {
  workerPath: workerUrl,
  corePath: coreUrl,
  langPath: "/tesseract",
};

// Nhận dạng chữ trong ảnh. onProgress(0..100) để hiện tiến trình.
// Thư viện chỉ được nạp khi người dùng bấm "Đọc từ ảnh" lần đầu.
export async function readTextFromImage(file, onProgress) {
  const { default: Tesseract } = await import("tesseract.js");
  const { data } = await Tesseract.recognize(file, "eng", {
    ...OCR_OPTIONS,
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100));
    },
  });
  return data.text;
}
