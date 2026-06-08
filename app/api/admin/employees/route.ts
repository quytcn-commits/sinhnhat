import { NextResponse } from "next/server";
import { checkAdmin } from "@/lib/auth";
import { listEmployees, updateEmployee, deleteEmployee } from "@/lib/store";
import type { Employee } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Sai mật khẩu quản trị" }, { status: 401 });
}

// GET: danh sách + tìm kiếm + phân trang
export async function GET(req: Request) {
  if (!checkAdmin(req)) return unauthorized();
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1", 10) || 1;
  const size = Math.min(100, parseInt(url.searchParams.get("size") || "20", 10) || 20);
  return NextResponse.json(listEmployees(q, page, size));
}

// PUT: cập nhật 1 nhân sự (sửa thông tin sai)
export async function PUT(req: Request) {
  if (!checkAdmin(req)) return unauthorized();
  let body: { cccd?: string; patch?: Partial<Employee> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  if (!body.cccd || !body.patch) {
    return NextResponse.json({ error: "Thiếu cccd hoặc dữ liệu sửa" }, { status: 400 });
  }
  const updated = updateEmployee(body.cccd, body.patch);
  if (!updated) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
  return NextResponse.json({ ok: true, employee: updated });
}

// DELETE: xoá 1 nhân sự (?cccd=...)
export async function DELETE(req: Request) {
  if (!checkAdmin(req)) return unauthorized();
  const cccd = new URL(req.url).searchParams.get("cccd") || "";
  if (!cccd) return NextResponse.json({ error: "Thiếu cccd" }, { status: 400 });
  const ok = deleteEmployee(cccd);
  if (!ok) return NextResponse.json({ error: "Không tìm thấy nhân sự" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
