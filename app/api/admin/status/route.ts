import { NextResponse } from "next/server";
import { dataStatus } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(dataStatus());
}
