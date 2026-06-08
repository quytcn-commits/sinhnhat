import fs from "node:fs";
import path from "node:path";
import bundled from "@/data/employees.json";
import type { Employee } from "./types";

// File data runtime (admin upload ghi vào đây). Mặc định ./runtime-data/employees.json
// — trong Docker nên mount volume vào thư mục này để giữ data qua các lần restart.
const DATA_PATH =
  process.env.DATA_PATH || path.join(process.cwd(), "runtime-data", "employees.json");

let cache: { mtime: number; list: Employee[] } | null = null;

/** Danh sách nhân sự hiện hành: ưu tiên file runtime (đã upload), nếu chưa có thì dùng data bundle trong image. */
export function getEmployees(): Employee[] {
  try {
    const m = fs.statSync(DATA_PATH).mtimeMs;
    if (!cache || cache.mtime !== m) {
      cache = { mtime: m, list: JSON.parse(fs.readFileSync(DATA_PATH, "utf8")) };
    }
    return cache.list;
  } catch {
    return bundled as Employee[];
  }
}

/** Ghi danh sách mới (từ admin upload) + xoá cache. */
export function saveEmployees(list: Employee[]): void {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(list, null, 1), "utf8");
  cache = null;
}

const norm = (s: string) => (s || "").replace(/[\s.-]/g, "").trim();

/** Tìm 1 nhân sự theo CCCD. */
export function findEmployee(cccd: string): Employee | null {
  return getEmployees().find((e) => norm(e.cccd) === norm(cccd)) ?? null;
}

/** Cập nhật 1 nhân sự (sửa thông tin sai). Tạo bản runtime nếu trước đó dùng data bundle. */
export function updateEmployee(cccd: string, patch: Partial<Employee>): Employee | null {
  const list = getEmployees().map((e) => ({ ...e, stats: { ...e.stats } }));
  const i = list.findIndex((e) => norm(e.cccd) === norm(cccd));
  if (i < 0) return null;
  const cur = list[i];
  const next: Employee = {
    ...cur,
    ...patch,
    cccd: cur.cccd, // không cho đổi CCCD (khoá tra cứu)
    stats: { ...cur.stats, ...(patch.stats ?? {}) },
  };
  if (patch.days === undefined || patch.days === null || (patch.days as unknown) === "") {
    delete next.days;
  }
  list[i] = next;
  saveEmployees(list);
  return next;
}

/** Xoá 1 nhân sự. */
export function deleteEmployee(cccd: string): boolean {
  const list = getEmployees();
  const next = list.filter((e) => norm(e.cccd) !== norm(cccd));
  if (next.length === list.length) return false;
  saveEmployees(next);
  return true;
}

/** Danh sách có tìm kiếm + phân trang (cho trang admin). */
export function listEmployees(q: string, page: number, size: number) {
  const all = getEmployees();
  const key = (q || "").trim().toLowerCase();
  const filtered = key
    ? all.filter(
        (e) =>
          e.fullName.toLowerCase().includes(key) ||
          norm(e.cccd).includes(norm(key)) ||
          e.title.toLowerCase().includes(key) ||
          e.rank.toLowerCase().includes(key)
      )
    : all;
  const total = filtered.length;
  const p = Math.max(1, page);
  const items = filtered.slice((p - 1) * size, p * size);
  return { total, page: p, size, items };
}

/** Thông tin nguồn data hiện tại (cho trang admin). */
export function dataStatus(): { count: number; source: "uploaded" | "bundled"; updatedAt: string | null } {
  try {
    const st = fs.statSync(DATA_PATH);
    return {
      count: getEmployees().length,
      source: "uploaded",
      updatedAt: new Date(st.mtimeMs).toISOString(),
    };
  } catch {
    return { count: (bundled as Employee[]).length, source: "bundled", updatedAt: null };
  }
}
