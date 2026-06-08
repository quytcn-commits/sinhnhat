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
};

const FONT = '"SVN Cera", sans-serif';

// Toạ độ theo hệ pixel gốc của file PSB: 1449 x 2048
function box(left: number, top: number, width: number, height: number) {
  return { left, top, width, height } as const;
}

const Poster = forwardRef<
  HTMLDivElement,
  { data: PosterData; onNumberReady?: () => void }
>(function Poster({ data, onNumberReady }, ref) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

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

  return (
    <div className="poster-scale" ref={shellRef}>
      <div className="poster" ref={ref} style={{ transform: `scale(${scale})` }}>
        {/* Ảnh chân dung — lấp đầy tới sát vành xanh (phủ qua vùng glass sáng), chỉ chừa vành ring */}
        <div className="photo-clip" style={box(736, 100, 598, 631)}>
          {data.photoUrl ? (
            <img src={data.photoUrl} alt="" crossOrigin="anonymous" />
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
