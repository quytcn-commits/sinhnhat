"use client";

import { useEffect, useRef, useState } from "react";

type Status = { count: number; source: "uploaded" | "bundled"; updatedAt: string | null };
type Result = { ok: true; count: number; sheet: string; sheets: string[]; skippedInactive: number };

export default function Admin() {
  const [password, setPassword] = useState("");
  const [sheet, setSheet] = useState("Chốt");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadStatus() {
    try {
      setStatus(await fetch("/api/admin/status").then((r) => r.json()));
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    loadStatus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!file) {
      setError("Vui lòng chọn file Excel (.xlsx)");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("password", password);
      fd.append("sheet", sheet);
      fd.append("file", file);
      const res = await fetch("/api/admin/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");
      setResult(data);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <div className="brand">
        <h1>QUẢN TRỊ — IMPORT NHÂN SỰ</h1>
        <p>NewWay Realty · cập nhật danh sách từ file Excel</p>
      </div>

      <div className="admin-nav">
        <a href="/admin" className="active">Import Excel</a>
        <a href="/admin/employees">Danh sách</a>
        <a href="/admin/events">Sự kiện</a>
      </div>

      <div className="card">
        <div className="info-line">
          Đang dùng:{" "}
          <b>{status ? `${status.count.toLocaleString("vi-VN")} nhân sự` : "…"}</b>{" "}
          {status && (
            <span className="hint" style={{ display: "inline" }}>
              ({status.source === "uploaded" ? "đã upload" : "data mặc định"}
              {status.updatedAt
                ? ` · ${new Date(status.updatedAt).toLocaleString("vi-VN")}`
                : ""}
              )
            </span>
          )}
        </div>

        <form onSubmit={submit} style={{ marginTop: 14 }}>
          <label htmlFor="pw">Mật khẩu quản trị</label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="off"
          />

          <label htmlFor="sheet" style={{ marginTop: 12 }}>
            Tên sheet
          </label>
          <input id="sheet" type="text" value={sheet} onChange={(e) => setSheet(e.target.value)} />

          <label style={{ marginTop: 12 }}>File Excel (.xlsx)</label>
          <div
            className={`uploadbox ${file ? "has" : ""}`}
            onClick={() => fileRef.current?.click()}
          >
            {file ? `✓ ${file.name}` : "📄 Bấm để chọn file .xlsx"}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: "none" }}
          />

          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Đang import…" : "Import & cập nhật"}
          </button>
          {error && <div className="error">{error}</div>}
          {result && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "#eaf7ee",
                color: "#0c5a2e",
                fontSize: 14,
              }}
            >
              ✓ Đã cập nhật <b>{result.count.toLocaleString("vi-VN")}</b> nhân sự (sheet{" "}
              <b>{result.sheet}</b>
              {result.skippedInactive ? `, bỏ qua ${result.skippedInactive} người không Active` : ""}
              ). Trang tra cứu đã dùng dữ liệu mới.
            </div>
          )}
          <div className="hint">
            Cột cần có: Số CMND/CCCD, Họ và tên, Chức vụ, Ngày vào làm, Cấp bậc, Số ngày làm việc, Số
            giờ làm việc.
          </div>
        </form>
      </div>
    </div>
  );
}
