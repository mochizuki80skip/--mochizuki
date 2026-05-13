/* POST /api/advice
 * body: { profile, targets, today, recent7, weights?, mode }
 * Returns: { advice: string }
 */

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: 'invalid json' });
    return;
  }

  const { profile, targets, today, recent7, weights, mode } = body || {};
  if (!profile || !targets) {
    res.status(400).json({ error: 'profile and targets required' });
    return;
  }

  const prompt = buildPrompt({ profile, targets, today, recent7, weights, mode });

  try {
    const apiRes = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!apiRes.ok) {
      const err = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, err);
      res.status(502).json({ error: 'upstream error', detail: err });
      return;
    }
    const data = await apiRes.json();
    const text = (data.content || []).map((c) => c.text || '').join('').trim();
    res.status(200).json({ advice: text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal error' });
  }
}

const SYSTEM_PROMPT = `あなたはONE'S BODYパーソナルジム所属の管理栄養士兼トレーナーです。
利用者の食事ログと体組成データを分析し、目標達成に向けた具体的なアドバイスを行います。

ルール:
- 日本語で、親しみやすく簡潔に（300〜500字程度）。
- 数字は具体的に（例: 「タンパク質が20g不足」「鶏むね100gで補える」）。
- 強調したい部分は *〜* で囲む（後でアプリ側で強調表示します）。
- 改善点だけでなく、できている点も褒める。
- 危険な極端なアドバイスは避け、健康的な範囲を尊重する。
- 構造: 【今日のサマリー】→ 主要な改善点1〜2個 → 明日への具体的な提案。`;

function buildPrompt({ profile, targets, today, recent7, weights, mode }) {
  const goalLabel = targets.goal;
  const lines = [];
  lines.push(`# ユーザープロフィール`);
  lines.push(`- 性別: ${profile.sex === 'male' ? '男性' : '女性'}`);
  lines.push(`- 年齢: ${profile.age}歳, 身長: ${profile.height}cm, 体重: ${profile.weight}kg`);
  lines.push(`- 目標体重: ${profile.targetWeight}kg`);
  lines.push(`- 活動量: ${({ low: '低', mid: '中', high: '高' })[profile.activity]}`);
  lines.push(`- 目標: ${goalLabel}`);
  lines.push('');
  lines.push(`# 目標設定`);
  lines.push(`- カロリー: ${targets.kcal} kcal/日`);
  lines.push(`- タンパク質: ${targets.p}g`);
  lines.push(`- 脂質: ${targets.f}g`);
  lines.push(`- 炭水化物: ${targets.c}g`);
  lines.push('');
  lines.push(`# 本日の摂取`);
  lines.push(`- カロリー: ${Math.round(today?.kcal || 0)} kcal`);
  lines.push(`- P: ${(today?.p || 0).toFixed(1)}g / F: ${(today?.f || 0).toFixed(1)}g / C: ${(today?.c || 0).toFixed(1)}g`);
  lines.push('');
  if (recent7 && recent7.length) {
    lines.push(`# 直近の食事傾向（${recent7.length}日分）`);
    recent7.forEach((d) => lines.push(`- ${d.date}: ${Math.round(d.kcal)} kcal (P${(d.p || 0).toFixed(0)}/F${(d.f || 0).toFixed(0)}/C${(d.c || 0).toFixed(0)})`));
    lines.push('');
  }
  if (weights && weights.length) {
    lines.push(`# 体重推移（直近）`);
    weights.forEach((w) => lines.push(`- ${w.date}: ${w.weight}kg${w.bodyFat ? ` (体脂肪${w.bodyFat}%)` : ''}`));
    lines.push('');
  }

  if (mode === 'weekly') {
    lines.push(`# 依頼`);
    lines.push(`過去1週間の傾向を踏まえて、週次レポートを作成してください。良かった点・改善点・来週のアクションを具体的に。`);
  } else {
    lines.push(`# 依頼`);
    lines.push(`本日の食事内容を踏まえて、今日の残り食事および明日の食事に向けたアドバイスをください。`);
  }

  return lines.join('\n');
}
