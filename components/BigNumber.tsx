"use client";

import { useEffect, useRef } from "react";

// Ghép số lớn từ các glyph GỐC Photoshop (cắt từ "0123456789" + "." của PSB).
// Vị trí/kerning theo metric font SVN-CeraBold. Sau khi ghép, TÁI ÁP gradient
// (Gradient Overlay của PS, "aligned with layer") theo ĐÚNG ink-box của số mới —
// vì glyph nguồn mang lát gradient của chuỗi "0123456789", không đúng cho số mới.

type GlyphMeta = {
  coreX: number;
  coreY: number;
  coreW: number;
  coreH: number;
  imgW: number;
  imgH: number;
  file: string;
  adv: number;
  bearLeft: number;
  ascent: number;
};
type Metrics = {
  FS: number;
  exp2_h: number;
  expBaseline: number;
  glyphs: Record<string, GlyphMeta & { psbBottom?: number; expX0?: number; expY0?: number }>;
};

// Hộp canvas trong hệ poster 1449x2048 (số ở bbox ~(94,716,620,861))
const BOX = { left: 17, top: 656, width: 680, height: 268 };
const CENTER_X = 357; // tâm ngang số (poster) — khớp PSB cX=356.5
const BASE_Y = 858; // baseline (đáy digit) — khớp PSB bottom=858
const PSB2_H = 143; // chiều cao "2" (poster px) — khớp PSB ("2" cao 142–143)
const ADV_K = 0.9849; // hiệu chỉnh advance (cụm hơi rộng ~1.5%) → width khớp 526
const SS = 2;

export default function BigNumber({
  text,
  onReady,
}: {
  text: string;
  onReady?: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    (async () => {
      const meta: Metrics = await fetch("/glyphs/metrics.json").then((r) => r.json());
      const chars = text.split("").filter((c) => meta.glyphs[c]);
      if (chars.length === 0) {
        canvas.width = BOX.width * SS;
        canvas.height = BOX.height * SS;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onReady?.();
        return;
      }
      const imgs = await Promise.all(
        chars.map(
          (c) =>
            new Promise<HTMLImageElement>((res, rej) => {
              const im = new Image();
              im.onload = () => res(im);
              im.onerror = rej;
              im.src = "/glyphs/" + meta.glyphs[c].file;
            })
        )
      );
      if (!active) return;

      // layout (toạ độ NATIVE export px) — pen theo advance đã hiệu chỉnh
      let pen = 0;
      const lay = chars.map((c) => {
        const g = meta.glyphs[c];
        const o = { g, pen, c };
        pen += g.adv * ADV_K;
        return o;
      });

      // --- Vẽ glyph ở độ phân giải NATIVE (export px) lên offscreen ---
      // Toạ độ native: x ngang theo pen; y theo baseline = expBaseline.
      // Tính vùng vẽ để cấp canvas offscreen đủ rộng (có padding cho glow).
      const PAD = 40;
      let minX = Infinity,
        maxX = -Infinity;
      const placed = lay.map(({ g, pen: p, c }, i) => {
        const dx = p + g.bearLeft - g.coreX; // ảnh trái (native), trước padding
        const glyphBaseline = g.psbBottom ?? meta.expBaseline;
        const dy = meta.expBaseline - glyphBaseline; // canh baseline về expBaseline
        minX = Math.min(minX, dx);
        maxX = Math.max(maxX, dx + g.imgW);
        return { g, c, dx, dy, img: imgs[i] };
      });
      const offW = Math.ceil(maxX - minX) + 2 * PAD;
      const offH = Math.ceil(meta.glyphs[chars[0]].imgH) + 2 * PAD;
      const shiftX = PAD - minX;
      const shiftY = PAD;

      const off = document.createElement("canvas");
      off.width = offW;
      off.height = offH;
      const octx = off.getContext("2d")!;
      octx.clearRect(0, 0, offW, offH);
      for (const pl of placed) {
        octx.drawImage(pl.img, pl.dx + shiftX, pl.dy + shiftY);
      }

      // --- Tính ink-box thật của số (chỉ digit cho chiều dọc; cả cụm cho ngang) ---
      const id = octx.getImageData(0, 0, offW, offH);
      const px = id.data;
      let ix0 = offW,
        iy0 = offH,
        ix1 = 0,
        iy1 = 0;
      for (let y = 0; y < offH; y++) {
        for (let x = 0; x < offW; x++) {
          if (px[(y * offW + x) * 4 + 3] > 120) {
            if (x < ix0) ix0 = x;
            if (x > ix1) ix1 = x;
            if (y < iy0) iy0 = y;
            if (y > iy1) iy1 = y;
          }
        }
      }
      // GIỮ NGUYÊN pixel gốc Photoshop (gradient + bevel + glow + shadow thật).
      // Không tái áp gradient: việc thay mặt chữ bằng gradient công thức sẽ XOÁ
      // các viền bevel tối (#094B02) ở alpha cao -> mất tương phản, số bị sáng.
      // ix0..iy1 (ink-box) chỉ dùng để canh giữa bên dưới.
      void id;

      // --- Đưa offscreen (native) vào canvas chính, scale & canh vị trí poster ---
      const s = (PSB2_H / meta.exp2_h) * SS; // native px -> canvas px
      const ox = BOX.left * SS,
        oy = BOX.top * SS;
      // tâm ink (native) để canh giữa
      const centerInkNative = (ix0 - shiftX + ix1 - shiftX) / 2;
      const originX = CENTER_X * SS - ox - centerInkNative * s;
      const baseYc = BASE_Y * SS - oy;

      canvas.width = BOX.width * SS;
      canvas.height = BOX.height * SS;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // map: native point (nx,ny) -> canvas. nx0 = -shiftX (native origin), baseline at expBaseline.
      // canvas x = originX + (nx) * s ; với nx tính từ native-origin (đã trừ shiftX khi vẽ off)
      // Ở off, native point n có x_off = n + shiftX. Ta vẽ off lên canvas tại:
      //   canvasX(x_off) = originX + (x_off - shiftX) * s
      // tức dest origin = originX - shiftX*s, scale = s.
      const destX = originX - shiftX * s;
      const destY = baseYc - (meta.expBaseline + shiftY) * s;
      ctx.drawImage(off, 0, 0, offW, offH, destX, destY, offW * s, offH * s);

      onReady?.();
    })();

    return () => {
      active = false;
    };
  }, [text, onReady]);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        left: BOX.left,
        top: BOX.top,
        width: BOX.width,
        height: BOX.height,
      }}
    />
  );
}
