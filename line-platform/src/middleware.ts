export { default } from "next-auth/middleware";

export const config = {
  // 認証を要求しないパス: LINE Webhook / Cron / 認証API / ログイン / LIFF / 公開API
  matcher: [
    "/((?!api/line/webhook|api/cron|api/auth|api/public|login|liff|_next/static|_next/image|favicon.ico).*)",
  ],
};
