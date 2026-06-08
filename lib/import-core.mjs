// Logic map cột Excel -> danh sách nhân viên. Dùng CHUNG cho:
//  - CLI: scripts/import-excel.mjs
//  - Web admin: app/api/admin/import/route.ts
// XLSX (SheetJS) được truyền vào để module không phụ thuộc cứng cách nạp thư viện.

export const FIXED_STATS = { calls: "5.000+", meetings: "500+", deals: "50+" };
export const DEFAULT_SHEET = "Chốt";

const strip = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const FIELD = {
  cccd: ["socmndcccd", "cccd", "cmnd", "socccd", "socanccuoc"],
  fullName: ["hovaten", "hoten", "tennhanvien", "ten"],
  title: ["chucvu", "chucdanh", "vitri"],
  joinDate: ["ngayvaolam", "ngaygianhap", "ngaybatdau"],
  status: ["tinhtrangcongtac", "trangthai"],
  rank: ["capbac", "danhhieu"],
  days: ["songaylamviec", "songay", "ngaydonghanh"],
  hours: ["sogiolamviec", "sogio", "giohoc"],
};

const up = (s) => String(s ?? "").trim().toUpperCase();
const formatVN = (n) => (n == null ? "" : Math.round(n).toLocaleString("vi-VN").replace(/,/g, "."));
const numClean = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[.,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

function toIso(XLSX, v) {
  if (v == null || v === "") return "";
  if (v instanceof Date) {
    return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

// wb: SheetJS workbook (đọc KHÔNG cellDates để ngày là serial -> không lệch timezone)
export function parseEmployees(XLSX, wb, { sheet = DEFAULT_SHEET, onlyActive = true } = {}) {
  const sheetName =
    wb.SheetNames.find((s) => s === sheet) ||
    wb.SheetNames.find((s) => strip(s) === strip(sheet)) ||
    wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Không tìm thấy sheet "${sheet}". Có: ${wb.SheetNames.join(", ")}`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  if (!rows.length) throw new Error("Sheet rỗng");

  const header = rows[0].map((h) => strip(h));
  const colIndex = (keys) => {
    for (const k of keys) {
      const i = header.indexOf(k);
      if (i >= 0) return i;
    }
    for (const k of keys) {
      const i = header.findIndex((h) => h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = Object.fromEntries(Object.entries(FIELD).map(([k, v]) => [k, colIndex(v)]));
  if (idx.cccd < 0 || idx.fullName < 0) {
    throw new Error("File thiếu cột CCCD hoặc Họ tên (kiểm tra dòng tiêu đề).");
  }

  const seen = new Set();
  const employees = [];
  let skippedInactive = 0;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const cccd = String(row[idx.cccd] ?? "").replace(/[\s.'-]/g, "").trim();
    const name = String(row[idx.fullName] ?? "").trim();
    if (!cccd || !name) continue;
    if (onlyActive && idx.status >= 0) {
      const st = strip(row[idx.status]);
      if (st && st !== "active") {
        skippedInactive++;
        continue;
      }
    }
    if (seen.has(cccd)) continue;
    seen.add(cccd);

    const days = idx.days >= 0 ? numClean(row[idx.days]) : null;
    const hours = idx.hours >= 0 ? numClean(row[idx.hours]) : null;
    const emp = {
      cccd,
      fullName: up(name),
      title: up(row[idx.title]) || "NHÂN VIÊN",
      joinDate: idx.joinDate >= 0 ? toIso(XLSX, row[idx.joinDate]) : "",
      rank: up(row[idx.rank]) || "TÂN BINH",
      stats: { ...FIXED_STATS, hours: hours != null ? formatVN(hours) : "" },
    };
    if (days != null) emp.days = days;
    employees.push(emp);
  }
  return { employees, sheet: sheetName, skippedInactive };
}
