export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "newway2026";

/** Kiểm tra mật khẩu admin: ưu tiên tham số (form), nếu không lấy header x-admin-password. */
export function checkAdmin(req: Request, formPw?: string): boolean {
  const pw = formPw ?? req.headers.get("x-admin-password") ?? "";
  return pw === ADMIN_PASSWORD;
}
