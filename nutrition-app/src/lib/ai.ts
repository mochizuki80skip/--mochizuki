// Gemini API クライアント — サーバーサイド
import type { Targets } from './nutrition';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// モデルは環境変数で上書き可能。デフォルトは最新の 2.5 Flash（Vision対応・無料枠リフレッシュ）
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
// 429時にフォールバックするモデル群（独立したクォータを持つ）
// 1.5系は v1beta で 404 になるため削除、2.x系のみ
const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return ruleAdvice(payload);

  try {
    const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: buildPrompt(payload) }] }],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.7
        }
      })
    });
    if (!res.ok) {
      console.error('Gemini API failed:', res.status, await res.text().catch(() => ''));
      return ruleAdvice(payload);
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('').trim();
    return text || ruleAdvice(payload);
  } catch (e) {
    console.error('Gemini error:', e);
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

/* ---- テキストから食品栄養を推定 ---- */

export interface FoodTextResult {
  name: string;
  unitDesc: string;   // 例: "1個(177g)", "茶碗1杯(150g)", "100g"
  unitG: number;      // 1単位のグラム数
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface FoodTextAnalysisResult {
  food?: FoodTextResult;
  diagnostic?: { stage: string; detail: string };
}

const FOODTEXT_SYSTEM = `あなたは日本の食品栄養データベースです。
ユーザーが入力した食品名から「最も一般的な1個分・1食分」の栄養値を返します。
- 標準的なポーションサイズを採用（コンビニ商品はパッケージ実値、家庭料理は一般的な1人前）
- 日本食品標準成分表・市販商品の公表値を参考に
- 単位は自然な日本語で（1個/1食/1杯/100g/1本など）
- 必ず JSON 単一オブジェクトのみで返す（配列・コードブロック・前置き禁止）`;

const FOODTEXT_USER = (name: string) => `食品名: "${name}"

以下のJSON形式で返してください:
{ "name": "正式な食品名", "unitDesc": "1個(177g) など", "unitG": 数値, "kcal": 整数, "protein": 小数1桁, "fat": 小数1桁, "carbs": 小数1桁 }

例:
入力: "ごつ盛りのカップ焼きそば"
出力: {"name":"日清ごつ盛りソース焼そば","unitDesc":"1個(177g)","unitG":177,"kcal":672,"protein":13.5,"fat":29.6,"carbs":86.0}

入力: "鶏むね肉100g"
出力: {"name":"鶏むね肉(皮なし)","unitDesc":"100g","unitG":100,"kcal":108,"protein":22.3,"fat":1.5,"carbs":0}

入力: "ハンバーグ"
出力: {"name":"ハンバーグ","unitDesc":"1個(150g)","unitG":150,"kcal":350,"protein":18.0,"fat":22.0,"carbs":18.0}

該当食品が思い当たらない場合は { "name": "", "unitDesc": "", "unitG": 0, "kcal": 0, "protein": 0, "fat": 0, "carbs": 0 } を返してください。`;

export async function analyzeFoodText(input: string): Promise<FoodTextAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { diagnostic: { stage: 'no_key', detail: 'サーバーに GEMINI_API_KEY が設定されていません。' } };
  }
  const name = (input || '').trim().slice(0, 100);
  if (!name) {
    return { diagnostic: { stage: 'empty', detail: '食品名を入力してください。' } };
  }

  const modelsToTry = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
  const attempts: Array<{ model: string; status: number; snippet: string }> = [];

  for (const model of modelsToTry) {
    try {
      const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: FOODTEXT_SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: FOODTEXT_USER(name) }] }],
          generationConfig: {
            maxOutputTokens: 300,
            temperature: 0.3,
            responseMimeType: 'application/json'
          }
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        attempts.push({ model, status: res.status, snippet: errText.slice(0, 100) });
        if (res.status === 429 || res.status === 503) continue;
        return {
          diagnostic: {
            stage: 'api_http',
            detail: `Gemini APIエラー (${res.status}) [model=${model}]: ${errText.slice(0, 200)}`
          }
        };
      }
      const result = await res.json();
      const text = result.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('').trim();
      if (!text) {
        return { diagnostic: { stage: 'parse_empty', detail: 'AIが空の応答を返しました。' } };
      }
      // 余分なコードブロック削除
      const cleaned = text.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      let parsed: any;
      try { parsed = JSON.parse(cleaned); } catch {
        return { diagnostic: { stage: 'parse_fail', detail: `JSON解析失敗: ${cleaned.slice(0, 150)}` } };
      }
      if (!parsed?.name || !parsed?.kcal) {
        return { diagnostic: { stage: 'not_found', detail: `「${name}」に該当する食品データが見つかりませんでした。別の表現で試してください。` } };
      }
      return {
        food: {
          name: String(parsed.name),
          unitDesc: String(parsed.unitDesc || '1食'),
          unitG: Number(parsed.unitG) || 100,
          kcal: Math.round(Number(parsed.kcal) || 0),
          protein: +(Number(parsed.protein) || 0).toFixed(1),
          fat: +(Number(parsed.fat) || 0).toFixed(1),
          carbs: +(Number(parsed.carbs) || 0).toFixed(1)
        }
      };
    } catch (e: any) {
      attempts.push({ model, status: 0, snippet: e?.message || String(e) });
    }
  }

  return {
    diagnostic: {
      stage: 'api_http',
      detail: `全モデル(${attempts.length}個)で失敗。クォータ超過の可能性が高いです。`
    }
  };
}

export interface PhotoAnalysisResult {
  items: PhotoItem[];
  diagnostic?: {
    stage: 'no_key' | 'bad_image' | 'api_http' | 'api_exception' | 'parse_empty' | 'parse_fail';
    detail: string;
  };
}

export async function analyzePhoto(imageBase64: string): Promise<PhotoAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      items: [],
      diagnostic: { stage: 'no_key', detail: 'サーバーに GEMINI_API_KEY が設定されていません。Vercelの環境変数を確認してください。' }
    };
  }

  const m = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!m) {
    return {
      items: [],
      diagnostic: { stage: 'bad_image', detail: '画像データの形式が正しくありません（data URL ではありません）。' }
    };
  }
  const mimeType = m[1];
  const data = m[2];

  // モデルを順に試行（429時は別モデルにフォールバック）
  const modelsToTry = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
  const attempts: Array<{ model: string; status: number; snippet: string }> = [];

  for (const model of modelsToTry) {
    try {
      const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: PHOTO_SYSTEM }] },
          contents: [{
            role: 'user',
            parts: [
              { inline_data: { mime_type: mimeType, data } },
              { text: PHOTO_USER }
            ]
          }],
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.4,
            responseMimeType: 'application/json'
          }
        })
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`Gemini ${model} failed:`, res.status, errText);
        attempts.push({ model, status: res.status, snippet: errText.slice(0, 150) });
        // 429（クォータ）/ 503（過負荷）は次のモデルへフォールバック
        if (res.status === 429 || res.status === 503) continue;
        // それ以外は即座に終了（404モデル不在など）
        return {
          items: [],
          diagnostic: {
            stage: 'api_http',
            detail: `Gemini APIエラー (${res.status}) [model=${model}]: ${errText.slice(0, 200)}`
          }
        };
      }
      const result = await res.json();
      const text = result.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('').trim();
      if (!text) {
        return {
          items: [],
          diagnostic: { stage: 'parse_empty', detail: `AIが空の応答を返しました [model=${model}]。画像が認識できなかった可能性があります。` }
        };
      }
      const items = parseItems(text);
      if (items.length === 0) {
        return {
          items: [],
          diagnostic: { stage: 'parse_fail', detail: `AIの応答を解析できませんでした [model=${model}]: ${text.slice(0, 150)}` }
        };
      }
      return { items };
    } catch (e: any) {
      console.error(`photo analysis error [${model}]:`, e);
      attempts.push({ model, status: 0, snippet: e?.message || String(e) });
    }
  }

  // 全モデルが失敗
  const attemptSummary = attempts.map((a) => `${a.model}: ${a.status} ${a.snippet}`).join(' | ');
  return {
    items: [],
    diagnostic: {
      stage: 'api_http',
      detail: `全モデル(${attempts.length}個)で失敗。クォータ超過の可能性が高いです。Google AI Studio で別プロジェクトを作るか、Billingを有効化してください。\n試行: ${attemptSummary.slice(0, 300)}`
    }
  };
}

/* ---- 目標プラン生成 ---- */

export interface PlanAiInput {
  profile: {
    sex: 'male' | 'female';
    age: number;
    heightCm: number;
    weightKg: number;
    targetWeight: number;
    activity: 'low' | 'mid' | 'high';
  };
  goalType: 'diet' | 'bulk' | 'bodymake' | 'log';
  deadline: string; // YYYY-MM-DD
  daysAhead: number;
  basePlan: {
    kcal: number;
    protein: number;
    fat: number;
    carbs: number;
    weeklyKg: number;
  };
}

export interface PlanAiOutput {
  summary: string;         // 4〜6行の人間向け要旨（**強調**OK）
  recommendedFoods: string[];
  recommendedFreq: string;
  tips: string[];
}

const PLAN_SYSTEM = `あなたはONE'S BODYパーソナルジムの管理栄養士兼トレーナーです。
利用者の身体情報と目標から、実行可能で前向きな計画コメントを返します。
ルール:
- JSONのみで返す（コードブロック・前置き禁止）
- summary: 4〜6行、強調は **〜**、励まし口調
- 数値は基本計画値をそのまま採用する（書き換え禁止）
- recommendedFoods: 5項目程度の食品名
- tips: 3〜5項目、具体的行動指示
- recommendedFreq: 「週X回のXトレーニング」`;

function buildPlanPrompt(p: PlanAiInput): string {
  return [
    `# 利用者`,
    `- ${p.profile.sex === 'male' ? '男性' : '女性'} / ${p.profile.age}歳 / ${p.profile.heightCm}cm / ${p.profile.weightKg}kg`,
    `- 目標体重: ${p.profile.targetWeight}kg`,
    `- 活動量: ${({ low: '低', mid: '中', high: '高' })[p.profile.activity]}`,
    ``,
    `# 目標`,
    `- タイプ: ${({ diet: 'ダイエット', bulk: 'バルクアップ', bodymake: '体型維持', log: '記録のみ' })[p.goalType]}`,
    `- 期限: ${p.deadline}（あと${p.daysAhead}日）`,
    ``,
    `# 基本計画値（採用必須）`,
    `- 1日 ${p.basePlan.kcal}kcal / P${p.basePlan.protein}g / F${p.basePlan.fat}g / C${p.basePlan.carbs}g`,
    `- 週次ペース: ${p.basePlan.weeklyKg >= 0 ? '+' : ''}${p.basePlan.weeklyKg}kg/週`,
    ``,
    `# 出力フォーマット (JSON配列以外NG)`,
    `{`,
    `  "summary": "短い励まし+計画概要",`,
    `  "recommendedFoods": ["食品名", ...],`,
    `  "recommendedFreq": "週X回の...",`,
    `  "tips": ["行動1", "行動2", ...]`,
    `}`
  ].join('\n');
}

export async function generatePlan(input: PlanAiInput): Promise<PlanAiOutput | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: PLAN_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: buildPlanPrompt(input) }] }],
        generationConfig: {
          maxOutputTokens: 800,
          temperature: 0.7,
          responseMimeType: 'application/json'
        }
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('').trim();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return {
        summary: String(parsed.summary || '').slice(0, 800),
        recommendedFoods: Array.isArray(parsed.recommendedFoods) ? parsed.recommendedFoods.slice(0, 8).map(String) : [],
        recommendedFreq: String(parsed.recommendedFreq || '').slice(0, 80),
        tips: Array.isArray(parsed.tips) ? parsed.tips.slice(0, 6).map(String) : []
      };
    } catch {
      return null;
    }
  } catch (e) {
    console.error('plan AI error:', e);
    return null;
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
