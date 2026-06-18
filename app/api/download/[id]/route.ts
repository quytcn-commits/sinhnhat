import { NextResponse } from "next/server";
import { readTempImage } from "@/lib/imagestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phát ảnh kèm Content-Disposition: attachment → iOS/Zalo tải THẲNG vào máy
// (không cần mở Safari). Đây là điểm mấu chốt: phải là URL HTTP thật, không phải
// blob/data URL (vốn bị iOS/Zalo chặn tải).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const f = readTempImage(id);
  if (!f) return new NextResponse("Ảnh đã hết hạn hoặc không tồn tại", { status: 404 });

  const url = new URL(req.url);
  let name = (url.searchParams.get("name") || "poster-newway").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!/\.(png|jpe?g)$/i.test(name)) name += f.ext === "png" ? ".png" : ".jpg";

  return new NextResponse(new Uint8Array(f.buf), {
    headers: {
      "Content-Type": f.ext === "png" ? "image/png" : "image/jpeg",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(f.buf.length),
      "Cache-Control": "no-store",
    },
  });
}
