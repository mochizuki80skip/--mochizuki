// Vercel build 時に prisma db push を走らせるラッパー。
// 環境変数 RESET_DB=true なら --force-reset（破壊的）、それ以外は --accept-data-loss。
// Neon のスリープ復帰待ちで最初の接続が失敗する（P1001）ことがあるため、数回リトライする。
const { execSync } = require("node:child_process");

const reset = process.env.RESET_DB === "true";
const flag = reset ? "--force-reset" : "--accept-data-loss";
console.log(`[db-push] using ${flag}${reset ? " (DESTRUCTIVE)" : ""}`);

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const MAX_ATTEMPTS = 6;
const WAIT_MS = 5000;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  try {
    execSync(`npx prisma db push ${flag} --skip-generate`, { stdio: "inherit" });
    console.log(`[db-push] success on attempt ${attempt}`);
    process.exit(0);
  } catch {
    if (attempt === MAX_ATTEMPTS) {
      console.error(`[db-push] failed after ${MAX_ATTEMPTS} attempts (DBに到達できません / P1001)`);
      process.exit(1);
    }
    console.warn(
      `[db-push] attempt ${attempt} failed. ${WAIT_MS / 1000}s 待って再試行します（DBの起動待ちの可能性）...`,
    );
    sleepSync(WAIT_MS);
  }
}
