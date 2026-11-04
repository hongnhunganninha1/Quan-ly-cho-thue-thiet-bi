// Thông tin doanh nghiệp và chức danh ký, dùng chung cho bản in (PDF) và file Excel của các báo cáo

export const COMPANY = {
  name: "CÔNG TY CỔ PHẦN COMACPRO",
  address: "Tầng 5 tòa nhà ACCI, số 210 Lê Trọng Tấn, Thanh Xuân, Hà Nội",
  taxCode: "0110449655",
  // Người đại diện ký hợp đồng cho thuê (bản in hợp đồng)
  director: "Đặng Việt Dũng",
  directorPrefix: "Ông",
  directorTitle: "Giám đốc",
};

// Chức danh ký cuối báo cáo: báo cáo tài chính (doanh thu, công nợ) và báo cáo vận hành (thiết bị, hợp đồng)
export const SIGNERS = {
  finance: ["Người lập biểu", "Kế toán trưởng", "Giám đốc"],
  operation: ["Người lập biểu", "Trưởng phòng Kinh doanh - Vận hành", "Giám đốc"],
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

// Số thứ tự: dòng nhóm đánh I, II…; dòng thường đánh 1, 2… (đếm lại trong từng nhóm); dòng tổng để trống
export function rowNumbers(rows) {
  const result = [];
  let group = 0;
  let index = 0;
  for (const r of rows) {
    if (r.kind === "group") {
      result.push(ROMAN[group] || "");
      group += 1;
      index = 0;
    } else if (r.kind === "total") {
      result.push("");
    } else {
      index += 1;
      result.push(index);
    }
  }
  return result;
}
