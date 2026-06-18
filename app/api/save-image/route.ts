import { NextResponse } from "next/server";
import { saveTempImage } from "@/lib/imagestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DECODED = 8 * 1024 * 1024; // chặn ảnh > 8MB (poster ~1MB JPEG)

// Nhận ảnh poster (data URL) → lưu tạm → trả id để tải qua /api/download/{id}.
// Công khai (nhân viên gọi); id ngẫu nhiên + file tự xoá cuốn chiếu.
export async function POST(req: Request) {
  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const m = (body.image || "").match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!m) return NextResponse.json({ error: "Ảnh không hợp lệ" }, { status: 400 });

  const ext = m[1] === "png" ? "png" : "jpg";
  const buf = Buffer.from(m[2], "base64");
  if (buf.length === 0 || buf.length > MAX_DECODED) {
    return NextResponse.json({ error: "Kích thước ảnh không hợp lệ" }, { status: 413 });
  }

  const id = saveTempImage(buf, ext);
  return NextResponse.json({ id });
}
