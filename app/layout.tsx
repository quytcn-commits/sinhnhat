import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-bvp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NewWay Realty — Poster Tri Ân Đồng Hành",
  description: "Tạo poster cảm ơn hành trình đồng hành cùng NewWay Realty",
};

// Khóa zoom trên iOS / in-app browser (Zalo, FB...): các webview này hay bị
// "kẹt" ở trạng thái phóng to (auto-zoom khi focus input, hoặc pinch) khiến
// lớp position:fixed (save-modal) hiện ra LỆCH + PHÓNG TO. maximumScale=1 +
// userScalable=false giữ trang luôn ở scale 1. viewportFit=cover để không bị
// tai thỏ che (dùng cùng safe-area-inset).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={beVietnam.variable}>
      <body>{children}</body>
    </html>
  );
}
