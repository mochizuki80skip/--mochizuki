export { default } from "next-auth/middleware";

export const config = {
  // /api/cron と /api/auth, /login 以外は要ログイン
  matcher: ["/((?!api/cron|api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
