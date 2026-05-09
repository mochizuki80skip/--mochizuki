export { default } from "next-auth/middleware";

export const config = {
  // /api/line/webhook と /api/auth, /login 以外は要認証
  matcher: ["/((?!api/line/webhook|api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
