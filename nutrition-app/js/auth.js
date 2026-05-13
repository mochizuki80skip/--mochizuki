/* Member / general mode. Members are identified by invite code or LINE user id. */

const MEMBER_CODES = ['ONES2026', 'ONESBODY', 'MOCHIZUKI']; // demo codes; replace via admin

async function getMode() {
  return (await db.kvGet('mode')) || 'guest';
}
async function setMode(mode) {
  return db.kvSet('mode', mode);
}

async function getMember() {
  return db.kvGet('member');
}

async function activateMember({ code, lineProfile }) {
  const ok = code && MEMBER_CODES.includes(code.trim().toUpperCase());
  if (!ok && !lineProfile) return { ok: false, error: '招待コードが無効です' };
  const member = {
    code: code ? code.trim().toUpperCase() : null,
    lineUserId: lineProfile?.userId || null,
    displayName: lineProfile?.displayName || null,
    pictureUrl: lineProfile?.pictureUrl || null,
    activatedAt: Date.now()
  };
  await db.kvSet('member', member);
  await db.kvSet('mode', 'member');
  return { ok: true, member };
}

async function deactivateMember() {
  await db.kvSet('member', null);
  await db.kvSet('mode', 'guest');
}

window.auth = { getMode, setMode, getMember, activateMember, deactivateMember };
