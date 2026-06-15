import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { queryEvents, eventsToCsv, type QueryOpts } from "@/lib/events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Sai mật khẩu quản trị" }, { status: 401 });
  }
  const url = new URL(req.url);
  const opts: QueryOpts = {
    q: url.searchParams.get("q") || "",
    action: url.searchParams.get("action") || "",
    from: url.searchParams.get("from") || "",
    to: url.searchParams.get("to") || "",
    page: parseInt(url.searchParams.get("page") || "1", 10) || 1,
    size: Math.min(100, parseInt(url.searchParams.get("size") || "30", 10) || 30),
  };

  if (url.searchParams.get("export") === "csv") {
    const csv = eventsToCsv(opts);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="su-kien-sinh-nhat.csv"',
      },
    });
  }

  return NextResponse.json(queryEvents(opts));
}
