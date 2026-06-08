import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { parseEmployees, DEFAULT_SHEET } from "@/lib/import-core.mjs";
import { saveEmployees } from "@/lib/store";
import { checkAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  if (!checkAdmin(req, String(form.get("password") || ""))) {
    return NextResponse.json({ error: "Sai mật khẩu quản trị" }, { status: 401 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Chưa chọn file Excel" }, { status: 400 });
  }
  const sheet = String(form.get("sheet") || DEFAULT_SHEET);

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const { employees, sheet: usedSheet, skippedInactive } = parseEmployees(XLSX, wb, { sheet });
    if (!employees.length) {
      return NextResponse.json({ error: "Không đọc được nhân sự nào từ file." }, { status: 400 });
    }
    saveEmployees(employees);
    return NextResponse.json({
      ok: true,
      count: employees.length,
      sheet: usedSheet,
      sheets: wb.SheetNames,
      skippedInactive,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Lỗi đọc file Excel" },
      { status: 400 }
    );
  }
}
