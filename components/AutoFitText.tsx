"use client";

import { CSSProperties, useLayoutEffect, useRef, useState } from "react";

// Chữ tự co cỡ để vừa khung (cho tên/chức danh/cấp bậc dài ngắn khác nhau giữa 1022 nhân sự).
export default function AutoFitText({
  text,
  left,
  top,
  width,
  height,
  fontSize,
  maxWidth,
  align = "left",
  className,
  fontFamily,
  fontWeight,
  letterSpacing,
  color,
}: {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
  maxWidth?: number;
  align?: "left" | "center";
  className?: string;
  fontFamily?: string;
  fontWeight?: number;
  letterSpacing?: number;
  color?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fs, setFs] = useState(fontSize);

  // reset khi text/cỡ gốc đổi
  useLayoutEffect(() => {
    setFs(fontSize);
  }, [text, fontSize]);

  // đo & co lại nếu tràn
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const limit = maxWidth ?? width;
    const w = el.scrollWidth;
    if (w > limit + 0.5) {
      setFs((cur) => Math.max(8, Math.min(cur, (fontSize * limit) / w)));
    }
  });

  const box: CSSProperties = {
    position: "absolute",
    left,
    top,
    width,
    height,
    display: "flex",
    alignItems: "center",
    justifyContent: align === "center" ? "center" : "flex-start",
  };
  const span: CSSProperties = {
    fontSize: fs,
    // Chừa headroom cho dấu nhô cao (ngã/huyền/sắc trên Ễ, Ế, Ề…). Với
    // background-clip:text, phần glyph vượt ra ngoài hộp dòng sẽ KHÔNG được tô
    // (mất dấu) — line-height rộng để hộp dòng phủ hết dấu.
    lineHeight: 1.5,
    whiteSpace: "nowrap",
    fontFamily,
    fontWeight,
    letterSpacing,
    color,
  };

  return (
    <div style={box}>
      <span ref={ref} className={className} style={span}>
        {text}
      </span>
    </div>
  );
}
