// Tạo nền poster cho từng KHỐI (bo / bld) = nền KD (poster-bg.png) nhưng thay
// dải 4 NHÃN số liệu bằng nhãn của khối, lấy từ ảnh poster CHÍNH CHỦ của khối đó
// (cùng kích thước 1449x2048). Mọi phần khác giống hệt nền KD.
//
// Chạy lại khi thiết kế nhãn của khối thay đổi:
//   node scripts/build-poster-bg.mjs
// (cần Chrome + 2 ảnh nguồn trong ../data — KHÔNG commit ảnh nguồn).
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync } from "fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PUB = "d:/nhatquy/sinhnhat/sinhnhat/public";
const DATA = "d:/nhatquy/sinhnhat/data";

// Dải nhãn (toàn chiều ngang 4 thẻ) — số liệu nằm phía trên (do app overlay) nên
// chỉ chép phần nhãn, không dính số động.
const BAND = { x: 555, y: 1530, w: 873, h: 98 };

const VARIANTS = [
  { out: "poster-bg-bo.png", src: `${DATA}/z7937377044003_173c08d1f25e93fd1f9c7ab2a7268385.jpg` },
  { out: "poster-bg-bld.png", src: `${DATA}/z7946097562153_2d069fd8d4344c1f27b03e57665323a8.jpg` },
];

const kd = readFileSync(`${PUB}/poster-bg.png`).toString("base64");
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setContent("<canvas id=c></canvas>");

for (const v of VARIANTS) {
  const src = readFileSync(v.src).toString("base64");
  const dataUrl = await p.evaluate(
    async (kd, src, BAND) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = s; });
      const k = await load("data:image/png;base64," + kd);
      const o = await load("data:image/jpeg;base64," + src);
      const c = document.getElementById("c");
      c.width = 1449;
      c.height = 2048;
      const g = c.getContext("2d");
      g.drawImage(k, 0, 0);
      g.drawImage(o, BAND.x, BAND.y, BAND.w, BAND.h, BAND.x, BAND.y, BAND.w, BAND.h);
      return c.toDataURL("image/png");
    },
    kd,
    src,
    BAND
  );
  writeFileSync(`${PUB}/${v.out}`, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log("✓", v.out);
}

await b.close();
