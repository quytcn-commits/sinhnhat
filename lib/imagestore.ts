// Lưu ảnh poster TẠM để tải qua URL server (giúp iOS/Zalo tải thẳng vào máy).
// File tự xoá CUỐN CHIẾU: quá hạn TTL → xoá; vượt cap (dung lượng/số file) →
// xoá file CŨ NHẤT trước (FIFO). Đảm bảo KHÔNG bao giờ đầy đĩa VPS.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const DATA_PATH =
  process.env.DATA_PATH || path.join(process.cwd(), "runtime-data", "employees.json");
const TMP_DIR = process.env.TMP_IMAGE_DIR || path.join(path.dirname(DATA_PATH), "tmp");

// Ngưỡng an toàn (đổi qua env nếu cần):
const TTL_MS = Number(process.env.TMP_TTL_MS) || 15 * 60 * 1000; // sống tối đa 15 phút
const MAX_BYTES = Number(process.env.TMP_MAX_BYTES) || 500 * 1024 * 1024; // tổng ≤ 500 MB
const MAX_FILES = Number(process.env.TMP_MAX_FILES) || 1000;

const SAFE_ID = /^[a-f0-9]{32}$/;

export function saveTempImage(buf: Buffer, ext: "png" | "jpg"): string {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const id = crypto.randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(TMP_DIR, `${id}.${ext}`), buf);
  cleanup();
  return id;
}

export function readTempImage(id: string): { buf: Buffer; ext: "png" | "jpg" } | null {
  if (!SAFE_ID.test(id)) return null; // chặn path traversal / dò id
  for (const ext of ["jpg", "png"] as const) {
    try {
      return { buf: fs.readFileSync(path.join(TMP_DIR, `${id}.${ext}`)), ext };
    } catch {
      /* thử ext khác */
    }
  }
  return null;
}

/** Xoá cuốn chiếu: quá hạn TTL, rồi ép trần dung lượng/số file (xoá cũ nhất trước). */
export function cleanup(): void {
  let entries: { p: string; size: number; mtime: number }[];
  try {
    entries = fs.readdirSync(TMP_DIR).map((f) => {
      const p = path.join(TMP_DIR, f);
      const st = fs.statSync(p);
      return { p, size: st.size, mtime: st.mtimeMs };
    });
  } catch {
    return; // chưa có thư mục
  }

  const now = Date.now();
  const live: typeof entries = [];
  for (const e of entries) {
    if (now - e.mtime > TTL_MS) {
      try {
        fs.unlinkSync(e.p);
      } catch {
        /* ignore */
      }
    } else {
      live.push(e);
    }
  }

  live.sort((a, b) => a.mtime - b.mtime); // cũ -> mới
  let total = live.reduce((s, e) => s + e.size, 0);
  let i = 0;
  while ((total > MAX_BYTES || live.length - i > MAX_FILES) && i < live.length) {
    try {
      fs.unlinkSync(live[i].p);
    } catch {
      /* ignore */
    }
    total -= live[i].size;
    i++;
  }
}

// Quét định kỳ 5 phút (phòng khi hết hoạt động vẫn dọn nốt rác). Chạy 1 lần/tiến trình.
type G = typeof globalThis & { __tmpSweep?: ReturnType<typeof setInterval> };
const g = globalThis as G;
if (!g.__tmpSweep) {
  g.__tmpSweep = setInterval(() => {
    try {
      cleanup();
    } catch {
      /* ignore */
    }
  }, 5 * 60 * 1000);
  g.__tmpSweep.unref?.();
}
