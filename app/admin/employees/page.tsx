"use client";

import { useCallback, useEffect, useState } from "react";

type Stats = { calls: string; meetings: string; deals: string; hours: string };
type Employee = {
  cccd: string;
  fullName: string;
  title: string;
  joinDate: string;
  rank: string;
  days?: number;
  stats: Stats;
};
type ListResp = { total: number; page: number; size: number; items: Employee[] };

const PW_KEY = "newway_admin_pw";
const SIZE = 20;

export default function EmployeesAdmin() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pwInput, setPwInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Employee | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(PW_KEY);
    if (saved) {
      setPw(saved);
      setAuthed(true);
    }
  }, []);

  const load = useCallback(
    async (p = page, query = q, password = pw) => {
      if (!password) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/employees?q=${encodeURIComponent(query)}&page=${p}&size=${SIZE}`,
          { headers: { "x-admin-password": password } }
        );
        if (res.status === 401) {
          setAuthed(false);
          sessionStorage.removeItem(PW_KEY);
          setError("Sai mật khẩu");
          return;
        }
        setData(await res.json());
      } catch {
        setError("Lỗi tải danh sách");
      } finally {
        setLoading(false);
      }
    },
    [page, q, pw]
  );

  useEffect(() => {
    if (authed) load(page, q, pw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, page]);

  function doAuth(e: React.FormEvent) {
    e.preventDefault();
    setPw(pwInput);
    sessionStorage.setItem(PW_KEY, pwInput);
    setAuthed(true);
    setPage(1);
    load(1, q, pwInput);
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(1, q, pw);
  }

  async function save(emp: Employee) {
    const res = await fetch("/api/admin/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-password": pw },
      body: JSON.stringify({ cccd: emp.cccd, patch: emp }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Lưu thất bại");
      return;
    }
    setEditing(null);
    load(page, q, pw);
  }

  async function remove(cccd: string, name: string) {
    if (!confirm(`Xoá nhân viên "${name}"?`)) return;
    const res = await fetch(`/api/admin/employees?cccd=${encodeURIComponent(cccd)}`, {
      method: "DELETE",
      headers: { "x-admin-password": pw },
    });
    if (res.ok) load(page, q, pw);
    else alert("Xoá thất bại");
  }

  if (!authed) {
    return (
      <div className="wrap">
        <div className="brand">
          <h1>QUẢN TRỊ NHÂN SỰ</h1>
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

  return (
    <div className="wrap-wide">
      <div className="brand">
        <h1>DANH SÁCH NHÂN VIÊN</h1>
        <p>Sửa/xoá thông tin khi bị sai</p>
      </div>
      <div className="admin-nav">
        <a href="/admin">Import Excel</a>
        <a href="/admin/employees" className="active">Danh sách</a>
        <a href="/admin/events">Sự kiện</a>
      </div>

      <div className="card">
        <form onSubmit={search} className="row" style={{ gap: 8 }}>
          <input
            type="text"
            placeholder="Tìm theo tên / CCCD / chức danh / cấp bậc…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="btn" type="submit" style={{ marginTop: 0, width: "auto", padding: "0 18px" }}>
            Tìm
          </button>
        </form>

        <div className="info-line" style={{ marginTop: 10 }}>
          {data ? <>Tổng <b>{data.total.toLocaleString("vi-VN")}</b> nhân viên</> : "…"}
          {loading && " · đang tải…"}
        </div>
        {error && <div className="error">{error}</div>}

        <div style={{ marginTop: 10 }}>
          {data?.items.map((e) => (
            <div className="emp" key={e.cccd}>
              <div className="top">
                <span className="name">{e.fullName}</span>
                <span className="cccd">{e.cccd}</span>
              </div>
              <div className="meta">
                {e.title} · cấp bậc <b>{e.rank}</b>
              </div>
              <div className="meta">
                Vào làm {fmtDate(e.joinDate)} · <b>{e.days ?? "—"}</b> ngày · {e.stats.hours} giờ
              </div>
              <div className="acts">
                <button className="btn-sm btn-edit" onClick={() => setEditing({ ...e, stats: { ...e.stats } })}>
                  ✏️ Sửa
                </button>
                <button className="btn-sm btn-del" onClick={() => remove(e.cccd, e.fullName)}>
                  Xoá
                </button>
              </div>
            </div>
          ))}
          {data && data.items.length === 0 && <div className="hint">Không có kết quả.</div>}
        </div>

        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Trước</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
        </div>
      </div>

      {editing && (
        <EditModal emp={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function EditModal({
  emp,
  onClose,
  onSave,
}: {
  emp: Employee;
  onClose: () => void;
  onSave: (e: Employee) => void;
}) {
  const [f, setF] = useState<Employee>(emp);
  const set = (k: keyof Employee, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const setStat = (k: keyof Stats, v: string) => setF((s) => ({ ...s, stats: { ...s.stats, [k]: v } }));

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Sửa thông tin</h3>
        <div className="hint">CCCD: {f.cccd} (không sửa)</div>

        <label>Họ tên</label>
        <input type="text" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} />

        <label>Chức danh</label>
        <input type="text" value={f.title} onChange={(e) => set("title", e.target.value)} />

        <div className="row2">
          <div>
            <label>Ngày vào làm</label>
            <input type="date" value={f.joinDate} onChange={(e) => set("joinDate", e.target.value)} />
          </div>
          <div>
            <label>Số ngày (số lớn)</label>
            <input
              type="number"
              value={f.days ?? ""}
              onChange={(e) => set("days", e.target.value === "" ? undefined : Number(e.target.value))}
            />
          </div>
        </div>

        <label>Cấp bậc</label>
        <input type="text" value={f.rank} onChange={(e) => set("rank", e.target.value)} />

        <div className="row2">
          <div>
            <label>Cuộc gọi</label>
            <input type="text" value={f.stats.calls} onChange={(e) => setStat("calls", e.target.value)} />
          </div>
          <div>
            <label>Cuộc gặp</label>
            <input type="text" value={f.stats.meetings} onChange={(e) => setStat("meetings", e.target.value)} />
          </div>
        </div>
        <div className="row2">
          <div>
            <label>Cơ hội</label>
            <input type="text" value={f.stats.deals} onChange={(e) => setStat("deals", e.target.value)} />
          </div>
          <div>
            <label>Giờ học hỏi</label>
            <input type="text" value={f.stats.hours} onChange={(e) => setStat("hours", e.target.value)} />
          </div>
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          <button className="btn" onClick={() => onSave(f)}>Lưu</button>
          <button className="btn secondary" onClick={onClose}>Huỷ</button>
        </div>
      </div>
    </div>
  );
}
