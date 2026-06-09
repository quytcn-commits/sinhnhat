"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import Poster, { type PosterData } from "@/components/Poster";

type LookupResult = Omit<PosterData, "photoUrl">;

export default function Home() {
  const [cccd, setCccd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<LookupResult | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Số lớn (BigNumber) vẽ bằng canvas ASYNC — chỉ cho Tải/Chia sẻ khi đã vẽ xong
  // để không chụp phải canvas trống.
  const [posterReady, setPosterReady] = useState(false);

  // Reset cờ ready mỗi khi đổi người tra cứu (đổi số ngày) → chờ vẽ lại
  useEffect(() => {
    setPosterReady(false);
  }, [info?.daysText]);

  // callback ổn định để không khiến BigNumber vẽ lại mỗi lần parent render
  const handleNumberReady = useCallback(() => setPosterReady(true), []);

  const posterRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cccd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Có lỗi xảy ra");
      setInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function renderBlob(): Promise<Blob> {
    const node = posterRef.current!;
    const dataUrl = await toPng(node, {
      width: 1449,
      height: 2048,
      pixelRatio: 1,
      // KHÔNG cacheBust: nó thêm query string khiến ảnh glyph/canvas tải lại
      // (canvas đã vẽ sẵn, không cần) và có thể chụp phải khung chưa kịp vẽ.
      style: { transform: "scale(1)", transformOrigin: "top left" },
    });
    const r = await fetch(dataUrl);
    return r.blob();
  }

  async function download() {
    if (!posterRef.current) return;
    setBusy(true);
    try {
      const blob = await renderBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poster-${(info?.fullName || "newway").replace(/\s+/g, "-").toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Không tạo được ảnh, thử lại nhé");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!posterRef.current) return;
    setBusy(true);
    try {
      const blob = await renderBlob();
      const file = new File([blob], "poster-newway.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "NewWay Realty",
          text: "Cảm ơn đã đồng hành cùng NewWay Realty 💚",
        });
      } else {
        await download();
      }
    } catch {
      /* người dùng hủy share — bỏ qua */
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setInfo(null);
    setPhotoUrl(null);
    setCccd("");
    setError(null);
  }

  if (!info) {
    return (
      <div className="login">
        <div className="login-bg">
          <img src="/login/bg.png" alt="" />
        </div>
        {/* Cụm đáy riêng cho mobile (rays + skyline + 2 cube) — trích từ design */}
        <img className="login-bgm" src="/login/bg-mobile.png" alt="" />
        <img className="login-cube" src="/login/cube.png" alt="" />

        <div className="login-content">
          <div className="login-logo">
            <img className="mark" src="/login/logo-mark.png" alt="" />
            <img className="txt" src="/login/logo-text.png" alt="NewWay Realty" />
          </div>

          <img className="login-fight" src="/login/fight.png" alt="Fight For Five" />

          <div className="login-sub">
            <img className="login-badge" src="/login/badge.png" alt="5 Năm Khát Vọng" />
            <div className="login-tagline">
              VỮNG VÀNG
              <br />
              VỊ THẾ DẪN ĐẦU
            </div>
          </div>

          <form className="login-card" onSubmit={lookup}>
            <div className="login-cardlabel">
              <b>*</b>Nhập đúng số CCCD đã đăng ký với công ty
            </div>
            <div className="login-field">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4.2a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2zm0 13.4a7.4 7.4 0 0 1-5.66-2.62c.05-1.92 3.78-2.98 5.66-2.98 1.87 0 5.6 1.06 5.66 2.98A7.4 7.4 0 0 1 12 19.6z" />
              </svg>
              <input
                id="cccd"
                type="text"
                inputMode="numeric"
                placeholder="Nhập số CCCD của bạn"
                value={cccd}
                onChange={(e) => setCccd(e.target.value)}
                autoComplete="off"
              />
            </div>
            <button className="login-btn" type="submit" disabled={loading}>
              {loading ? "ĐANG TRA CỨU…" : "TẠO POSTER"}
            </button>
            {error && <div className="login-error">{error}</div>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="brand">
        <h1>NEWWAY REALTY</h1>
        <p>Tri ân hành trình đồng hành — Fight For Five</p>
      </div>

      {info && (
        <div className="card">
          <div className="info-line">
            Xin chào <b>{info.fullName}</b> — {info.title}
          </div>
          <div className="info-line">
            Đã đồng hành <b>{info.daysText}</b> ngày · Gia nhập {info.joinDateText}
          </div>

          <label style={{ marginTop: 16 }}>Tải ảnh chân dung của bạn</label>
          <div
            className={`uploadbox ${photoUrl ? "has" : ""}`}
            onClick={() => fileRef.current?.click()}
          >
            {photoUrl ? "✓ Đã chọn ảnh — bấm để đổi ảnh khác" : "📷 Bấm để chọn ảnh"}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPhoto}
            style={{ display: "none" }}
          />

          <div style={{ marginTop: 18 }}>
            <Poster
              ref={posterRef}
              data={{ ...info, photoUrl }}
              onNumberReady={handleNumberReady}
            />
          </div>

          <div className="row" style={{ marginTop: 16 }}>
            <button
              className="btn"
              onClick={share}
              disabled={busy || !photoUrl || !posterReady}
            >
              {busy ? "Đang xử lý…" : !posterReady ? "Đang dựng poster…" : "Chia sẻ"}
            </button>
            <button
              className="btn secondary"
              onClick={download}
              disabled={busy || !photoUrl || !posterReady}
            >
              Tải về
            </button>
          </div>
          {!photoUrl && <div className="hint">Hãy tải ảnh chân dung để hoàn tất poster.</div>}
          {error && <div className="error">{error}</div>}

          <button className="btn ghost" style={{ marginTop: 16 }} onClick={reset}>
            ← Tra cứu người khác
          </button>
        </div>
      )}
    </div>
  );
}
