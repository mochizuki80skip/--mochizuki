const $ = (id) => document.getElementById(id);
const DEFAULT_URL = "https://business.google.com/locations";

let settings = {};
let imageData = null; // { name, type, dataUrl }

// ---------- タブ ----------
document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button, .tab").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    $(`tab-${b.dataset.tab}`).classList.add("active");
    if (b.dataset.tab === "drafts") renderDrafts();
  }),
);

// ---------- 設定 ----------
const SETTING_FIELDS = { name: "s-name", area: "s-area", features: "s-features", footer: "s-footer", url: "s-url", apiKey: "s-key", model: "s-model", ng: "s-ng" };

async function loadSettings() {
  settings = (await chrome.storage.local.get("settings")).settings || {};
  for (const [k, id] of Object.entries(SETTING_FIELDS)) $(id).value = settings[k] || "";
}

$("btn-settings").addEventListener("click", async () => {
  for (const [k, id] of Object.entries(SETTING_FIELDS)) settings[k] = $(id).value.trim();
  await chrome.storage.local.set({ settings });
  $("settings-status").textContent = "保存しました";
  setTimeout(() => ($("settings-status").textContent = ""), 2000);
  updateChecks();
});

const ngWords = () => (settings.ng || "").split("\n").map((s) => s.trim()).filter(Boolean);

// ---------- 作成 ----------
for (const t of THEMES) $("theme").append(new Option(t.label, t.id));
$("planned").value = new Date().toISOString().slice(0, 10);

function setStatus(msg, ok = true) {
  $("status").textContent = msg;
  $("status").className = ok ? "ok" : "ng";
}

function updateChecks() {
  const text = $("body").value;
  $("count").textContent = `${text.length} / ${GBP_MAX} 文字`;
  const found = checkPost(text, ngWords());
  $("warnings").replaceChildren(
    ...found.map((f) => {
      const d = document.createElement("div");
      d.className = `item ${f.level}`;
      d.textContent = (f.level === "error" ? "要修正：" : "注意：") + f.msg;
      return d;
    }),
  );
  return found;
}
$("body").addEventListener("input", updateChecks);

$("btn-template").addEventListener("click", () => {
  $("body").value = buildTemplate($("theme").value, $("memo").value.trim(), settings, plannedDate());
  updateChecks();
});

function plannedDate() {
  const v = $("planned").value;
  return v ? new Date(`${v}T00:00:00`) : new Date();
}

$("btn-ai").addEventListener("click", async () => {
  if (!settings.apiKey) {
    setStatus("設定タブで Gemini API キーを登録してください", false);
    return;
  }
  const btn = $("btn-ai");
  btn.disabled = true;
  setStatus("AI で作成中…");
  try {
    const model = settings.model || "gemini-2.5-flash";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": settings.apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildAiPrompt($("theme").value, $("memo").value.trim(), settings, plannedDate()) }] }],
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || `HTTP ${res.status}`);
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    if (!text.trim()) throw new Error("AI から本文が返りませんでした");
    $("body").value = text.trim();
    const found = updateChecks();
    setStatus(found.some((f) => f.level === "error") ? "作成しました。要修正の項目を直してください" : "作成しました。内容を確認してください", !found.some((f) => f.level === "error"));
  } catch (e) {
    setStatus(`AI 作成に失敗しました：${e.message}`, false);
  } finally {
    btn.disabled = false;
  }
});

$("image").addEventListener("change", () => {
  const f = $("image").files[0];
  if (!f) return setImage(null);
  const r = new FileReader();
  r.onload = () => setImage({ name: f.name, type: f.type, dataUrl: r.result });
  r.readAsDataURL(f);
});

function setImage(img) {
  imageData = img;
  $("image-preview").replaceChildren();
  if (!img) {
    $("image").value = "";
    return;
  }
  const el = document.createElement("img");
  el.src = img.dataUrl;
  const clear = document.createElement("button");
  clear.textContent = "画像を外す";
  clear.onclick = () => setImage(null);
  $("image-preview").append(el, clear);
}

// ---------- 下書き ----------
async function getDrafts() {
  return (await chrome.storage.local.get("drafts")).drafts || [];
}
async function saveDrafts(drafts) {
  await chrome.storage.local.set({ drafts });
}
let editingId = null;

$("btn-save").addEventListener("click", async () => {
  const text = $("body").value.trim();
  if (!text) return setStatus("本文が空です", false);
  const drafts = await getDrafts();
  const draft = {
    id: editingId || crypto.randomUUID(),
    text,
    theme: $("theme").value,
    planned: $("planned").value,
    image: imageData,
    posted: false,
    updatedAt: Date.now(),
  };
  const i = drafts.findIndex((d) => d.id === draft.id);
  if (i >= 0) drafts[i] = { ...drafts[i], ...draft, posted: drafts[i].posted };
  else drafts.push(draft);
  try {
    await saveDrafts(drafts);
    editingId = draft.id;
    setStatus("下書きに保存しました");
  } catch (e) {
    setStatus(`保存に失敗しました（画像が大きすぎる可能性があります）：${e.message}`, false);
  }
});

async function renderDrafts() {
  const drafts = (await getDrafts()).sort((a, b) => (a.posted - b.posted) || (a.planned || "").localeCompare(b.planned || ""));
  const list = $("draft-list");
  list.replaceChildren();
  if (drafts.length === 0) {
    list.textContent = "下書きはありません。";
    return;
  }
  for (const d of drafts) {
    const el = document.createElement("div");
    el.className = "draft";
    el.innerHTML = `<div class="meta"><span></span><span class="badge ${d.posted ? "done" : "todo"}">${d.posted ? "投稿済み" : "未投稿"}</span></div><div class="text"></div><div class="actions"></div>`;
    el.querySelector(".meta span").textContent = `${d.planned || "日付未定"}${d.image ? "・画像あり" : ""}`;
    el.querySelector(".text").textContent = d.text;
    const actions = el.querySelector(".actions");
    const btn = (label, fn) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = fn;
      actions.append(b);
    };
    btn("開く", () => loadDraft(d));
    btn(d.posted ? "未投稿に戻す" : "投稿済みにする", async () => {
      const all = await getDrafts();
      const x = all.find((y) => y.id === d.id);
      if (x) x.posted = !x.posted;
      await saveDrafts(all);
      renderDrafts();
    });
    btn("削除", async () => {
      if (!confirm("この下書きを削除しますか？")) return;
      await saveDrafts((await getDrafts()).filter((y) => y.id !== d.id));
      renderDrafts();
    });
    list.append(el);
  }
}

function loadDraft(d) {
  editingId = d.id;
  $("body").value = d.text;
  $("theme").value = d.theme || "season";
  $("planned").value = d.planned || "";
  setImage(d.image || null);
  updateChecks();
  document.querySelector('.tabs button[data-tab="compose"]').click();
  setStatus("下書きを読み込みました");
}

// ---------- GBP 画面を開く / 入力 ----------
$("btn-open").addEventListener("click", () => chrome.tabs.create({ url: settings.url || DEFAULT_URL }));

$("btn-fill").addEventListener("click", async () => {
  const text = $("body").value.trim();
  if (!text) return setStatus("本文が空です", false);
  const errors = updateChecks().filter((f) => f.level === "error");
  if (errors.length && !confirm("要修正の項目があります。このまま入力しますか？")) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return setStatus("タブが見つかりません", false);

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fillGbpPost,
      args: [{ text, image: imageData }],
    });
  } catch (e) {
    await navigator.clipboard.writeText(text).catch(() => {});
    return setStatus(`このページには入力できません（${e.message}）。\n本文をクリップボードにコピーしたので、投稿欄に貼り付けてください。`, false);
  }

  const r = results.map((x) => x.result).filter(Boolean);
  const textOk = r.some((x) => x.text);
  const imageOk = r.some((x) => x.image);
  if (!textOk) {
    await navigator.clipboard.writeText(text).catch(() => {});
    return setStatus("投稿欄が見つかりませんでした。GBP で「最新情報を追加」を開いてから、もう一度押してください。\n（本文はクリップボードにコピー済みです。説明欄に貼り付けても OK です）", false);
  }
  const lines = ["本文を入力しました。"];
  if (imageData) lines.push(imageOk ? "画像を添付しました。" : "画像は自動で添付できませんでした。手動で追加してください。");
  lines.push("GBP の画面で内容・ボタン設定を最終確認し、「投稿」を押してください。", "投稿したら下書きタブで「投稿済み」にしておくと管理が楽です。");
  setStatus(lines.join("\n"));
});

// ページ内（全フレーム）で実行される関数。投稿ボタンは絶対に押さない。
function fillGbpPost({ text, image }) {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
  };
  // 投稿ダイアログ内だけを対象にする（Google 検索の検索窓などに誤入力しないため）
  const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')].filter(visible);
  const scopes = dialogs.length ? dialogs : location.hostname === "business.google.com" ? [document] : [];
  const isSearchBox = (el) => el.getAttribute("role") === "combobox" || el.getAttribute("name") === "q";

  const hint = /説明|詳細|本文|投稿|最新情報|description|update|post/i;
  let target = null;
  for (const scope of scopes) {
    const cands = [...scope.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""]')].filter(
      (el) => visible(el) && !el.disabled && !el.readOnly && !isSearchBox(el),
    );
    target =
      cands.find((el) => hint.test(`${el.getAttribute("aria-label") || ""} ${el.getAttribute("placeholder") || ""}`)) ||
      cands.sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0];
    if (target) break;
  }
  const active = document.activeElement;
  if (!target && active && (active.tagName === "TEXTAREA" || active.isContentEditable) && !isSearchBox(active)) target = active;
  if (!target) return { text: false, image: false };

  target.focus();
  if (target.tagName === "TEXTAREA") {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
    setter.call(target, text);
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, text);
  }
  target.style.outline = "3px solid #06c755";
  setTimeout(() => (target.style.outline = ""), 4000);

  let imageOk = false;
  if (image) {
    const root = target.closest('[role="dialog"], [aria-modal="true"]') || document;
    const input = [...root.querySelectorAll('input[type="file"]')].find((i) => !i.accept || /image/.test(i.accept));
    if (input) {
      try {
        const bin = atob(image.dataUrl.split(",")[1]);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const dt = new DataTransfer();
        dt.items.add(new File([buf], image.name, { type: image.type }));
        input.files = dt.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        imageOk = true;
      } catch {
        imageOk = false;
      }
    }
  }
  return { text: true, image: imageOk, frame: location.href };
}

// ---------- 初期化 ----------
loadSettings().then(updateChecks);
