// Claude API クライアント — サーバーサイド
import type { Targets } from './nutrition';

const MODEL = 'claude-sonnet-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';

interface AdvicePayload {
  profile: {
    sex: string | null;
    age: number | null;
    heightCm: number | null;
    weightKg: number | null;
    targetWeight: number | null;
    activity: string | null;
    goal: string | null;
    isMember: boolean;
  };
  targets: Targets;
  today: { kcal: number; protein: number; fat: number; carbs: number };
  recent7?: Array<{ date: string; kcal: number; protein: number; fat: number; carbs: number }>;
  weights?: Array<{ date: string; weight: number; bodyFat: number | null }>;
  mode?: 'daily' | 'weekly';
}

const SYSTEM_PROMPT = `あなたはONE'S BODYパーソナルジムの管理栄養士兼トレーナーです。
利用者の食事ログと体組成データを分析し、目標達成に向けた具体的なアドバイスを提供します。

ルール:
- 日本語で、親しみやすく簡潔に（300〜500字）。
- 数値は具体的に（例: 「タンパク質が20g不足」「鶏むね100gで補える」）。
- 強調したい部分は **〜** で囲む。
- できている点を褒めつつ、改善点を1〜2個に絞る。
- 構造: 【今日のサマリー】→ 主要な改善点 → 具体的な提案。`;

function buildPrompt(p: AdvicePayload): string {
  const { profile, targets, today, recent7, weights, mode = 'daily' } = p;
  const lines: string[] = [];
  lines.push('# プロフィール');
  lines.push(`- ${profile.sex === 'male' ? '男性' : '女性'} / ${profile.age}歳 / ${profile.heightCm}cm / ${profile.weightKg}kg → 目標 ${profile.targetWeight}kg`);
  lines.push(`- 活動量: ${({ low: '低', mid: '中', high: '高' })[profile.activity || 'mid']}`);
  lines.push(`- 目標: ${targets.goalLabel}${profile.isMember ? '（ONE\'S BODY 会員）' : ''}`);
  lines.push('');
  lines.push('# 目標値');
  lines.push(`- ${targets.kcal} kcal / P${targets.protein}g / F${targets.fat}g / C${targets.carbs}g`);
  lines.push('');
  lines.push('# 本日の摂取');
  lines.push(`- ${Math.round(today.kcal)} kcal / P${today.protein.toFixed(1)}g / F${today.fat.toFixed(1)}g / C${today.carbs.toFixed(1)}g`);
  lines.push('');
  if (recent7?.length) {
    lines.push(`# 直近${recent7.length}日の傾向`);
    for (const d of recent7) lines.push(`- ${d.date}: ${Math.round(d.kcal)}kcal P${d.protein.toFixed(0)} F${d.fat.toFixed(0)} C${d.carbs.toFixed(0)}`);
    lines.push('');
  }
  if (weights?.length) {
    lines.push('# 体重推移');
    for (const w of weights) lines.push(`- ${w.date}: ${w.weight}kg${w.bodyFat ? ` (体脂肪${w.bodyFat}%)` : ''}`);
    lines.push('');
  }
  lines.push('# 依頼');
  lines.push(mode === 'weekly'
    ? '過去1週間を踏まえた週次レポートを。良かった点・改善点・来週のアクションを具体的に。'
    : '本日の食事を踏まえ、夕食以降と明日の食事に向けたアドバイスを。');
  return lines.join('\n');
}

export async function generateAdvice(payload: AdvicePayload): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return ruleAdvice(payload);

  try {
    const res = await fetch(API_URL, {
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
        messages: [{ role: 'user', content: buildPrompt(payload) }]
      })
    });
    if (!res.ok) {
      console.error('Claude API failed:', res.status);
      return ruleAdvice(payload);
    }
    const data = await res.json();
    const text = (data.content || []).map((c: any) => c.text || '').join('').trim();
    return text || ruleAdvice(payload);
  } catch (e) {
    console.error('Claude error:', e);
    return ruleAdvice(payload);
  }
}

function ruleAdvice({ targets, today }: AdvicePayload): string {
  const lines: string[] = [];
  const kcalGap = targets.kcal - today.kcal;
  const pGap = targets.protein - today.protein;
  lines.push('【今日のサマリー】');
  lines.push(`目標 ${targets.kcal} kcal に対し、現在 ${Math.round(today.kcal)} kcal（残り ${kcalGap > 0 ? '+' : ''}${kcalGap} kcal）。`);
  lines.push('');
  if (pGap > 20) {
    lines.push(`**タンパク質が ${Math.round(pGap)}g 不足** しています。`);
    lines.push('→ 鶏むね100g（P 23g）、ギリシャヨーグルト100g（P 10g）、プロテイン1杯（P 22g）で補えます。');
  } else if (pGap > 0) {
    lines.push(`タンパク質まであと ${Math.round(pGap)}g。間食でゆで卵やヨーグルトを。`);
  } else {
    lines.push('タンパク質は目標達成。');
  }
  return lines.join('\n');
}

// ---- Vision: 写真から食品認識 ----

export interface PhotoItem {
  name: string;
  qty: number;
  unit: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

const PHOTO_SYSTEM = `あなたは日本の食事写真を分析し、食品ごとの推定栄養価を返す管理栄養士のアシスタントです。
日本食品標準成分表を基礎知識として、写真の料理を識別し現実的な量を推定します。
不確実な場合は料理単位で返します（例: 親子丼1人前）。`;

const PHOTO_USER = `この食事写真の食品を識別し、以下のJSON配列のみで返してください（コードブロック・説明文なし）:
[{ "name": "食品名", "qty": 数量, "unit": "単位", "kcal": 整数, "protein": 小数1桁g, "fat": g, "carbs": g }]
最大8品目。識別不能なら []。`;

export async function analyzePhoto(imageBase64: string): Promise<PhotoItem[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const m = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) return [];
  const mediaType = m[1];
  const data = m[2];

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        system: PHOTO_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
            { type: 'text', text: PHOTO_USER }
          ]
        }]
      })
    });
    if (!res.ok) return [];
    const result = await res.json();
    const text = (result.content || []).map((c: any) => c.text || '').join('').trim();
    return parseItems(text);
  } catch (e) {
    console.error('photo analysis error:', e);
    return [];
  }
}

function parseItems(text: string): PhotoItem[] {
  if (!text) return [];
  let parsed: any = null;
  try { parsed = JSON.parse(text); } catch {
    const mat = text.match(/\[[\s\S]*?\]/);
    if (mat) try { parsed = JSON.parse(mat[0]); } catch {}
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((x: any) => x && typeof x.name === 'string')
    .map((x: any) => ({
      name: String(x.name).slice(0, 60),
      qty: Number(x.qty) || 1,
      unit: String(x.unit || '1人前').slice(0, 20),
      kcal: Math.max(0, Math.round(Number(x.kcal) || 0)),
      protein: Math.max(0, +Number(x.protein || x.p || 0).toFixed(1)),
      fat: Math.max(0, +Number(x.fat || x.f || 0).toFixed(1)),
      carbs: Math.max(0, +Number(x.carbs || x.c || 0).toFixed(1))
    }))
    .slice(0, 8);
}
