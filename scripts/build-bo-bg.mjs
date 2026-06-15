// Tạo poster-bg-bo.png = poster-bg.png nhưng thay 4 NHÃN số liệu bằng nhãn BO,
// lấy từ ảnh BO chính chủ (cùng kích thước 1449x2048). Mọi thứ khác giống hệt.
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync } from "fs";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const kd = readFileSync("d:/nhatquy/sinhnhat/sinhnhat/public/poster-bg.png").toString("base64");
const bo = readFileSync("d:/nhatquy/sinhnhat/data/z7937377044003_173c08d1f25e93fd1f9c7ab2a7268385.jpg").toString("base64");
// Dải nhãn cần thay (toàn chiều ngang 4 thẻ)
const BAND = { x: 555, y: 1530, w: 873, h: 98 };
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args:["--no-sandbox"] });
const p = await b.newPage();
const html = `<canvas id=c></canvas><canvas id=z></canvas><script>
const KD='data:image/png;base64,${kd}', BO='data:image/jpeg;base64,${bo}', BAND=${JSON.stringify(BAND)};
function load(s){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=s;});}
window.run = async ()=>{
  const kd=await load(KD), bo=await load(BO);
  const c=document.getElementById('c'); c.width=1449; c.height=2048;
  const g=c.getContext('2d'); g.drawImage(kd,0,0);
  g.drawImage(bo, BAND.x,BAND.y,BAND.w,BAND.h, BAND.x,BAND.y,BAND.w,BAND.h);
  // crop kiểm tra vùng số liệu (y 1440..1660) zoom 1.5x
  const z=document.getElementById('z'); const sy=1440,sh=220,Z=1.5; z.width=1449*Z*0.62; z.height=sh*Z;
  z.getContext('2d').drawImage(c, 540,sy, 900,sh, 0,0, 900*Z, sh*Z);
  return { full:c.toDataURL('image/png'), crop:z.toDataURL('image/png') };
};
</script>`;
await p.setContent(html);
const out = await p.evaluate(()=>window.run());
writeFileSync("d:/nhatquy/sinhnhat/sinhnhat/public/poster-bg-bo.png", Buffer.from(out.full.split(',')[1],'base64'));
writeFileSync("d:/nhatquy/sinhnhat/sinhnhat/_bocheck.png", Buffer.from(out.crop.split(',')[1],'base64'));
console.log("saved poster-bg-bo.png + _bocheck.png");
await b.close();
