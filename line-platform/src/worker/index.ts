// 配信ワーカー: 30 秒間隔で予約配信とシナリオステップを処理
import "dotenv/config";
import { dispatchDueScenarioSteps } from "@/lib/scenario";
import { dispatchScheduledBroadcasts } from "@/lib/broadcast";

const INTERVAL_MS = 30_000;

async function tick() {
  try {
    const [scenarios, broadcasts] = await Promise.all([
      dispatchDueScenarioSteps(),
      dispatchScheduledBroadcasts(),
    ]);
    if (scenarios > 0 || broadcasts > 0) {
      console.log(`[worker] tick: scenarios=${scenarios} broadcasts=${broadcasts}`);
    }
  } catch (e) {
    console.error("[worker] tick error:", e);
  }
}

console.log("[worker] started, interval =", INTERVAL_MS, "ms");
void tick();
setInterval(tick, INTERVAL_MS);
