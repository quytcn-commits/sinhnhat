"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import BigNumber from "./BigNumber";
import AutoFitText from "./AutoFitText";

export type PosterData = {
  fullName: string;
  title: string;
  joinDateText: string;
  rank: string;
  daysText: string;
  stats: { calls: string; meetings: string; deals: string; hours: string };
  photoUrl: string | null;
  /** Khối: "bo" → nền poster BO (nhãn 4 ô khác); còn lại → nền KD mặc định */
  khoi?: "bo" | "kd";
};

const FONT = '"SVN Cera", sans-serif';

// Toạ độ theo hệ pixel gốc của file PSB: 1449 x 2048
function box(left: number, top: number, width: number, height: number) {
  return { left, top, width, height } as const;
}

export type PhotoAdjust = { scale: number; x: number; y: number };

// Khung ảnh tròn theo hệ pixel gốc PSB
const CLIP_W = 598;
const CLIP_H = 631;

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Giới hạn x/y để ảnh LUÔN phủ kín khung (không lòi nền). ratio = natW/natH.
function clampAdjust(a: PhotoAdjust, ratio: number): PhotoAdjust {
  const cover = Math.max(CLIP_W / ratio, CLIP_H);
  const scale = clampNum(a.scale, 1, 4);
  const w = ratio * cover * scale;
  const h = cover * scale;
  const maxX = Math.max(0, (w - CLIP_W) / 2);
  const maxY = Math.max(0, (h - CLIP_H) / 2);
  return { scale, x: clampNum(a.x, -maxX, maxX), y: clampNum(a.y, -maxY, maxY) };
}

const Poster = forwardRef<
  HTMLDivElement,
  {
    data: PosterData;
    onNumberReady?: () => void;
    /** Tỉ lệ ảnh natW/natH (để tính cover); kèm adjust + onAdjust để kéo/chỉnh */
    photoRatio?: number;
    adjust?: PhotoAdjust;
    onAdjust?: (a: PhotoAdjust) => void;
  }
>(function Poster({ data, onNumberReady, photoRatio = 1, adjust, onAdjust }, ref) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // ---- Kéo thả / phóng to ảnh trong khung tròn ----
  const adj = adjust ?? { scale: 1, x: 0, y: 0 };
  const editable = !!(onAdjust && data.photoUrl);
  const clipRef = useRef<HTMLDivElement>(null);
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const start = useRef<{ adj: PhotoAdjust; px2n: number; drag: { x: number; y: number }; pinch: number }>({
    adj: adj,
    px2n: 1,
    drag: { x: 0, y: 0 },
    pinch: 0,
  });

  function baseline() {
    const el = clipRef.current;
    start.current.adj = adj;
    start.current.px2n = el ? CLIP_W / el.getBoundingClientRect().width : 1; // screen px -> native px
    const pts = [...ptrs.current.values()];
    if (pts.length === 1) start.current.drag = pts[0];
    else if (pts.length >= 2) start.current.pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
  function onDown(e: React.PointerEvent) {
    if (!editable) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    baseline();
  }
  function onMove(e: React.PointerEvent) {
    if (!editable || !ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    const s0 = start.current;
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const ns = s0.adj.scale * (d / (s0.pinch || d));
      onAdjust!(clampAdjust({ scale: ns, x: s0.adj.x, y: s0.adj.y }, photoRatio));
    } else {
      const dx = (e.clientX - s0.drag.x) * s0.px2n;
      const dy = (e.clientY - s0.drag.y) * s0.px2n;
      onAdjust!(clampAdjust({ scale: s0.adj.scale, x: s0.adj.x + dx, y: s0.adj.y + dy }, photoRatio));
    }
  }
  function onUp(e: React.PointerEvent) {
    ptrs.current.delete(e.pointerId);
    baseline();
  }
  // Phóng to bằng lăn chuột (desktop) — listener non-passive để chặn cuộn trang.
  useEffect(() => {
    const el = clipRef.current;
    if (!el || !editable) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const ns = adj.scale * (e.deltaY < 0 ? 1.08 : 1 / 1.08);
      onAdjust!(clampAdjust({ scale: ns, x: adj.x, y: adj.y }, photoRatio));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [editable, adj.scale, adj.x, adj.y, photoRatio, onAdjust]);

  // Style ảnh: kích thước cover × scale, dời theo x/y (đơn vị px gốc poster → đúng
  // ở cả preview thu nhỏ lẫn lúc chụp scale(1)).
  const cover = Math.max(CLIP_W / photoRatio, CLIP_H);
  const imgW = photoRatio * cover * adj.scale;
  const imgH = cover * adj.scale;
  const imgStyle: React.CSSProperties = {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: `${imgW}px`,
    height: `${imgH}px`,
    maxWidth: "none",
    transform: `translate(${-imgW / 2 + adj.x}px, ${-imgH / 2 + adj.y}px)`,
  };

  // Scale .poster (1449px) cho vừa bề ngang container hiển thị
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / 1449);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const statCenters = [709, 904, 1098, 1295];
  const statVals = [data.stats.calls, data.stats.meetings, data.stats.deals, data.stats.hours];
  // Nền theo khối: BO dùng ảnh có 4 nhãn riêng; mặc định KD.
  const bgUrl = data.khoi === "bo" ? "/poster-bg-bo.png" : "/poster-bg.png";

  return (
    <div className="poster-scale" ref={shellRef}>
      <div
        className="poster"
        ref={ref}
        style={{ transform: `scale(${scale})`, backgroundImage: `url("${bgUrl}")` }}
      >
        {/* Ảnh chân dung — lấp đầy tới sát vành xanh; kéo để dời, chụm/lăn để phóng to */}
        <div
          className={"photo-clip" + (editable ? " editable" : "")}
          style={box(736, 100, CLIP_W, CLIP_H)}
          ref={clipRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {data.photoUrl ? (
            <img src={data.photoUrl} alt="" draggable={false} style={imgStyle} />
          ) : null}
        </div>

        {/* Khung tên (Rectangle 1) — overlay TRÊN ảnh, căn giữa tâm ảnh (x=1035) */}
        <img
          src="/name-frame.png"
          alt=""
          style={{ position: "absolute", ...box(692, 714, 685, 149) }}
        />

        {/* Họ tên — SVN-CeraBold + gradient xanh, căn giữa, tự co nếu dài */}
        <AutoFitText
          text={data.fullName}
          left={712}
          top={724}
          width={645}
          height={70}
          maxWidth={640}
          fontSize={51}
          align="center"
          className="g-green"
          fontFamily={FONT}
          fontWeight={700}
          letterSpacing={1}
        />

        {/* Chức danh — SVN-Cera Regular, căn giữa, tự co nếu dài */}
        <AutoFitText
          text={data.title}
          left={697}
          top={798}
          width={675}
          height={40}
          maxWidth={670}
          fontSize={33}
          align="center"
          fontFamily={FONT}
          fontWeight={400}
          letterSpacing={1}
          color="#3a7d50"
        />

        {/* Số ngày đồng hành — số lớn vẽ bằng Canvas (đúng layer-style PSB 100%) */}
        <BigNumber text={data.daysText} onReady={onNumberReady} />

        {/* Ngày gia nhập — SVN-CeraBold 55, tự co nếu dài */}
        <AutoFitText
          text={data.joinDateText}
          left={953}
          top={966}
          width={430}
          height={52}
          maxWidth={430}
          fontSize={55}
          className="g-green"
          fontFamily={FONT}
          fontWeight={700}
        />

        {/* Cấp bậc — SVN-CeraBold 55, tự co nếu dài (HUYỀN THOẠI, CHIẾN BINH...) */}
        <AutoFitText
          text={data.rank}
          left={954}
          top={1098}
          width={430}
          height={52}
          maxWidth={430}
          fontSize={55}
          className="g-green"
          fontFamily={FONT}
          fontWeight={700}
        />

        {/* 4 ô số liệu — Bahnschrift SemiBold Condensed 56 (đúng PSB) */}
        {statCenters.map((cx, i) => (
          <div
            key={i}
            className="ov-text g-green bahn-sbc"
            style={{
              ...box(cx - 140, 1460, 280, 62),
              justifyContent: "center",
              fontSize: 56,
            }}
          >
            {statVals[i]}
          </div>
        ))}

        {/* Số trong câu trích dẫn — Bahnschrift SemiBold Condensed 45, căn trái thẳng "Đó là..." */}
        <div
          className="ov-text g-green bahn-sbc"
          style={{
            ...box(325, 1668, 200, 46),
            justifyContent: "flex-start",
            fontSize: 45,
          }}
        >
          {data.daysText}
        </div>
      </div>
    </div>
  );
});

export default Poster;
