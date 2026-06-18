"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { domToPng } from "modern-screenshot";
import Poster, { type PosterData, type PhotoAdjust } from "@/components/Poster";

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
  // Tỉ lệ ảnh + vị trí/zoom do người dùng kéo-chỉnh trong khung tròn.
  const [photoRatio, setPhotoRatio] = useState(1);
  const [photoAdj, setPhotoAdj] = useState<PhotoAdjust>({ scale: 1, x: 0, y: 0 });
  // Tăng mỗi khi đổi ảnh → dùng làm "chữ ký" nhận biết ảnh đã chuẩn bị có cũ không.
  const [photoVer, setPhotoVer] = useState(0);
  const [busy, setBusy] = useState(false);
  // Số lớn (BigNumber) vẽ bằng canvas ASYNC — chỉ cho Tải/Chia sẻ khi đã vẽ xong
  // để không chụp phải canvas trống.
  const [posterReady, setPosterReady] = useState(false);
  // Ảnh đã render để hiện full-màn cho user nhấn giữ lưu (iOS / Zalo / FB...).
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  // Cờ đang mở trong trình duyệt in-app (Zalo...) → hiện gợi ý.
  const [inApp, setInApp] = useState(false);
  // CHỈ iOS + in-app (Zalo iOS) mới thực sự khó lưu ảnh → hiện banner mở Safari.
  // (Android Zalo tải thẳng được nên không cần.)
  const [iosInApp, setIosInApp] = useState(false);
  const [barClosed, setBarClosed] = useState(false);
  useEffect(() => {
    setInApp(isInAppBrowser());
    setIosInApp(isIOSDevice() && isInAppBrowser());
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
  // Mobile: thu nhỏ toàn bộ màn kết quả cho VỪA 1 màn (không cuộn).
  const [isMobile, setIsMobile] = useState(false);
  const [mScale, setMScale] = useState(1);
  const stageRef = useRef<HTMLDivElement>(null);
  useIsoLayoutEffect(() => {
    const fit = () => {
      const w = window.innerWidth / 1440;
      const h = window.innerHeight / 800;
      setLoginScale(Math.max(w, h));
      setUpScale(Math.min(w, h));
      setIsMobile(window.innerWidth <= 760);
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Mobile result: đo chiều cao layout THẬT của khung (không bị ảnh hưởng bởi
  // transform của chính nó) rồi scale cho vừa chiều cao màn hình thật.
  useIsoLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const el = stageRef.current;
    const fitMobile = () => {
      if (window.innerWidth > 760 || !stageRef.current) {
        setMScale(1);
        return;
      }
      const natural = stageRef.current.offsetHeight;
      if (!natural) return;
      const avail = window.innerHeight - 12;
      setMScale(Math.min(1, avail / natural));
    };
    fitMobile();
    const ro = el ? new ResizeObserver(fitMobile) : null;
    ro?.observe(el!);
    window.addEventListener("resize", fitMobile);
    return () => {
      window.removeEventListener("resize", fitMobile);
      ro?.disconnect();
    };
  }, [info, photoUrl, posterReady]);

  const posterRef = useRef<HTMLDivElement>(null);
  // Poster ẩn off-screen ở kích thước gốc (scale 1) — nguồn để render/chụp ngầm.
  const captureRef = useRef<HTMLDivElement>(null);
  // Ảnh đã render SẴN (cache) để share TỨC THÌ trên iOS (giữ user-activation).
  const preparedRef = useRef<{ url: string; file: File; key: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // "Chữ ký" trạng thái poster — đổi khi đổi người / ảnh / vị trí-zoom.
  function captureKey() {
    return `${info?.daysText}|${info?.khoi}|${photoVer}|${photoAdj.scale}|${photoAdj.x}|${photoAdj.y}`;
  }

  // Render SẴN ảnh poster (ngầm, từ poster ẩn — không nháy) sau khi user dừng
  // chỉnh ~400ms. Nhờ vậy khi bấm Tải/Chia sẻ trên iOS, ta gọi navigator.share
  // NGAY (dùng File đã có) → không bị mất "user-activation" → share luôn chạy.
  useEffect(() => {
    if (!photoUrl || !posterReady || !info) return;
    const key = captureKey();
    if (preparedRef.current?.key === key) return; // đã có bản mới nhất
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const url = await renderDataUrl();
        const blob = await (await fetch(url)).blob();
        if (cancelled) return;
        preparedRef.current = {
          url,
          file: new File([blob], posterFileName(), { type: "image/png" }),
          key,
        };
      } catch {
        /* để luồng chậm tự render khi bấm */
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl, posterReady, info, photoAdj, photoVer]);

  // Ghi nhận sự kiện (tham gia/tải/chia sẻ) để quản trị theo dõi. Fire-and-forget,
  // không chặn UI; keepalive để gửi xong kể cả khi trang chuyển/đóng.
  function track(action: "created" | "download" | "share", outcome: string) {
    if (!cccd) return;
    try {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cccd, action, outcome }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* bỏ qua lỗi log */
    }
  }

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
      track("created", "lookup");
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
    setError(null);
    // Giải mã ảnh -> vẽ vào canvas -> thu nhỏ -> xuất JPEG sạch. Khắc phục:
    //  - Ảnh HEIC/HEIF (iPhone) hoặc định dạng lạ: <img> không hiện được dù
    //    FileReader vẫn "thành công" → ở đây onerror sẽ báo lỗi rõ ràng.
    //  - Ảnh quá lớn (vài chục MP): thu nhỏ để máy yếu không decode hỏng + ảnh
    //    poster nhẹ hơn khi chụp/chia sẻ.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1400;
      const ratio = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * ratio));
      const h = Math.max(1, Math.round(img.naturalHeight * ratio));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Trình duyệt không xử lý được ảnh, thử trình duyệt khác nhé.");
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      try {
        setPhotoUrl(canvas.toDataURL("image/jpeg", 0.92));
        setPhotoRatio(w / h); // tỉ lệ ảnh để Poster tính khung + giới hạn kéo
        setPhotoAdj({ scale: 1, x: 0, y: 0 }); // ảnh mới → reset vị trí/zoom
        setPhotoVer((v) => v + 1);
      } catch {
        setError("Ảnh không hợp lệ, hãy thử ảnh khác.");
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Không đọc được ảnh này (có thể là định dạng HEIC). Hãy chọn ảnh JPG/PNG.");
    };
    img.src = url;
  }

  async function renderDataUrl(): Promise<string> {
    // Chụp từ POSTER ẨN (off-screen, luôn ở kích thước gốc 1449×2048 / scale 1)
    // → không cần đụng transform của poster đang hiển thị (không nháy), và iOS
    // dựng đúng vị trí các phần tử absolute (vì scale = 1).
    const node = captureRef.current ?? posterRef.current!;
    // Chờ font (SVN Cera, Bahnschrift) load xong → chữ không bị đo sai/lệch.
    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready;
    }
    // modern-screenshot: ổn định hơn html-to-image trên Safari/iOS.
    // scale:1 để KHÔNG nhân devicePixelRatio (iOS giới hạn kích thước canvas).
    return await domToPng(node, { width: 1449, height: 2048, scale: 1 });
  }

  function posterFileName() {
    return `poster-${(info?.fullName || "newway").replace(/\s+/g, "-").toLowerCase()}.png`;
  }


  // Lưu/chia sẻ ảnh poster theo cách tốt nhất cho từng nền tảng.
  // - iOS / in-app (Zalo, FB...): mở SHARE SHEET hệ thống → có "Lưu ảnh" /
  //   "Thêm vào Ảnh" / gửi Zalo (1 chạm, đáng tin nhất trên iPhone).
  // - Nếu không hỗ trợ share file: hiện ảnh full-màn để nhấn giữ "Lưu ảnh".
  // - Desktop: tải file trực tiếp.
  async function saveImage(preferShare: boolean) {
    if (!posterRef.current && !captureRef.current) return;
    const nav = navigator as Navigator & {
      canShare?: (d: ShareData) => boolean;
    };
    const ios = isIOSDevice();
    const inApp = isInAppBrowser();
    const action = preferShare ? "share" : "download";

    // ⚡ FAST PATH (iOS / nút Chia sẻ): nếu đã render SẴN ảnh khớp trạng thái hiện
    // tại → gọi navigator.share NGAY (không await render trước) → giữ được
    // "user-activation" của cú chạm → share LUÔN chạy (hết cảnh lúc được lúc không).
    const prepared = preparedRef.current;
    if (
      (ios || preferShare) &&
      typeof nav.share === "function" &&
      prepared &&
      prepared.key === captureKey() &&
      (typeof nav.canShare !== "function" || nav.canShare({ files: [prepared.file] }))
    ) {
      try {
        await navigator.share({ files: [prepared.file], title: "NewWay Realty" });
        track(action, "shared");
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") {
          track(action, "cancelled");
          return;
        }
        // lỗi khác (không hỗ trợ) → rơi xuống luồng chậm
      }
    }

    // 🐢 SLOW PATH: chưa có ảnh sẵn → render rồi xử lý (có thể mất activation trên
    // iOS → rơi xuống nhấn-giữ, nhưng hiếm vì đã render sẵn ở trên).
    setBusy(true);
    try {
      const dataUrl =
        prepared && prepared.key === captureKey() ? prepared.url : await renderDataUrl();
      const name = posterFileName();

      // 1) Web Share sheet (có "Lưu ảnh"/"Thêm vào Ảnh"): cho iOS (mọi nơi, kể cả
      //    Zalo) và nút Chia sẻ. iOS KHÔNG cho web tải file thẳng vào Ảnh → Share
      //    Sheet là cách tốt nhất để lưu (1–2 chạm, không cần mở Safari). Cổng vào
      //    là navigator.share; canShare chỉ tiền-kiểm tra khi có.
      if ((ios || preferShare) && typeof nav.share === "function") {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], name, { type: "image/png" });
        const shareData = { files: [file], title: "NewWay Realty" };
        if (typeof nav.canShare !== "function" || nav.canShare({ files: [file] })) {
          try {
            await navigator.share(shareData);
            track(action, "shared");
            return;
          } catch (e) {
            if ((e as Error)?.name === "AbortError") {
              track(action, "cancelled");
              return;
            }
          }
        }
      }

      // 2) iOS (không có Web Share) hoặc nút Chia sẻ trong in-app → hiện ảnh để
      //    nhấn giữ → "Lưu ảnh"/"Chia sẻ ảnh" (ở lại trong app, không cần Safari).
      if (ios || (preferShare && inApp)) {
        setSavedImageUrl(dataUrl);
        track(action, "shown");
        return;
      }

      // 3) Android/desktop → <a download> → tải thẳng.
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = name;
      a.click();
      track(action, "downloaded");
    } catch {
      setError("Không tạo được ảnh, thử lại nhé");
      track(preferShare ? "share" : "download", "error");
    } finally {
      setBusy(false);
    }
  }

  const download = () => saveImage(false);
  const share = () => saveImage(true);

  function reset() {
    setInfo(null);
    setPhotoUrl(null);
    setCccd("");
    setError(null);
  }

  // Banner hiện NGAY TỪ ĐẦU cho iOS mở trong Zalo/FB — nơi tải ảnh khó nhất.
  const openBrowserBar =
    iosInApp && !barClosed ? (
      <div className="open-browser-bar">
        <span>
          💡 Để lưu ảnh dễ nhất, hãy mở bằng <b>Safari</b>: bấm <b>“⋯”</b> góc trên
          → <b>“Mở bằng trình duyệt”</b>
        </span>
        <button
          type="button"
          className="open-browser-close"
          aria-label="Đóng"
          onClick={() => setBarClosed(true)}
        >
          ×
        </button>
      </div>
    ) : null;

  if (!info) {
    return (
      <div className="login">
        {openBrowserBar}
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
      {openBrowserBar}
      <div
        className="up-stage"
        ref={stageRef}
        style={{
          transform: `translate(-50%, -50%) scale(${isMobile ? mScale : upScale})`,
        }}
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
                Đã đồng hành <b>{info.daysText}</b> ngày –{" "}
                <span className="nowrap">Gia nhập {info.joinDateText}</span>
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

            {photoUrl && (
              <div className="up-photo-hint">
                Kéo ảnh trong khung để chỉnh vị trí · chụm 2 ngón / lăn chuột để phóng to
              </div>
            )}

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

          {/* Poster preview (hiển thị + kéo-chỉnh). Readiness/capture lấy từ poster
              ẩn bên dưới nên không cần onNumberReady ở đây. */}
          <div className="up-poster">
            <Poster
              ref={posterRef}
              data={{ ...info, photoUrl }}
              photoRatio={photoRatio}
              adjust={photoAdj}
              onAdjust={setPhotoAdj}
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

      </div>

      {/* Poster ẩn off-screen ở kích thước GỐC 1449px (scale 1): nguồn render/chụp
          ngầm cho Tải/Chia sẻ. Đặt NGOÀI .up-stage để không dính transform scale.
          onNumberReady ở đây quyết định posterReady (ảnh đã sẵn để chụp). */}
      <div aria-hidden style={{ position: "fixed", left: -100000, top: 0, width: 1449, pointerEvents: "none" }}>
        <Poster
          ref={captureRef}
          data={{ ...info, photoUrl }}
          onNumberReady={handleNumberReady}
          photoRatio={photoRatio}
          adjust={photoAdj}
        />
      </div>

      {/* Nền mobile (rays + skyline + cube) */}
      <img className="up-bgm" src="/login/bg-mobile-up.png" alt="" />

      {/* Màn chờ che lúc đang chụp (tránh nháy poster phóng to scale(1)) */}
      {busy && !savedImageUrl && (
        <div className="busy-overlay">
          <div className="busy-spinner" />
          <div className="busy-text">Đang tạo ảnh…</div>
        </div>
      )}

      {/* Lớp lưu ảnh: hiện poster để NHẤN GIỮ → "Lưu ảnh" (iOS / Zalo / FB...) */}
      {savedImageUrl && (
        <div className="save-modal" onClick={() => setSavedImageUrl(null)}>
          <div className="save-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="save-modal-hint">
              Nhấn giữ vào ảnh → chọn <b>“Chia sẻ ảnh”</b> / <b>“Lưu ảnh”</b>
            </div>
            <img src={savedImageUrl} alt="Poster NewWay Realty" />
            {inApp && (
              <div className="save-modal-note">
                Chưa được? Bấm <b>“⋯”</b> góc trên → <b>“Mở bằng trình duyệt”</b>{" "}
                (Safari / Chrome) rồi thử lại.
              </div>
            )}
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
