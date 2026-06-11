"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import Poster, { type PosterData } from "@/components/Poster";

// Chạy trước khi browser vẽ trên client (tránh nháy); fallback useEffect khi SSR.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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

  // Scale khung login 1440×800 phủ kín màn (cover) — giữ đúng tỉ lệ design ở
  // mọi độ phân giải (HD/Full HD/2K/4K). Khởi tạo 1 (khớp SSR, không mismatch),
  // set giá trị thật trong layout-effect (trước khi vẽ → không nháy, không kẹt).
  const [loginScale, setLoginScale] = useState(1);
  // Màn kết quả có poster cao → dùng CONTAIN (vừa khít khung, không cắt poster);
  // login dùng COVER (phủ kín). Tách 2 scale.
  const [upScale, setUpScale] = useState(1);
  useIsoLayoutEffect(() => {
    const fit = () => {
      const w = window.innerWidth / 1440;
      const h = window.innerHeight / 800;
      setLoginScale(Math.max(w, h));
      setUpScale(Math.min(w, h));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

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
        {/* Khung 1440×800 cố định — scale đồng đều (cover) để LUÔN giống design
            ở mọi tỉ lệ màn. Nền + chữ + card + cube nằm chung, không lệch nhau. */}
        <div
          className="login-stage"
          style={{ transform: `translate(-50%, -50%) scale(${loginScale})` }}
        >
          <div className="login-bg">
            <img src="/login/bg.png" alt="" />
          </div>
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
        {/* Cụm đáy riêng cho mobile (rays + skyline + 2 cube) — ngoài stage */}
        <img className="login-bgm" src="/login/bg-mobile.png" alt="" />
      </div>
    );
  }

  return (
    <div className="up">
      <div
        className="up-stage"
        style={{ transform: `translate(-50%, -50%) scale(${upScale})` }}
      >
        {/* Nền rộng NẰM TRONG khung (cùng scale) → chân poster + cube khớp đường rays;
            rộng 2304 để phủ kín màn rộng khi contain */}
        <img className="up-bg" src="/login/up-bg-wide.png" alt="" />

        {/* Cột trái: branding + card thông tin */}
        <div className="up-left">
          <div className="login-logo">
            <img className="mark" src="/login/logo-mark.png" alt="" />
            <img className="txt" src="/login/logo-text.png" alt="NewWay Realty" />
          </div>
          <img className="login-fight up-fight" src="/login/fight.png" alt="Fight For Five" />
          <div className="login-sub up-sub">
            <img className="login-badge" src="/login/badge.png" alt="5 Năm Khát Vọng" />
            <div className="login-tagline">
              VỮNG VÀNG
              <br />
              VỊ THẾ DẪN ĐẦU
            </div>
          </div>

          <div className="up-card">
            <div className="up-name">{info.fullName}</div>
            <div className="up-title">{info.title}</div>
            <div className="up-info">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5l4.2 4.2L19 7"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>
                Đã đồng hành <b>{info.daysText}</b> ngày – Gia nhập {info.joinDateText}
              </span>
            </div>

            <button
              type="button"
              className="up-upload"
              onClick={() => fileRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 11l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" />
              </svg>
              {photoUrl ? "Đổi ảnh khác" : "Đính kèm hình ảnh"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPhoto}
              style={{ display: "none" }}
            />

            {photoUrl && (
              <div className="up-actions">
                <button
                  className="login-btn"
                  onClick={download}
                  disabled={busy || !posterReady}
                >
                  {busy ? "Đang xử lý…" : !posterReady ? "Đang dựng…" : "Tải về"}
                </button>
                <button
                  className="login-btn"
                  onClick={share}
                  disabled={busy || !posterReady}
                >
                  Chia sẻ
                </button>
              </div>
            )}
            {error && <div className="login-error">{error}</div>}

            <button type="button" className="up-reset" onClick={reset}>
              ← Tra cứu người khác
            </button>
          </div>
        </div>

        {/* Cube đè lên góc phải dưới poster */}
        <img className="up-cube" src="/login/cube-up.png" alt="" />

        {/* Cột phải: poster preview */}
        <div className="up-poster">
          <Poster
            ref={posterRef}
            data={{ ...info, photoUrl }}
            onNumberReady={handleNumberReady}
          />
        </div>
      </div>

      {/* Nền mobile (rays + skyline + cube) */}
      <img className="up-bgm" src="/login/bg-mobile.png" alt="" />
    </div>
  );
}
