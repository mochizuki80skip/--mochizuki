/* LINE LIFF integration — works as a no-op when LIFF SDK not loaded. */

async function initLiff(liffId) {
  if (!liffId || typeof liff === 'undefined') return { ok: false, reason: 'no-sdk' };
  try {
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) {
      return { ok: true, loggedIn: false };
    }
    const profile = await liff.getProfile();
    return { ok: true, loggedIn: true, profile };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function isInLineClient() {
  return typeof liff !== 'undefined' && liff.isInClient && liff.isInClient();
}

window.liffHelper = { initLiff, isInLineClient };
