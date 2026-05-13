/* POST /api/analyze-photo
 * body: { image: "data:image/jpeg;base64,..." }
 * Returns: { items: [{ name, qty, unit, kcal, p, f, c }] }
 */

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb'
    }
  }
};

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
  const { image } = body || {};
  if (!image || !image.startsWith('data:image/')) {
    res.status(400).json({ error: 'image (base64 data URL) required' });
    return;
  }

  const m = image.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) {
    res.status(400).json({ error: 'invalid data URL' });
    return;
  }
  const mediaType = m[1];
  const data = m[2];

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
        max_tokens: 800,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: USER_PROMPT }
          ]
        }]
      })
    });
    if (!apiRes.ok) {
      const err = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, err);
      res.status(502).json({ error: 'upstream error', detail: err });
      return;
    }
    const data2 = await apiRes.json();
    const text = (data2.content || []).map((c) => c.text || '').join('').trim();
    const items = parseItems(text);
    res.status(200).json({ items, raw: text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'internal error' });
  }
}

const SYSTEM_PROMPT = `あなたは日本の食事写真を分析し、食品ごとの推定栄養価を返す管理栄養士のアシスタントです。
日本食品標準成分表2020を基礎知識として、写真に写る料理を識別し、現実的な量を推定します。
不確実な場合は無理に細分化せず、料理単位（例: 「親子丼1人前」）で返します。
飲み物・調味料・小皿も見えれば含めます。`;

const USER_PROMPT = `この食事写真に写っている食品を識別し、JSON形式で返してください。
出力は以下のJSON配列のみ（コードブロック・説明文なし）:

[
  { "name": "食品名（日本語）", "qty": 数量, "unit": "単位（例: 1杯、1切、100g）", "kcal": 数値, "p": タンパク質g, "f": 脂質g, "c": 炭水化物g }
]

ルール:
- 各値は数値。kcal は整数、p/f/c は小数1桁まで。
- 識別不能な場合は空配列 [] を返す。
- 最大8品目まで。`;

function parseItems(text) {
  if (!text) return [];
  // try direct
  const tryParse = (s) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  let parsed = tryParse(text);
  if (!parsed) {
    // try to extract first JSON array
    const m = text.match(/\[[\s\S]*?\]/);
    if (m) parsed = tryParse(m[0]);
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((x) => x && typeof x.name === 'string').map((x) => ({
    name: String(x.name).slice(0, 60),
    qty: Number(x.qty) || 1,
    unit: String(x.unit || '1人前').slice(0, 20),
    kcal: Math.max(0, Math.round(Number(x.kcal) || 0)),
    p: Math.max(0, +Number(x.p || 0).toFixed(1)),
    f: Math.max(0, +Number(x.f || 0).toFixed(1)),
    c: Math.max(0, +Number(x.c || 0).toFixed(1))
  })).slice(0, 8);
}
