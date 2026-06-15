// QA nút Tải xuống / Chia sẻ trên nhiều nền tảng (mô phỏng bằng Chrome headless).
// Theo dõi nhánh xử lý nào thực sự chạy + xác minh PNG sinh ra hợp lệ.
import puppeteer from "puppeteer-core";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const CCCD = "038190013814";
const PHOTO = "d:/nhatquy/sinhnhat/sinhnhat/public/login/badge.png";

const UA_PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const UA_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const UA_IOS_ZALO = UA_IOS + " Zalo";
const UA_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
const UA_ANDROID_ZALO = UA_ANDROID + " Zalo";

// share: 'ok' = share+canShare đầy đủ | 'nocanshare' = có share, thiếu canShare
//        | 'none' = không có Web Share
const PROFILES = [
  { name: "PC (no Web Share)",          ua: UA_PC,       share: "none" },
  { name: "PC Chrome (Web Share)",      ua: UA_PC,       share: "ok"   },
  { name: "iOS Safari",                 ua: UA_IOS,      share: "ok"   },
  { name: "iOS Zalo (share, no canShare)", ua: UA_IOS_ZALO, share: "nocanshare" },
  { name: "iOS Zalo (no share)",        ua: UA_IOS_ZALO, share: "none" },
  { name: "Android Chrome",             ua: UA_ANDROID,  share: "ok"   },
  { name: "Android Zalo (no share)",    ua: UA_ANDROID_ZALO, share: "none" },
];

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

function injection(shareMode) {
  return `(() => {
    window.__log = { anchor: null, share: null, canShareCalls: 0 };
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        window.__log.anchor = { download: this.download, href: (this.href||'').slice(0,22), len: (this.href||'').length };
        return; // chặn điều hướng thật trong test
      }
      return origClick.apply(this, arguments);
    };
    const def = (k, v) => Object.defineProperty(navigator, k, { value: v, configurable: true });
    const mockShare = () => def('share', async (d) => { window.__log.share = { title: d.title, files: (d.files||[]).map(f => ({ name: f.name, type: f.type, size: f.size })) }; });
    const mockCanShare = () => def('canShare', (d) => { window.__log.canShareCalls++; return !!(d && d.files); });
    ${shareMode === "ok" ? "mockShare(); mockCanShare();"
      : shareMode === "nocanshare" ? "mockShare(); def('canShare', undefined);"
      : "def('share', undefined); def('canShare', undefined);"}
  })();`;
}

async function snap(p) {
  return await p.evaluate(() => {
    const modal = document.querySelector(".save-modal img");
    return {
      log: window.__log,
      savedImg: modal ? { prefix: modal.src.slice(0, 22), len: modal.src.length } : null,
    };
  });
}
async function clearState(p) {
  await p.evaluate(() => {
    window.__log = { anchor: null, share: null, canShareCalls: 0 };
    const close = document.querySelector(".save-modal-close");
    if (close) close.click();
  });
}

function classify(s) {
  if (s.log.share) return `share() → file ${s.log.share.files[0]?.type} ${s.log.share.files[0]?.size}B`;
  if (s.log.anchor) return `<a download="${s.log.anchor.download}"> ${s.log.anchor.href}… (${s.log.anchor.len}B)`;
  if (s.savedImg) return `modal nhấn-giữ ${s.savedImg.prefix}… (${s.savedImg.len}B)`;
  return "‼ KHÔNG có hành động nào";
}
function validPng(s) {
  const src = s.log.share ? null : s.log.anchor ? s.log.anchor.href : s.savedImg ? s.savedImg.prefix : null;
  if (s.log.share) return s.log.share.files[0]?.type === "image/png" && s.log.share.files[0]?.size > 1000;
  if (src) return src.startsWith("data:image/png;base64");
  return false;
}

for (const prof of PROFILES) {
  const p = await b.newPage();
  await p.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 });
  await p.setUserAgent(prof.ua);
  await p.evaluateOnNewDocument(injection(prof.share));
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));

  await p.goto("http://localhost:3000/", { waitUntil: "networkidle0" });
  await p.type("#cccd", CCCD);
  await p.click("button.login-btn");
  await p.waitForSelector(".poster", { timeout: 15000 });
  const inp = await p.$('input[type=file]');
  await inp.uploadFile(PHOTO);
  // chờ nút bật (posterReady) — tối đa 8s
  await p.waitForSelector('button[aria-label="Tải xuống"]:not([disabled])', { timeout: 9000 });

  await clearState(p);
  await p.click('button[aria-label="Tải xuống"]');
  await p.waitForFunction(() => window.__log.anchor || window.__log.share || document.querySelector('.save-modal img'), { timeout: 9000 });
  const dl = await snap(p);

  await clearState(p);
  await p.click('button[aria-label="Chia sẻ"]');
  await p.waitForFunction(() => window.__log.anchor || window.__log.share || document.querySelector('.save-modal img'), { timeout: 9000 });
  const sh = await snap(p);

  const okDl = validPng(dl), okSh = validPng(sh);
  console.log(`\n■ ${prof.name}`);
  console.log(`   TẢI XUỐNG : ${classify(dl)}   ${okDl ? "✅" : "❌"}`);
  console.log(`   CHIA SẺ   : ${classify(sh)}   ${okSh ? "✅" : "❌"}`);
  if (errs.length) console.log("   pageerror:", errs.join(" | "));
  await p.close();
}

await b.close();
console.log("\nDONE");
