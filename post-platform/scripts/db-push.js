// Vercel build 時に prisma db push を走らせるラッパー。
// 環境変数 RESET_DB=true なら --force-reset（破壊的）、それ以外は --accept-data-loss。
const { execSync } = require("node:child_process");

const reset = process.env.RESET_DB === "true";
const flag = reset ? "--force-reset" : "--accept-data-loss";
console.log(`[db-push] using ${flag}${reset ? " (DESTRUCTIVE)" : ""}`);

execSync(`npx prisma db push ${flag} --skip-generate`, { stdio: "inherit" });
