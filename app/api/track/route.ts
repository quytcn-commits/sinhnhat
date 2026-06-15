import { NextResponse } from "next/server";
import { findEmployee } from "@/lib/store";
import { logEvent, type EventAction } from "@/lib/events";
import { parseUA } from "@/lib/device";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set<EventAction>(["created", "download", "share"]);

// Ghi 1 sự kiện (công khai — nhân viên gọi). Chỉ ghi khi CCCD hợp lệ để tránh rác.
export async function POST(req: Request) {
  let body: { cccd?: string; action?: string; outcome?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const cccd = (body.cccd || "").trim();
  const action = String(body.action || "") as EventAction;
  if (!cccd || !ACTIONS.has(action)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const emp = findEmployee(cccd);
  if (!emp) return NextResponse.json({ ok: false }, { status: 404 });

  const dev = parseUA(req.headers.get("user-agent") || "");
  logEvent({
    t: new Date().toISOString(),
    cccd: emp.cccd,
    name: emp.fullName,
    khoi: emp.khoi ?? "",
    action,
    outcome: String(body.outcome || "click").slice(0, 24),
    ...dev,
  });

  return NextResponse.json({ ok: true });
}
