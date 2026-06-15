// Phân tích User-Agent -> loại thiết bị / hệ điều hành / trình duyệt / in-app.
// Dùng ở server (API /track) để ghi log sự kiện cho đáng tin (UA thật của request).

export type DeviceInfo = {
  os: string;
  browser: string;
  device: "mobile" | "tablet" | "desktop";
  inApp: string; // "Zalo" | "Facebook" | ... | "" nếu trình duyệt thường
};

export function parseUA(uaRaw: string): DeviceInfo {
  const ua = uaRaw || "";

  let inApp = "";
  if (/Zalo/i.test(ua)) inApp = "Zalo";
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) inApp = "Facebook";
  else if (/Instagram/i.test(ua)) inApp = "Instagram";
  else if (/Messenger/i.test(ua)) inApp = "Messenger";
  else if (/TikTok/i.test(ua)) inApp = "TikTok";
  else if (/MicroMessenger/i.test(ua)) inApp = "WeChat";

  let os = "Khác";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let device: DeviceInfo["device"] = "desktop";
  if (/iPad|Tablet/i.test(ua)) device = "tablet";
  else if (/Mobi|Android|iPhone|iPod/i.test(ua)) device = "mobile";

  let browser = "Khác";
  if (inApp) browser = inApp;
  else if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/CriOS/i.test(ua)) browser = "Chrome";
  else if (/FxiOS|Firefox/i.test(ua)) browser = "Firefox";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Version\/[\d.]+.*Safari/i.test(ua)) browser = "Safari";

  return { os, browser, device, inApp };
}
