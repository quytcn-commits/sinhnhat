// Log sự kiện tham gia tạo poster (created / download / share) -> file JSONL
// trong cùng thư mục volume với employees.json (bền qua restart/rebuild Docker).
import fs from "node:fs";
import path from "node:path";

const DATA_PATH =
  process.env.DATA_PATH || path.join(process.cwd(), "runtime-data", "employees.json");
const EVENTS_PATH =
  process.env.EVENTS_PATH || path.join(path.dirname(DATA_PATH), "events.jsonl");

export type EventAction = "created" | "download" | "share";

export type EventRec = {
  t: string; // ISO time (UTC)
  cccd: string;
  name: string;
  khoi: "bld" | "bo" | "kd" | "";
  action: EventAction;
  outcome: string; // click | shared | cancelled | downloaded | shown | error
  os: string;
  browser: string;
  device: "mobile" | "tablet" | "desktop";
  inApp: string;
};

export function logEvent(rec: EventRec): void {
  try {
    fs.mkdirSync(path.dirname(EVENTS_PATH), { recursive: true });
    fs.appendFileSync(EVENTS_PATH, JSON.stringify(rec) + "\n", "utf8");
  } catch {
    // không chặn luồng người dùng nếu ghi log lỗi
  }
}

function getAll(): EventRec[] {
  try {
    return fs
      .readFileSync(EVENTS_PATH, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l) as EventRec;
        } catch {
          return null;
        }
      })
      .filter((x): x is EventRec => x != null);
  } catch {
    return [];
  }
}

export type QueryOpts = {
  q?: string;
  action?: string;
  from?: string; // yyyy-mm-dd (giờ VN)
  to?: string;
  page?: number;
  size?: number;
};

function filterEvents(o: QueryOpts): EventRec[] {
  const all = getAll();
  const q = (o.q || "").trim().toLowerCase();
  const action = o.action || "";
  const from = o.from ? new Date(o.from + "T00:00:00+07:00").getTime() : null;
  const to = o.to ? new Date(o.to + "T23:59:59.999+07:00").getTime() : null;
  return all.filter((e) => {
    if (action && e.action !== action) return false;
    if (q && !(e.name.toLowerCase().includes(q) || e.cccd.includes(q))) return false;
    if (from != null || to != null) {
      const tm = new Date(e.t).getTime();
      if (from != null && tm < from) return false;
      if (to != null && tm > to) return false;
    }
    return true;
  });
}

export function queryEvents(o: QueryOpts) {
  const filtered = filterEvents(o).sort((a, b) => b.t.localeCompare(a.t)); // mới nhất trước
  const total = filtered.length;
  const page = Math.max(1, o.page || 1);
  const size = o.size || 30;
  const items = filtered.slice((page - 1) * size, page * size);

  const uniq = new Set<string>();
  const byAction: Record<EventAction, number> = { created: 0, download: 0, share: 0 };
  const byDevice: Record<string, number> = { mobile: 0, tablet: 0, desktop: 0 };
  for (const e of filtered) {
    uniq.add(e.cccd);
    if (e.action in byAction) byAction[e.action]++;
    if (e.device in byDevice) byDevice[e.device]++;
  }
  return {
    total,
    page,
    size,
    items,
    summary: { uniqueParticipants: uniq.size, byAction, byDevice },
  };
}

const ACTION_LABEL: Record<EventAction, string> = {
  created: "Tạo poster",
  download: "Tải xuống",
  share: "Chia sẻ",
};
export function actionLabel(a: string): string {
  return ACTION_LABEL[a as EventAction] || a;
}

export function fmtVNTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
  } catch {
    return iso;
  }
}

export function eventsToCsv(o: QueryOpts): string {
  const rows = filterEvents(o).sort((a, b) => a.t.localeCompare(b.t)); // cũ -> mới
  const head = [
    "Thời gian", "Họ tên", "CCCD", "Khối", "Hành động", "Kết quả",
    "Thiết bị", "Hệ điều hành", "Trình duyệt", "Trong app",
  ];
  const esc = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(",")];
  for (const e of rows) {
    lines.push(
      [
        fmtVNTime(e.t), e.name, e.cccd, e.khoi ? e.khoi.toUpperCase() : "",
        actionLabel(e.action), e.outcome, e.device, e.os, e.browser, e.inApp,
      ]
        .map(esc)
        .join(",")
    );
  }
  return "﻿" + lines.join("\r\n"); // BOM để Excel mở UTF-8 đúng
}
