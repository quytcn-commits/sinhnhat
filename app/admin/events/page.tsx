"use client";

import { useCallback, useEffect, useState } from "react";

type EventRec = {
  t: string;
  cccd: string;
  name: string;
  khoi: "bo" | "kd" | "";
  action: "created" | "download" | "share";
  outcome: string;
  os: string;
  browser: string;
  device: "mobile" | "tablet" | "desktop";
  inApp: string;
};
type Summary = {
  uniqueParticipants: number;
  byAction: { created: number; download: number; share: number };
  byDevice: Record<string, number>;
};
type Resp = { total: number; page: number; size: number; items: EventRec[]; summary: Summary };

const PW_KEY = "newway_admin_pw";
const SIZE = 30;

const ACTION_LABEL: Record<string, string> = {
  created: "Tạo poster",
  download: "Tải xuống",
  share: "Chia sẻ",
};
const OUTCOME_LABEL: Record<string, string> = {
  lookup: "—",
  click: "đã bấm",
  shared: "đã chia sẻ",
  cancelled: "huỷ",
  downloaded: "đã tải",
  shown: "mở ảnh để lưu",
  error: "lỗi",
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false });
  } catch {
    return iso;
  }
}

export default function EventsAdmin() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(PW_KEY);
    if (saved) {
      setPw(saved);
      setAuthed(true);
    }
  }, []);

  const params = useCallback(
    (p: number) => {
      const u = new URLSearchParams();
      if (q) u.set("q", q);
      if (action) u.set("action", action);
      if (from) u.set("from", from);
      if (to) u.set("to", to);
      u.set("page", String(p));
      u.set("size", String(SIZE));
      return u.toString();
    },
    [q, action, from, to]
  );

  const load = useCallback(
    async (p = page, password = pw) => {
      if (!password) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/events?${params(p)}`, {
          headers: { "x-admin-password": password },
        });
        if (res.status === 401) {
          setAuthed(false);
          sessionStorage.removeItem(PW_KEY);
          setError("Sai mật khẩu");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Lỗi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    },
    [page, pw, params]
  );

  useEffect(() => {
    if (authed) load(page, pw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, page]);

  function doAuth(e: React.FormEvent) {
    e.preventDefault();
    setPw(pwInput);
    sessionStorage.setItem(PW_KEY, pwInput);
    setAuthed(true);
    setPage(1);
    load(1, pwInput);
  }

  function applyFilter(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, pw);
  }

  async function exportCsv() {
    try {
      const res = await fetch(`/api/admin/events?${params(1)}&export=csv`, {
        headers: { "x-admin-password": pw },
      });
      if (!res.ok) {
        alert("Xuất CSV thất bại");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "su-kien-sinh-nhat.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Xuất CSV thất bại");
    }
  }

  if (!authed) {
    return (
      <div className="wrap">
        <div className="brand">
          <h1>QUẢN TRỊ SỰ KIỆN</h1>
        </div>
        <form className="card" onSubmit={doAuth}>
          <label htmlFor="pw">Mật khẩu quản trị</label>
          <input id="pw" type="password" value={pwInput} onChange={(e) => setPwInput(e.target.value)} autoFocus />
          <button className="btn" type="submit">Đăng nhập</button>
          {error && <div className="error">{error}</div>}
        </form>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / SIZE)) : 1;
  const s = data?.summary;

  return (
    <div className="wrap-wide">
      <div className="brand">
        <h1>THEO DÕI SỰ KIỆN</h1>
        <p>Ai đã tạo poster / tải / chia sẻ — thiết bị, thời gian</p>
      </div>
      <div className="admin-nav">
        <a href="/admin">Import Excel</a>
        <a href="/admin/employees">Danh sách</a>
        <a href="/admin/events" className="active">Sự kiện</a>
      </div>

      {s && (
        <div className="ev-cards">
          <div className="ev-card"><b>{s.uniqueParticipants.toLocaleString("vi-VN")}</b><span>Người tham gia</span></div>
          <div className="ev-card"><b>{s.byAction.created.toLocaleString("vi-VN")}</b><span>Tạo poster</span></div>
          <div className="ev-card"><b>{s.byAction.download.toLocaleString("vi-VN")}</b><span>Lượt tải</span></div>
          <div className="ev-card"><b>{s.byAction.share.toLocaleString("vi-VN")}</b><span>Lượt chia sẻ</span></div>
          <div className="ev-card ev-card-dev">
            <span>
              📱 {(s.byDevice.mobile || 0) + (s.byDevice.tablet || 0)} di động · 💻 {s.byDevice.desktop || 0} máy tính
            </span>
          </div>
        </div>
      )}

      <div className="card">
        <form onSubmit={applyFilter} className="ev-filters">
          <input
            type="text"
            placeholder="Tìm tên / CCCD…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Tất cả hành động</option>
            <option value="created">Tạo poster</option>
            <option value="download">Tải xuống</option>
            <option value="share">Chia sẻ</option>
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="Từ ngày" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="Đến ngày" />
          <button className="btn" type="submit" style={{ marginTop: 0, width: "auto", padding: "0 18px" }}>Lọc</button>
          <button type="button" className="btn secondary" style={{ marginTop: 0, width: "auto", padding: "0 16px" }} onClick={exportCsv}>
            ⬇ CSV
          </button>
        </form>

        <div className="info-line" style={{ marginTop: 10 }}>
          {data ? <>Tổng <b>{data.total.toLocaleString("vi-VN")}</b> sự kiện</> : "…"}
          {loading && " · đang tải…"}
        </div>
        {error && <div className="error">{error}</div>}

        <div className="ev-table-wrap">
          <table className="ev-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Họ tên</th>
                <th>CCCD</th>
                <th>Khối</th>
                <th>Hành động</th>
                <th>Kết quả</th>
                <th>Thiết bị</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((e, i) => (
                <tr key={i}>
                  <td className="ev-time">{fmtTime(e.t)}</td>
                  <td>{e.name}</td>
                  <td className="ev-mono">{e.cccd}</td>
                  <td>{e.khoi ? e.khoi.toUpperCase() : "—"}</td>
                  <td>
                    <span className={`ev-tag ev-${e.action}`}>{ACTION_LABEL[e.action] || e.action}</span>
                  </td>
                  <td>{OUTCOME_LABEL[e.outcome] || e.outcome}</td>
                  <td className="ev-dev">
                    {e.device === "desktop" ? "💻" : "📱"} {e.os} · {e.browser}
                    {e.inApp ? ` · ${e.inApp}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.items.length === 0 && <div className="hint" style={{ padding: 14 }}>Chưa có sự kiện nào.</div>}
        </div>

        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
        </div>
      </div>
    </div>
  );
}
