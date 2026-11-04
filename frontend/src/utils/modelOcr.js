// Đọc chữ trên ảnh chụp tem / biển tên máy (nameplate) bằng Tesseract.js (OCR chạy ngay trên trình duyệt)
// để gợi ý Model, Số serial (số khung) và Số máy (số động cơ).
// Hiểu được tem tiếng Anh, Nhật, Trung, Hàn: nhận ra nhãn (VD 型式 / 型号 / 모델 = Model) để biết mã nào là mã nào.
// Kết quả OCR không đúng 100% nên hệ thống chỉ GỢI Ý các mã tìm được, người dùng chọn hoặc sửa lại trước khi lưu.

import workerUrl from "tesseract.js/dist/worker.min.js?url";
import coreUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";

// Từ khoá (nhãn) in trước từng loại mã trên tem máy: tiếng Anh + Việt + Nhật + Trung + Hàn.
// Chữ Latin cần \b (ranh giới từ); chữ Nhật / Trung / Hàn không có khoảng trắng nên so trực tiếp.
// Nhãn tiếng Việt viết không dấu vì dòng chữ đã được bỏ dấu trước khi so (normalizeLine); "S[O0]" vì OCR hay đọc "Số" thành "S0".
const LABELS = {
  model: {
    // Model / Model No. / Model Number / Model Name / Machine Model / Product Model / Type (máy Đức, châu Âu)
    // Ký hiệu / Kiểu dáng / Mã kiểu máy / Kiểu máy (tem tiếng Việt)
    latin: "MODEL\\s*NO|MODEL\\s*NUMBER|MODEL\\s*NAME|MACHINE\\s*MODEL|PRODUCT\\s*MODEL|MODEL|MODELE|MACHINE\\s*TYPE|TYPE\\s*NO|TYPE|KY\\s*HIEU|MA\\s*KIEU\\s*MAY|KIEU\\s*MAY|KIEU\\s*DANG",
    cjk: "型式|形式|型号|型號|規格型号|规格型号|机型|機種|모델|형식",
  },
  serial: {
    // Serial No. / Serial Number / S/N / Ser. No. / Machine Serial Number / Product Identification Number (PIN) / VIN /
    // ("…FICATION NUMBER": OCR hay đọc sai chữ "IDENTIFICATION" thành "LAENTIFICATION", "DONFIFICATION"…)
    // Frame No. (máy Nhật: số khung chính là số serial) / Chassis No. / Số sê-ri / Số seri / Số khung / Số chế tạo
    latin: "MACHINE\\s*SERIAL\\s*(?:NO|NUMBER)|SERIAL\\s*NO|SERIAL\\s*NUMBER|SERIAL|SER\\.?\\s*NO|S\\/N|SN|PRODUCT\\s*ID(?:ENTIFICATION)?\\s*(?:NO|NUMBER)?|[A-Z]*FICATION\\s*(?:NO|NUMBER)|PIN|VIN|FRAME\\s*NO|FRAME\\s*NUMBER|CHASSIS\\s*NO|CHASSIS|MACHINE\\s*NO|S[O0]\\s*SE\\s*-?\\s*RI|S[O0]\\s*KHUNG|S[O0]\\s*CHE\\s*TAO",
    // 製造番号 / 機番 (Nhật), 出厂编号 / 车架号 (Trung), 제조번호 / 차대번호 (Hàn)…; "编号" để bắt cả khi chữ đứng trước bị đọc sai
    cjk: "製造番号|製造番號|製番|機番|机番|号機|號機|出厂编号|出廠編號|出厂号|产品编号|產品編號|整机编号|车架号|車架號|机身号|序列号|编号|編號|제조번호|기번|차대번호|일련번호",
  },
  engine: {
    latin: "ENGINE\\s*SERIAL\\s*NO|ENGINE\\s*NO|ENGINE\\s*NUMBER|ENGINE|ENG\\s*NO|E\\/N|S[O0]\\s*MAY|S[O0]\\s*DONG\\s*CO",
    cjk: "エンジン番号|原動機番号|原动机号|发动机号|發動機號|发动机编号|發動機編號|엔진번호|원동기번호",
  },
};
const labelRegex = ({ latin, cjk }) => new RegExp(`(?:\\b(?:${latin})\\b|${cjk})\\.?\\s*[:.：-]?\\s*`);
const KEYWORDS = Object.fromEntries(Object.entries(LABELS).map(([k, v]) => [k, labelRegex(v)]));
// Dòng chứa các từ khoá này là thông tin khác (năm, trọng lượng, công suất…) nên xếp sau cùng
// (năm, trọng lượng, công suất…) và địa chỉ / tên hãng (VD "BOX 504, SE-371 23 KARLSKRONA SWEDEN" – "SE-371" không phải model)
const OTHER = /\b(YEAR|WEIGHT|MASS|POWER|KW|KG|MADE|DATE|CAPACITY|BOX|ADDRESS|TEL|FAX|WWW|LTD|GMBH|INC|CORP|NAM\s*SX|NAM\s*SAN\s*XUAT|TRONG\s*LUONG|CONG\s*SUAT)\b|製造年|年月|質量|重量|出力|出厂日期|功率|제조년월|중량|출력/;

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
    .replace(/[–—−ー_=]/g, "-")
    .replace(/-{2,}/g, "-") // "DCA--25LSKB" (gạch dài kiểu Nhật đọc thành 2 gạch) → "DCA-25LSKB"
    .replace(/^[^A-Z0-9]+|[^A-Z0-9]+$/g, "");
}

// Chuẩn hoá 1 dòng chữ OCR: viết hoa, bỏ khoảng trắng chen giữa các chữ Nhật / Trung / Hàn ("型 式" → "型式"),
// dấu gạch kiểu Nhật / Trung giữa 2 phần của mã đổi thành "-" ("DCA ニ 25LSKB" → "DCA-25LSKB")
const CJK = "\\u3040-\\u30ff\\u3400-\\u9fff\\uac00-\\ud7af";
// Bỏ dấu tiếng Việt (chỉ với chữ Latin – không đụng tới chữ Nhật / Hàn) để so nhãn "SỐ KHUNG", "KÝ HIỆU"…
const stripAccents = (s) => s.replace(/[\u00C0-\u024F\u1E00-\u1EFF]/g, (ch) => ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "")).replace(/Đ/g, "D");
function normalizeLine(line) {
  return stripAccents(line.toUpperCase())
    .replace(new RegExp(`([${CJK}])\\s+(?=[${CJK}])`, "g"), "$1")
    .replace(/([A-Z0-9])\s*[ニー一—–−=]+\s*([A-Z0-9])/g, "$1-$2")
    .trim();
}

// Số ký tự phải sửa để biến a thành b (khoảng cách Levenshtein) – để nhận ra 2 mã gần giống nhau do OCR đọc lệch
function editDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prev = cur;
  }
  return prev[b.length];
}
const nearSame = (a, b) => a !== b && Math.abs(a.length - b.length) <= 1 && editDistance(a, b) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1);

// Trả về tối đa `limit` mã có thể là `kind` ("model" | "serial" | "engine"),
// ưu tiên mã đứng ngay sau nhãn tương ứng (VD: "MODEL: PC200-8", "型式 DCA-25LSKB", "出厂编号 SY021523K8").
// `text` là chữ gộp từ nhiều lượt đọc; mã xuất hiện ở nhiều lượt được coi là đáng tin hơn.
export function findCandidates(text, kind = "model", limit = 6) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);
  const own = KEYWORDS[kind];
  const others = Object.entries(KEYWORDS).filter(([k]) => k !== kind).map(([, re]) => re);

  // Đếm số lần mỗi mã xuất hiện trong các lượt đọc
  const votes = new Map();
  lines.forEach((l) => l.split(/[\s,;:|()[\]]+/).forEach((tok) => {
    const t = clean(tok);
    if (t) votes.set(t, (votes.get(t) || 0) + 1);
  }));
  // Mã đọc từ dòng có nhãn có thể lệch 1–2 ký tự (VD "DCA-25LSKEB"): thay bằng mã gần giống được đọc ra nhiều hơn
  const snap = (t) => {
    let best = t;
    votes.forEach((n, u) => {
      if (nearSame(t, u) && n > (votes.get(best) || 0)) best = u;
    });
    return best;
  };

  const first = []; // đứng ngay sau đúng nhãn (cùng dòng)
  const below = []; // nằm ở dòng dưới nhãn (tem dạng bảng) – kém chắc chắn hơn vì có thể là ô của cột khác
  const strong = []; // serial: mã dài 10–20 ký tự, nhiều chữ số (dạng PIN / VIN, VD "10000117L0A004817")
  const likely = []; // serial: dãy toàn số 5–12 chữ số (tem không ghi nhãn tiếng Anh)
  const normal = []; // mã khác trong ảnh
  const late = []; // nằm trên dòng của loại mã khác / thông tin khác
  // Thứ tự ưu tiên. Số serial: mã dạng PIN xếp trước mã ở dòng dưới nhãn (dòng dưới hay là ô "TYPE" của bảng)
  const tiers = kind === "serial" ? [first, strong, below, likely, normal, late] : [first, below, strong, likely, normal, late];
  const all = () => tiers.flat();

  // Số PIN / VIN 17 ký tự (chuẩn ISO 3779) không dùng chữ I, O, Q → đó là số 1, 0 bị OCR đọc nhầm
  const fixPin = (t) => (kind === "serial" && /^[A-Z0-9]{17}$/.test(t) && (t.match(/\d/g) || []).length >= 5 ? t.replace(/[OQ]/g, "0").replace(/I/g, "1") : t);
  const push = (list, raw) => {
    const t = fixPin(clean(raw));
    if (!/^[A-Z0-9][A-Z0-9\-/.]*$/.test(t) || !VALID[kind](t)) return;
    const cur = tiers.findIndex((l) => l.includes(t));
    const want = tiers.indexOf(list);
    if (cur !== -1 && cur <= want) return;
    // Lượt đọc sau thấy mã ở vị trí đáng tin hơn (VD ngay sau nhãn) thì chuyển mã lên nhóm đó
    if (cur !== -1) tiers[cur].splice(tiers[cur].indexOf(t), 1);
    list.push(t);
  };

  lines.forEach((line, i) => {
    // "ENGINE SERIAL NO" / "发动机编号" là số động cơ, không phải số khung
    const m = kind === "serial" && KEYWORDS.engine.test(line) ? null : line.match(own);
    if (m) {
      const before = first.length;
      const rest = line.slice(m.index + m[0].length).trim();
      const parts = rest.split(/\s+/);
      // Ghép "PC200 -8" hoặc "ZX 200-5G" thành một mã
      if (parts[1] && /^-?[A-Z0-9-]{1,6}$/.test(parts[1]) && (parts[1].startsWith("-") || /^\D+$/.test(parts[0]))) {
        push(first, snap(clean(parts[0] + parts[1])));
      }
      push(first, snap(clean(parts[0])));
      // Không có mã ngay sau nhãn: tem dạng bảng (hàng tiêu đề "DESIGNATION | TYPE | RATED POWER", giá trị ở hàng dưới
      // "ROLLER | CA362D | 112 KW") hoặc nhãn một dòng, mã dòng dưới. Tìm ở tối đa 3 dòng kế tiếp, ưu tiên ô cùng cột với nhãn.
      if (first.length === before) {
        const col = line.slice(0, m.index).split(/[\s|]+/).filter(Boolean).length;
        for (const next of lines.slice(i + 1, i + 4)) {
          if (Object.values(KEYWORDS).some((re) => re.test(next))) break; // gặp nhãn khác thì dừng
          const cells = next.split(/[\s|]+/).map(clean).filter(Boolean);
          const ok = (t) => t && /^[A-Z0-9][A-Z0-9\-/.]*$/.test(t) && VALID[kind](t);
          const hit = ok(cells[col]) ? cells[col] : cells.find(ok);
          if (hit) {
            push(below, snap(hit));
            break;
          }
        }
      }
    }
    const otherLine = !m && (OTHER.test(line) || others.some((re) => re.test(line)));
    line.split(/[\s,;:|()[\]]+/).forEach((tok) => {
      const t = clean(tok);
      const pinLike = kind === "serial" && /^[A-Z0-9]{10,20}$/.test(t) && /[A-Z]/.test(t) && (t.match(/\d/g) || []).length >= 6;
      const digitsOnly = kind === "serial" && /^\d{5,12}$/.test(t);
      // Model ít chữ số (VD XD103, PC200-8, SK200-10): mã có từ 6 chữ số trở lên thường là serial / PIN nên xếp sau cùng
      const longCode = kind === "model" && (t.match(/\d/g) || []).length >= 6;
      push(pinLike ? strong : digitsOnly && !otherLine ? likely : otherLine || longCode ? late : normal, tok);
    });
  });

  // Trong cùng nhóm, mã được nhiều lượt đọc ra giống nhau đáng tin hơn (mã rác do OCR đọc nhầm thường chỉ xuất hiện 1 lần)
  // Model: cộng thêm 1 điểm cho mã có dạng model quen thuộc (2–4 chữ cái rồi số: XD103, PC200-8, CA362D, DCA-25LSKB)
  const score = (t) => (votes.get(t) || 0) + (kind === "model" && /^[A-Z]{2,4}-?\d{2}/.test(t) ? 1 : 0);
  // Bằng điểm thì ưu tiên mã dài hơn (mã rác thường ngắn: "R80", "T1ES")
  const byScore = (a, b) => score(b) - score(a) || b.length - a.length;
  [below, strong, normal].forEach((l) => l.sort(byScore));

  // Bỏ "mảnh vụn": mã nằm gọn trong một mã dài hơn (VD "25ISKB" là phần của "DCA-25LSKB"),
  // so sánh sau khi gộp các ký tự OCR hay nhầm (I/L/1, O/0, S/5, B/8)
  const key = (t) => t.replace(/[IL]/g, "1").replace(/O/g, "0").replace(/S/g, "5").replace(/B/g, "8").replace(/[-/.]/g, "");
  // (chỉ bỏ khi mã dài hơn được xếp trước – "CA362D" đứng sau nhãn TYPE không bị loại vì mã rác "OLLERMEMCA362D" ở sau)
  const notFragment = (t, i, list) => !list.slice(0, i).some((o) => o.length > t.length && key(o).includes(key(t)));
  // Bỏ bản đọc lệch của một mã đã có ở trước (VD "2926361" khi đã có "3926361")
  const notNearEarlier = (t, i, list) => !list.slice(0, i).some((o) => nearSame(o, t));
  // Số serial: đã có mã sau nhãn, mã dạng PIN hoặc dãy toàn số thì không gợi ý thêm mã chữ lẫn số ngắn (thường là model)
  const pool = kind === "serial" && first.length + strong.length + below.length + likely.length > 0 ? [...first, ...strong, ...below, ...likely] : all();
  return pool.filter(notFragment).filter(notNearEarlier).slice(0, limit);
}

// Bộ nhận dạng chữ để sẵn trong dự án (không tải từ Internet) nên chạy được cả khi không có mạng:
//  - worker và lõi WebAssembly lấy từ thư viện tesseract.js trong node_modules,
//  - dữ liệu tiếng Anh (eng.traineddata.gz) đặt ở frontend/public/tesseract.
const OCR_OPTIONS = {
  workerPath: workerUrl,
  corePath: coreUrl,
  langPath: "/tesseract",
};

// Phóng to ảnh (chữ nhỏ đọc tốt hơn) và chuyển sang ảnh xám
export async function loadGray(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(3, 2400 / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  return { gray, w, h };
}

// Vẽ ảnh đen trắng: isInk(i) = true thì điểm i là nét chữ (tô đen), còn lại là nền trắng
function toCanvas(w, h, isInk) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = isInk(i) ? 0 : 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// Làm rõ chữ TỐI trên nền sáng: "phân ngưỡng cục bộ" (so mỗi điểm với độ sáng trung bình xung quanh nó).
// Giúp đọc được chữ số dập nổi trên tem kim loại, chỗ bị loá sáng.
function darkTextImage({ gray, w, h }) {
  // Bảng cộng dồn (integral image) để tính nhanh độ sáng trung bình của từng ô vuông
  const sum = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let row = 0;
    for (let x = 1; x <= w; x++) {
      row += gray[(y - 1) * w + (x - 1)];
      sum[y * (w + 1) + x] = sum[(y - 1) * (w + 1) + x] + row;
    }
  }
  const r = Math.max(8, Math.round(w / 110)); // bán kính vùng lân cận (chọn qua thử nghiệm với ảnh tem thật)
  return toCanvas(w, h, (i) => {
    const x = i % w, y = (i - x) / w;
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
    const mean = (sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0]) / ((y1 - y0) * (x1 - x0));
    return gray[i] - mean <= -8; // tối hơn xung quanh rõ rệt = nét chữ
  });
}

// Lọc min / max theo một chiều với cửa sổ dài k (thuật toán van Herk – Gil-Werman, mỗi điểm chỉ tốn ~3 phép so sánh)
function slide(src, w, h, k, horizontal, pick) {
  k |= 1; // cửa sổ lẻ để cân 2 bên điểm đang xét (cửa sổ chẵn làm lệch 1 điểm → sót viền ô ở cạnh trên / trái)
  const out = new Float32Array(src.length);
  const n = horizontal ? w : h, lines = horizontal ? h : w;
  const at = (line, j) => (horizontal ? line * w + j : j * w + line);
  const half = k >> 1;
  const g = new Float32Array(n + k), hh = new Float32Array(n + k);
  for (let line = 0; line < lines; line++) {
    // Đệm 2 đầu bằng giá trị ở mép để cửa sổ không bị thiếu
    const v = (j) => src[at(line, Math.min(n - 1, Math.max(0, j - half)))];
    const m = n + k - 1;
    for (let j = 0; j < m; j++) g[j] = j % k === 0 ? v(j) : pick(g[j - 1], v(j));
    for (let j = m - 1; j >= 0; j--) hh[j] = j % k === k - 1 || j === m - 1 ? v(j) : pick(hh[j + 1], v(j));
    for (let j = 0; j < n; j++) out[at(line, j)] = pick(hh[j], g[j + k - 1]);
  }
  return out;
}

// Làm nổi bật chữ SÁNG trên nền tối hoặc nền xám (VD tem XCMG: chữ trắng trên nền đen, số trắng trong ô xám nhạt).
// Phép "top-hat": lấy ảnh trừ đi ảnh đã xoá hết các nét mảnh hơn k điểm ảnh (mở hình thái học = lọc min rồi lọc max).
// Phần còn lại chỉ là nét chữ sáng; ô xám, nền đen, viền tem đều to hơn k nên bị loại → in thành chữ đen trên nền trắng.
export function brightTextImage({ gray, w, h }, k) {
  const min = (a, b) => (a < b ? a : b), max = (a, b) => (a > b ? a : b);
  let o = slide(gray, w, h, k, true, min);
  o = slide(o, w, h, k, false, min);
  o = slide(o, w, h, k, true, max);
  o = slide(o, w, h, k, false, max);
  return toCanvas(w, h, (i) => gray[i] - o[i] > 25);
}

// Nhận dạng chữ trong ảnh. Chạy song song nhiều lượt rồi gộp chữ lại:
//  - tiếng Anh: ảnh gốc + ảnh làm rõ chữ tối (tìm chữ rời rạc khắp ảnh, đọc được số dập nổi),
//  - tiếng Anh: 2 ảnh làm nổi bật chữ sáng (tem chữ trắng trên nền đen / ô xám),
//  - Nhật + Anh, Trung + Anh, Hàn + Anh: mỗi ngôn ngữ một lượt riêng (gộp chung một lượt thì chữ Hán bị đọc lẫn lộn),
//    để nhận ra nhãn 型式 / 型号 / 모델…; mã máy vẫn là chữ Latin nên luôn ghép kèm tiếng Anh.
// onProgress(0..100) để hiện tiến trình. Thư viện và dữ liệu ngôn ngữ chỉ được nạp khi bấm "Đọc từ ảnh" lần đầu.
const LANG_PASSES = ["jpn+eng", "chi_sim+eng", "kor+eng"];

export async function readTextFromImage(file, onProgress) {
  const { createWorker } = await import("tesseract.js");
  const progress = [0, 0, 0, 0, 0, 0, 0]; // tiến độ từng lượt (0..1)
  const report = (i) => (m) => {
    if (m.status === "recognizing text") {
      progress[i] = m.progress;
      onProgress?.(Math.round((progress.reduce((a, b) => a + b, 0) / progress.length) * 100));
    }
  };
  const run = async (langs, jobs) => {
    let current = jobs[0].index; // lượt đang chạy trên worker này (để báo tiến độ đúng chỗ)
    const worker = await createWorker(langs, 1, { ...OCR_OPTIONS, logger: (m) => report(current)(m) });
    try {
      const texts = [];
      for (const job of jobs) {
        current = job.index;
        if (job.sparse) await worker.setParameters({ tessedit_pageseg_mode: "11" }); // 11 = chữ rời rạc
        texts.push((await worker.recognize(job.image)).data.text);
        progress[job.index] = 1;
      }
      return texts.join("\n");
    } finally {
      await worker.terminate();
    }
  };
  const base = await loadGray(file);
  // Nét chữ sáng dày khoảng w/120 – w/80 điểm ảnh: dùng 2 cỡ cửa sổ để bắt cả chữ nhỏ (số trong ô) và chữ to (ô model)
  const bright = [Math.round(base.w / 110), Math.round(base.w / 70)].map((k) => brightTextImage(base, k));
  const texts = await Promise.all([
    run("eng", [{ index: 0, image: file }, { index: 1, image: darkTextImage(base), sparse: true }]),
    run("eng", bright.map((image, i) => ({ index: 5 + i, image, sparse: true }))),
    ...LANG_PASSES.map((langs, i) => run(langs, [{ index: i + 2, image: file }])),
  ]);
  return texts.join("\n");
}
