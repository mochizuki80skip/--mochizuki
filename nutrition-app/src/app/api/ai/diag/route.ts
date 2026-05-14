import { NextResponse } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * GET /api/ai/diag
 * 各 Gemini モデルに対して軽量なテキストリクエスト（画像なし）を投げ、
 * どのモデルが使えてどれが 429 でブロックされているか診断する。
 */
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      reason: 'GEMINI_API_KEY が Vercel に設定されていません'
    });
  }

  const keyPrefix = apiKey.slice(0, 8) + '...' + apiKey.slice(-4);

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  const results: Array<{ model: string; status: number; ok: boolean; message: string }> = [];

  for (const model of models) {
    try {
      const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say "ok"' }] }],
          generationConfig: { maxOutputTokens: 5 }
        })
      });
      const text = await res.text();
      results.push({
        model,
        status: res.status,
        ok: res.ok,
        message: text.slice(0, 200)
      });
    } catch (e: any) {
      results.push({
        model,
        status: 0,
        ok: false,
        message: e?.message || String(e)
      });
    }
  }

  return NextResponse.json({
    ok: true,
    keyPrefix,
    selectedModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    results
  });
}
