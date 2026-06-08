import { NextResponse } from "next/server";
import { findByCccd, daysWith, formatVN, formatDate } from "@/lib/employees";

export async function POST(req: Request) {
  let body: { cccd?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const cccd = (body.cccd || "").trim();
  if (!cccd) {
    return NextResponse.json({ error: "Vui lòng nhập số CCCD" }, { status: 400 });
  }

  const emp = findByCccd(cccd);
  if (!emp) {
    return NextResponse.json(
      { error: "Không tìm thấy nhân sự với số CCCD này" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    fullName: emp.fullName,
    title: emp.title,
    joinDateText: formatDate(emp.joinDate),
    rank: emp.rank,
    daysText: formatVN(daysWith(emp)),
    stats: emp.stats,
  });
}
