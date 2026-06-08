import puppeteer from "puppeteer-core";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const url = process.argv[2] || "http://localhost:3000/export-test";
const out = process.argv[3] || "_pp_result.png";
const sel = process.argv[4] || "#result";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--force-device-scale-factor=1"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 2100, deviceScaleFactor: 1 });
page.on("console", (m) => console.log("PAGE:", m.text()));
page.on("pageerror", (e) => console.log("PAGEERR:", e.message));
await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
try {
  await page.waitForSelector(sel, { timeout: 30000 });
  const el = await page.$(sel);
  if (sel === "#result") {
    const src = await page.$eval("#result", (i) => i.src);
    const b64 = src.split(",")[1];
    const fs = await import("node:fs");
    fs.writeFileSync(out, Buffer.from(b64, "base64"));
  } else {
    await el.screenshot({ path: out });
  }
  console.log("OK saved", out);
} catch (e) {
  console.log("FAIL:", e.message);
  const body = await page.$eval("body", (b) => b.innerText).catch(() => "");
  console.log("BODY:", body.slice(0, 300));
}
await browser.close();
