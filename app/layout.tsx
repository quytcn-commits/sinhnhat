import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NewWay Realty — Poster Tri Ân Đồng Hành",
  description: "Tạo poster cảm ơn hành trình đồng hành cùng NewWay Realty",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
