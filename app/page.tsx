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

  return (
    <div className="wrap">
      <div className="brand">
        <h1>NEWWAY REALTY</h1>
        <p>Tri ân hành trình đồng hành — Fight For Five</p>
      </div>

      {!info ? (
        <form className="card" onSubmit={lookup}>
          <label htmlFor="cccd">Nhập số CCCD của bạn</label>
          <input
            id="cccd"
            type="text"
            inputMode="numeric"
            placeholder="VD: 001190012345"
            value={cccd}
            onChange={(e) => setCccd(e.target.value)}
            autoComplete="off"
          />
          <button className="btn" type="submit" disabled={loading || !cccd.trim()}>
            {loading ? "Đang tra cứu…" : "Tạo poster của tôi"}
          </button>
          {error && <div className="error">{error}</div>}
          <div className="hint">Nhập đúng số CCCD đã đăng ký với công ty để lấy thông tin nhân sự.</div>
        </form>
      ) : (
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
