// LINE ID トークン検証 — サーバーサイド

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

export interface LineIdTokenPayload {
  iss: string;
  sub: string; // LINE userId
  aud: string;
  exp: number;
  iat: number;
  name?: string;
  picture?: string;
  email?: string;
}

export interface VerifyResult {
  ok: true;
  payload: LineIdTokenPayload;
}
export interface VerifyError {
  ok: false;
  reason: 'no_channel_id' | 'verify_failed';
  detail?: string;
  status?: number;
}

/** LIFF ID 形式（例: 1234567890-aBcDeFgH）の場合は channel ID 部分を抽出 */
function normalizeChannelId(raw: string): string {
  return raw.split('-')[0].trim();
}

export async function verifyLineIdTokenDetailed(idToken: string, channelId?: string): Promise<VerifyResult | VerifyError> {
  const rawCid = channelId || process.env.LINE_LOGIN_CHANNEL_ID || process.env.NEXT_PUBLIC_LIFF_ID || '';
  if (!rawCid) {
    return { ok: false, reason: 'no_channel_id', detail: 'LINE_LOGIN_CHANNEL_ID 環境変数が未設定' };
  }
  const cid = normalizeChannelId(rawCid);
  try {
    const res = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: cid })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('LINE verify failed:', res.status, detail);
      return { ok: false, reason: 'verify_failed', status: res.status, detail };
    }
    return { ok: true, payload: (await res.json()) as LineIdTokenPayload };
  } catch (e: any) {
    console.error('LINE verify error:', e);
    return { ok: false, reason: 'verify_failed', detail: e?.message || String(e) };
  }
}

export async function verifyLineIdToken(idToken: string, channelId?: string): Promise<LineIdTokenPayload | null> {
  const result = await verifyLineIdTokenDetailed(idToken, channelId);
  return result.ok ? result.payload : null;
}
