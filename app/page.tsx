"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import Poster, { type PosterData } from "@/components/Poster";

// Chạy trước khi browser vẽ trên client (tránh nháy); fallback useEffect khi SSR.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// iOS không hỗ trợ thuộc tính <a download> cho ảnh sinh động → phải cho user
// nhấn giữ ảnh để lưu.
function isIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" &&
      (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1)
  );
}
// Trình duyệt in-app (Zalo, Facebook, Instagram, TikTok...) chặn tải file blob.
function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Zalo|FBAN|FBAV|FB_IAB|Instagram|Line\/|Messenger|TikTok|MicroMessenger/i.test(ua);
}

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
  // Ảnh đã render để hiện full-màn cho user nhấn giữ lưu (iOS / Zalo / FB...).
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  // Cờ đang mở trong trình duyệt in-app (Zalo...) → hiện gợi ý.
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    setInApp(isInAppBrowser());
  }, []);

  // Reset cờ ready mỗi khi đổi người tra cứu (đổi số ngày) → chờ vẽ lại
  useEffect(() => {
    setPosterReady(false);
  }, [info?.daysText]);

  // An toàn: nếu canvas onReady không kích hoạt trong WebView hạn chế, vẫn mở
  // nút sau 5s (lúc này canvas chắc chắn đã vẽ xong).
  useEffect(() => {
    if (!photoUrl) return;
    const t = setTimeout(() => setPosterReady(true), 5000);
    return () => clearTimeout(t);
  }, [photoUrl]);

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
    // iOS Safari dựng SAI vị trí các phần tử absolute nếu node đang có
    // transform: scale() (poster thu nhỏ cho vừa khung). Khắc phục: tạm đặt
    // transform THẬT của node về scale(1) (kích thước gốc 1449×2048) ngay trên
    // DOM trước khi chụp, rồi khôi phục. Cha .poster-scale có overflow:hidden
    // nên không nháy ra ngoài khung.
    const prevTransform = node.style.transform;
    const prevOrigin = node.style.transformOrigin;
    node.style.transform = "scale(1)";
    node.style.transformOrigin = "top left";
    try {
      // Chờ font (SVN Cera, Bahnschrift) load xong → chữ không bị đo sai/lệch.
      if (typeof document !== "undefined" && document.fonts?.ready) {
        await document.fonts.ready;
      }
      // modern-screenshot: ổn định hơn html-to-image trên Safari/iOS.
      // scale:1 để KHÔNG nhân devicePixelRatio (iOS giới hạn kích thước canvas).
      const dataUrl = await domToPng(node, {
        width: 1449,
        height: 2048,
        scale: 1,
      });
      const r = await fetch(dataUrl);
      return r.blob();
    } finally {
      node.style.transform = prevTransform;
      node.style.transformOrigin = prevOrigin;
    }
  }

  async function download() {
    if (!posterRef.current) return;
    setBusy(true);
    try {
      const blob = await renderBlob();
      const url = URL.createObjectURL(blob);
      // iOS + trình duyệt in-app (Zalo/FB...) KHÔNG tải được qua <a download> →
      // hiện ảnh full-màn để người dùng nhấn giữ → "Lưu ảnh".
      if (isIOSDevice() || isInAppBrowser()) {
        setSavedImageUrl(url);
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `poster-${(info?.fullName || "newway").replace(/\s+/g, "-").toLowerCase()}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
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

            {!photoUrl ? (
              <button
                type="button"
                className="up-upload"
                onClick={() => fileRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 11l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5z" />
                </svg>
                Đính kèm hình ảnh
              </button>
            ) : (
              <div className="up-uploaded">
                <span className="up-up-ok">Tải ảnh thành công</span>
                <button
                  type="button"
                  className="up-edit"
                  onClick={() => fileRef.current?.click()}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Chỉnh sửa
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onPhoto}
              style={{ display: "none" }}
            />

            {error && <div className="login-error">{error}</div>}

            <button type="button" className="up-reset" onClick={reset}>
              ← Tra cứu người khác
            </button>
          </div>
        </div>

        {/* Cụm poster: shadow + cube + poster (PC: display:contents giữ vị trí
            tuyệt đối theo stage; mobile: wrapper relative để canh cube theo poster) */}
        <div className="up-poster-area">
          {/* Bóng gương (reflection) ngay dưới chân poster */}
          <img className="up-shadow" src="/login/poster-shadow.png" alt="" />

          {/* Cube đè lên góc phải dưới poster */}
          <img className="up-cube" src="/login/cube-up.png" alt="" />

          {/* Poster preview */}
          <div className="up-poster">
            <Poster
              ref={posterRef}
              data={{ ...info, photoUrl }}
              onNumberReady={handleNumberReady}
            />
          </div>
        </div>

        {/* Nút Tải xuống / Chia sẻ — sau poster (mobile dưới cùng; PC absolute dưới card) */}
        {photoUrl && (
          <div className="up-actions">
            <div className="up-act">
              <button
                type="button"
                className="up-actbtn"
                onClick={download}
                disabled={busy || !posterReady}
                aria-label="Tải xuống"
              >
                <img src="/login/btn-download.png" alt="" />
              </button>
              <span>TẢI XUỐNG</span>
            </div>
            <div className="up-act">
              <button
                type="button"
                className="up-actbtn"
                onClick={share}
                disabled={busy || !posterReady}
                aria-label="Chia sẻ"
              >
                <img src="/login/btn-share.png" alt="" />
              </button>
              <span>CHIA SẺ</span>
            </div>
          </div>
        )}

        {/* Gợi ý cho người mở từ Zalo/Facebook: nếu kẹt, mở bằng trình duyệt thật */}
        {photoUrl && inApp && (
          <p className="up-hint">
            Đang mở trong ứng dụng (Zalo/Facebook). Nếu lưu ảnh bị lỗi, bấm menu
            “⋯” góc trên rồi chọn <b>“Mở bằng trình duyệt”</b> (Safari/Chrome).
          </p>
        )}
      </div>

      {/* Nền mobile (rays + skyline + cube) */}
      <img className="up-bgm" src="/login/bg-mobile-up.png" alt="" />

      {/* Lớp lưu ảnh: hiện poster để NHẤN GIỮ → "Lưu ảnh" (iOS / Zalo / FB...) */}
      {savedImageUrl && (
        <div className="save-modal" onClick={() => setSavedImageUrl(null)}>
          <div className="save-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="save-modal-hint">
              Nhấn giữ vào ảnh → chọn <b>“Lưu ảnh”</b> / <b>“Thêm vào Ảnh”</b> để
              tải về máy
            </div>
            <img src={savedImageUrl} alt="Poster NewWay Realty" />
            <button
              type="button"
              className="save-modal-close"
              onClick={() => setSavedImageUrl(null)}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
