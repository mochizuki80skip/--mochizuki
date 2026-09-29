// Instagram Graph API（Instagram ログインの API）でのフィード投稿
// 事前に各店舗の Instagram をプロアカウント（ビジネス / クリエイター）にし、
// Meta for Developers のアプリで発行した長期アクセストークンを店舗設定に登録しておく。
const base = () => `https://graph.instagram.com/${process.env.IG_GRAPH_VERSION ?? "v23.0"}`;

async function igFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(`Instagram API ${res.status}: ${json.error?.message ?? "unknown"}`);
  return json as T;
}

export async function publishImage(igUserId: string, token: string, imageUrl: string, caption: string) {
  const form = (o: Record<string, string>) => new URLSearchParams({ ...o, access_token: token });

  // 1) メディアコンテナ作成
  const c = await igFetch<{ id: string }>(`${base()}/${igUserId}/media`, {
    method: "POST",
    body: form({ image_url: imageUrl, caption }),
  });

  // 2) 画像の取り込み完了を待つ（通常は数秒）
  for (let i = 0; i < 5; i++) {
    const s = await igFetch<{ status_code?: string }>(
      `${base()}/${c.id}?fields=status_code&access_token=${encodeURIComponent(token)}`,
    );
    if (s.status_code === "FINISHED") break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`Instagram 画像の取り込みに失敗（${s.status_code}）`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 3) 公開
  const p = await igFetch<{ id: string }>(`${base()}/${igUserId}/media_publish`, {
    method: "POST",
    body: form({ creation_id: c.id }),
  });
  return p.id;
}

// 長期トークン（60 日）の延長
export async function refreshToken(token: string) {
  const r = await igFetch<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
  );
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000) };
}
