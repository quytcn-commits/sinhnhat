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

/** Số ngày đồng hành: ưu tiên days được set sẵn, nếu không tính từ joinDate → hôm nay */
export function daysWith(emp: Employee): number {
  if (typeof emp.days === "number") return emp.days;
  const join = new Date(emp.joinDate + "T00:00:00");
  const now = new Date();
  const diff = Math.floor((now.getTime() - join.getTime()) / 86400000);
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
