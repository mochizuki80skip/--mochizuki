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

export async function verifyLineIdToken(idToken: string, channelId?: string): Promise<LineIdTokenPayload | null> {
  const cid = channelId || process.env.LINE_LOGIN_CHANNEL_ID || process.env.NEXT_PUBLIC_LIFF_CHANNEL_ID;
  if (!cid) {
    console.error('LINE_LOGIN_CHANNEL_ID not configured');
    return null;
  }
  try {
    const res = await fetch(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: cid })
    });
    if (!res.ok) {
      console.error('LINE verify failed:', res.status, await res.text());
      return null;
    }
    return (await res.json()) as LineIdTokenPayload;
  } catch (e) {
    console.error('LINE verify error:', e);
    return null;
  }
}
