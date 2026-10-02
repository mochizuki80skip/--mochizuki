// ステップ配信の表示用ラベル（クライアント/サーバ共用）

export const TRIGGER_LABEL: Record<string, string> = {
  follow: "友だち追加",
  tag_added: "タグ付与",
};

export function formatMinutes(min: number): string {
  if (min <= 0) return "すぐ";
  if (min % 1440 === 0) return `${min / 1440}日`;
  if (min % 60 === 0) return `${min / 60}時間`;
  if (min > 1440) return `${Math.floor(min / 1440)}日${min % 1440 >= 60 ? `${Math.floor((min % 1440) / 60)}時間` : ""}`;
  return `${min}分`;
}

// 「前のステップから」の言い方
export function describeDelay(delayMinutes: number, sendTime?: string | null, isFirst = false, triggerLabel = "トリガー"): string {
  const base = isFirst ? triggerLabel : "前のメッセージ";
  if (sendTime) {
    const days = Math.floor(delayMinutes / 1440);
    return days === 0 ? `${base}と同じ日の ${sendTime}` : `${base}の ${days}日後の ${sendTime}`;
  }
  return delayMinutes <= 0 ? `${base}の直後` : `${base}の ${formatMinutes(delayMinutes)}後`;
}

// 各ステップの「トリガーからの累計」の目安
export function cumulativeLabels(steps: { delayMinutes: number; sendTime?: string | null }[]): string[] {
  let total = 0;
  return steps.map((s) => {
    total += s.delayMinutes;
    if (s.sendTime) {
      const days = Math.floor(total / 1440);
      return days === 0 ? `当日 ${s.sendTime}` : `${days}日後 ${s.sendTime}`;
    }
    return total <= 0 ? "すぐ" : `約${formatMinutes(total)}後`;
  });
}
