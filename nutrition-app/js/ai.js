/* Claude API client.
 * Two endpoints:
 *   POST /api/advice         { profile, targets, today, recent } -> { advice }
 *   POST /api/analyze-photo  { image: base64 } -> { items: [{name, qty, unit, kcal, p, f, c}] }
 *
 * If API not available (e.g. file:// or local dev without server), falls back to
 * rule-based template advice so the app stays useful.
 */

const API_BASE = (() => {
  // If app is hosted on Vercel etc, /api/ works. For local dev, allow override.
  return window.__AI_API_BASE__ || '';
})();

async function fetchAdvice({ profile, targets, today, recent7 }) {
  try {
    const res = await fetch(`${API_BASE}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, targets, today, recent7 })
    });
    if (!res.ok) throw new Error('api ' + res.status);
    const data = await res.json();
    return { source: 'ai', text: data.advice || '' };
  } catch (e) {
    return { source: 'rule', text: ruleAdvice({ profile, targets, today, recent7 }) };
  }
}

async function analyzePhoto(base64) {
  const res = await fetch(`${API_BASE}/api/analyze-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 })
  });
  if (!res.ok) throw new Error('photo analysis failed');
  return res.json();
}

/* ---- Rule-based fallback ---- */
function ruleAdvice({ profile, targets, today, recent7 }) {
  if (!profile || !targets) return 'プロフィールを設定するとアドバイスが表示されます。';
  const sum = today || { kcal: 0, p: 0, f: 0, c: 0 };
  const lines = [];
  const kcalGap = targets.kcal - sum.kcal;
  const pGap = targets.p - sum.p;
  const fGap = targets.f - sum.f;
  const cGap = targets.c - sum.c;

  const goal = targets.goal || '';
  lines.push(`【今日のサマリー】`);
  lines.push(`目標 ${targets.kcal} kcal に対し、現在 ${Math.round(sum.kcal)} kcal（残り ${kcalGap > 0 ? '+' : ''}${kcalGap} kcal）。`);
  lines.push('');

  // protein assessment
  if (pGap > 20) {
    lines.push(`*タンパク質が ${Math.round(pGap)}g 不足* しています。`);
    lines.push('→ 鶏むね肉100g（P 23g）、ギリシャヨーグルト100g（P 10g）、ホエイプロテイン1杯（P 22g）などで補いましょう。');
  } else if (pGap > 0) {
    lines.push(`タンパク質まであと ${Math.round(pGap)}g。間食でゆで卵やヨーグルトを加えるとちょうど良いです。`);
  } else {
    lines.push('タンパク質は目標を達成しています。');
  }
  lines.push('');

  // fat
  if (fGap < -10) {
    lines.push(`*脂質が目標を ${Math.abs(Math.round(fGap))}g オーバー* しています。揚げ物やマヨ・チーズを翌日は控えめに。`);
    lines.push('');
  }

  // carbs
  if (cGap > 50 && /バルク/.test(goal)) {
    lines.push(`バルクアップ目標として炭水化物が ${Math.round(cGap)}g 不足。ご飯1杯（53g）や和菓子で補給を。`);
    lines.push('');
  }
  if (cGap < -40 && /ダイエット/.test(goal)) {
    lines.push(`糖質を ${Math.abs(Math.round(cGap))}g オーバー。明日は主食を1食分減らすか、玄米に置き換えてみましょう。`);
    lines.push('');
  }

  // weekly trend
  if (recent7 && recent7.length >= 3) {
    const avg = recent7.reduce((a, b) => a + b.kcal, 0) / recent7.length;
    const diff = avg - targets.kcal;
    lines.push(`【週次トレンド】`);
    lines.push(`過去${recent7.length}日の平均は ${Math.round(avg)} kcal（目標との差 ${diff >= 0 ? '+' : ''}${Math.round(diff)} kcal/日）。`);
    if (/ダイエット/.test(goal) && diff > 100) {
      lines.push('減量ペースが鈍る可能性があります。間食や調味料の見直しがおすすめ。');
    } else if (/バルク/.test(goal) && diff < -100) {
      lines.push('増量に必要なカロリーが不足気味。1食あたり主食を10〜15%増やしてみましょう。');
    } else {
      lines.push('良いペースです。この調子を1〜2週間続けて体重変化を確認しましょう。');
    }
  }

  return lines.join('\n');
}

window.ai = { fetchAdvice, analyzePhoto };
