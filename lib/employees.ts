import type { Employee } from "./types";
import { getEmployees } from "./store";

/** Chuẩn hoá CCCD: bỏ khoảng trắng, gạch ngang */
export function normalizeCccd(raw: string): string {
  return (raw || "").replace(/[\s.-]/g, "").trim();
}

export function findByCccd(cccd: string): Employee | null {
  const key = normalizeCccd(cccd);
  return getEmployees().find((e) => normalizeCccd(e.cccd) === key) ?? null;
}

/**
 * Số ngày đồng hành. Mặc định TỰ TÍNH từ joinDate → hôm nay (không dùng số cứng
 * trong Excel vì sẽ cũ dần). Chỉ khi admin GHI ĐÈ thủ công (emp.days là số) mới
 * dùng giá trị đó. Neo mốc theo giờ VN (UTC+7) để không lệch 1 ngày khi server
 * chạy theo UTC.
 */
export function daysWith(emp: Employee): number {
  if (typeof emp.days === "number") return emp.days;
  if (!emp.joinDate) return 0;
  const join = new Date(emp.joinDate + "T00:00:00+07:00");
  if (Number.isNaN(join.getTime())) return 0;
  const diff = Math.floor((Date.now() - join.getTime()) / 86400000);
  return Math.max(diff, 0);
}

/** Định dạng số kiểu VN: 2286 -> "2.286" */
export function formatVN(n: number): string {
  return n.toLocaleString("vi-VN").replace(/,/g, ".");
}

/** Định dạng ngày: 2022-11-15 -> "15.11.2022" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}
