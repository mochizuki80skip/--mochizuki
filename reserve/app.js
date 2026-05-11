(function () {
  'use strict';

  // -------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------

  const CLINICS = {
    '192': {
      name: 'リカバリー鍼灸院 長泉三島院',
      short: '長泉三島院',
      lineUrl: 'https://lin.ee/s6l4Yso',
      lineBasicId: '@714hycwt',
      address: '〒411-0943 静岡県駿東郡長泉町下土狩382-12',
      photo: 'img/clinic-mishima.jpg',
    },
    '193': {
      name: 'リカバリー鍼灸院 裾野長泉院',
      short: '裾野長泉院',
      lineUrl: 'https://lin.ee/7RkbmAz',
      lineBasicId: '@579erouy',
      address: '〒410-1123 静岡県裾野市伊豆島田825-7',
      photo: 'img/clinic-susono.jpg',
    },
  };

  // 営業（電話受付）時間: JS の getUTCDay() インデックス（0=日, 6=土）
  // 月-金: 10:00-19:00 / 土-日: 9:00-18:00
// 限定メニューは管理画面 (/admin) で登録する。
  // ?promo=CODE が URL に付いている場合のみ /api/promos?code=CODE を叩いて取得する。
  // 取得結果は state.promoMenus に詰める。

  const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

  function visitModeLabel() {
    if (state.visitMode === 'first') return '初回';
    if (state.visitMode === 'three_months') return '3ヶ月以上来院なし';
    if (state.visitMode === 'returning') return '2回目以降';
    return state.firstTime === null ? '' : (state.firstTime ? '初回' : '2回目以降');
  }

  // -------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------

  const MAX_SELECTIONS = 3;

  const state = {
    clinic: '192',
    firstTime: null,        // null | true | false  ← derived from visitMode for backend params
    visitMode: null,        // null | 'first' | 'returning' | 'three_months'
    courseId: null,         // number (threease) | string (promo) | null
    weekStart: jstMidnightOf(new Date()),
    selectedIsos: [],       // 第1〜第3希望の ISO 文字列（最大MAX_SELECTIONS）
    availability: null,     // { available: [...] }
    fetchToken: 0,
    promoCode: getPromoFromUrl(),
    promoMenus: [],         // fetched from /api/promos
  };

  // In-memory cache: courses[clinic][forNew] = Promise<courses[]>
  const courseCache = {};

  function getPromoFromUrl() {
    try {
      const p = new URLSearchParams(window.location.search).get('promo');
      return p ? p.trim() : null;
    } catch { return null; }
  }

  async function fetchPromoMenus() {
    if (!state.promoCode) return;
    try {
      const r = await fetch(`/api/promos?code=${encodeURIComponent(state.promoCode)}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!r.ok) return;
      const data = await r.json();
      state.promoMenus = Array.isArray(data.menus) ? data.menus : [];
      // If user has already reached step 2, refresh the course list display
      if (state.firstTime !== null) renderCourses();
      // autoOpen: jump straight to STEP3 if any promo says so
      tryAutoOpen();
    } catch {
      // ignore
    }
  }

  async function tryAutoOpen() {
    if (state._autoOpenApplied) return;
    // Find an autoOpen promo with at least one specific field
    const auto = state.promoMenus.find((p) => p.autoOpen && (
      p.forClinic === '192' || p.forClinic === '193'
      || p.forFirstTime === 'true' || p.forFirstTime === 'false'
      || (typeof p.targetCourseId === 'number')
    ));
    if (!auto) return;
    state._autoOpenApplied = true;

    const hasClinic = auto.forClinic === '192' || auto.forClinic === '193';
    const hasFt = auto.forFirstTime === 'true' || auto.forFirstTime === 'false';
    const hasCourse = typeof auto.targetCourseId === 'number';

    // Pre-fill clinic
    if (hasClinic && state.clinic !== auto.forClinic) {
      state.clinic = auto.forClinic;
      document.querySelectorAll('.tab').forEach((t) => {
        const on = t.dataset.clinic === auto.forClinic;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      state.availability = null;
      state._coursesList = null;
      prefetchCourses(state.clinic);
      fetchAvailability();
    }

    // Pre-fill firstTime / visitMode (autoOpen only knows first vs returning)
    if (hasFt) {
      state.firstTime = auto.forFirstTime === 'true';
      state.visitMode = state.firstTime ? 'first' : 'returning';
      const selectedVisit = state.visitMode;
      document.querySelectorAll('.choice[data-visit]').forEach((b) => {
        b.classList.toggle('is-selected', b.dataset.visit === selectedVisit);
      });
    }

    // Pre-fill course (requires firstTime to know which course list to load)
    if (hasCourse && state.firstTime !== null) {
      try {
        const courses = await getCoursesPromise(state.clinic, state.firstTime);
        state._coursesList = courses;
        if (courses.some((c) => c.id === auto.targetCourseId)) {
          state.courseId = auto.targetCourseId;
        }
      } catch { /* keep going even on fetch failure */ }
    } else if (state.firstTime !== null) {
      try {
        state._coursesList = await getCoursesPromise(state.clinic, state.firstTime);
      } catch {}
    }

    renderCourses();
    // Re-fetch availability with course filter when a course was auto-selected
    if (typeof state.courseId === 'number') {
      fetchAvailability();
    } else {
      renderGrid();
    }
    recomputeStepStates();

    // Decide which step to focus
    let focusStep = 1;
    if (state.firstTime !== null) focusStep = 2;
    if (state.courseId != null) focusStep = 3;
    setTimeout(() => {
      const target = document.getElementById('step-' + focusStep);
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // -------------------------------------------------------------------
  // Date helpers (everything anchored in JST)
  // -------------------------------------------------------------------

  function jstYmd(d) {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  }
  function jstYmdCompact(d) { return jstYmd(d).replace(/-/g, ''); }
  function jstMidnightOf(d) { return new Date(jstYmd(d) + 'T00:00:00+09:00'); }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  // Compute the JST weekday index (0=Sun..6=Sat) from a date.
  // We can't use d.getUTCDay() on a JST-midnight Date, because JST midnight is
  // 15:00 UTC the prior day, which yields the wrong weekday.
  function weekdayIdxFromYmd(ymd) {
    const [y, m, da] = ymd.split('-').map((s) => parseInt(s, 10));
    return new Date(Date.UTC(y, m - 1, da)).getUTCDay();
  }
  function jstWeekdayIdx(d) {
    return weekdayIdxFromYmd(jstYmd(d));
  }
  function fmtMonthDay(d) {
    const ymd = jstYmd(d).split('-');
    return `${parseInt(ymd[1], 10)}/${parseInt(ymd[2], 10)}`;
  }
  function fmtTimeFromIso(iso) {
    const m = iso.match(/T(\d{2}):(\d{2})/);
    return m ? `${m[1]}:${m[2]}` : iso;
  }
  function fmtDateTimeJp(iso) {
    const dm = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!dm) return iso;
    const [, y, mo, da, hh, mm] = dm;
    const w = WEEKDAYS_JP[weekdayIdxFromYmd(`${y}-${mo}-${da}`)];
    return `${y}年${parseInt(mo, 10)}月${parseInt(da, 10)}日(${w}) ${hh}:${mm}`;
  }
  function fmtPrice(n) {
    if (typeof n !== 'number') return '';
    return '¥' + n.toLocaleString('ja-JP');
  }

  // -------------------------------------------------------------------
  // Course list (fast endpoint, prefetched & cached)
  // -------------------------------------------------------------------

  function getCoursesPromise(clinic, forNew) {
    if (!courseCache[clinic]) courseCache[clinic] = {};
    const key = String(forNew);
    if (!courseCache[clinic][key]) {
      const url = `/api/courses?clinic=${clinic}&for_new=${forNew}`;
      courseCache[clinic][key] = fetch(url, { headers: { 'Accept': 'application/json' } })
        .then((r) => {
          if (!r.ok) throw new Error('courses fetch failed');
          return r.json();
        })
        .then((d) => d.courses || [])
        .catch((e) => {
          // Allow retry on next call
          delete courseCache[clinic][key];
          throw e;
        });
    }
    return courseCache[clinic][key];
  }

  function prefetchCourses(clinic) {
    // Fire and forget for both for_new values
    getCoursesPromise(clinic, true).catch(() => {});
    getCoursesPromise(clinic, false).catch(() => {});
  }

  // -------------------------------------------------------------------
  // Promo menu helpers
  // -------------------------------------------------------------------

  function getActivePromos() {
    if (!state.promoCode || !state.promoMenus.length) return [];
    return state.promoMenus.filter((p) => {
      if (p.forClinic && p.forClinic !== 'both' && p.forClinic !== state.clinic) return false;
      if (state.firstTime === null) return true;
      if (!p.forFirstTime || p.forFirstTime === 'both') return true;
      if (p.forFirstTime === 'true' && state.firstTime === true) return true;
      if (p.forFirstTime === 'false' && state.firstTime === false) return true;
      return false;
    });
  }

  function getOverridePromoFor(courseId) {
    const promos = getActivePromos();
    return promos.find((p) => p.targetCourseId && p.targetCourseId === courseId) || null;
  }

  function applyOverrideToCourse(c) {
    const p = getOverridePromoFor(c.id);
    if (!p) return c;
    const overrideName = typeof p.name === 'string' ? p.name.trim() : '';
    const overrideDesc = typeof p.description === 'string' ? p.description.trim() : '';
    const hasOverrideValues = !!overrideName || !!overrideDesc || typeof p.price === 'number';
    return {
      ...c,
      name: overrideName || c.name,
      description: overrideDesc || c.description,
      price: typeof p.price === 'number' ? p.price : c.price,
      _isPromoOverride: hasOverrideValues,
      _origPrice: c.price,
      _origName: c.name,
    };
  }

  function getAllCardsForStep2(threaseCourses) {
    const promos = getActivePromos();
    const addonPromos = promos.filter((p) => {
      if (p.targetCourseId) return false;
      // Only show promo as a new menu card if it has display content
      const hasContent = (typeof p.name === 'string' && p.name.trim() !== '')
        || (typeof p.price === 'number')
        || (typeof p.description === 'string' && p.description.trim() !== '');
      return hasContent;
    }).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      duration: p.duration,
      price: p.price,
      isPromo: true,
    }));
    let courses = threaseCourses || [];
    // 3ヶ月モードで表示する2コース（courses.js が自動でリネーム済）。
    // 2回目以降ではこの2つを除外する。
    const THREE_MONTH_NAMES = new Set([
      '【久しぶり】コンビネーション施術',
      '【久しぶり】オールインワン施術',
    ]);
    if (state.visitMode === 'three_months') {
      courses = courses.filter((c) => THREE_MONTH_NAMES.has(c.name));
    } else if (state.visitMode === 'returning') {
      courses = courses.filter((c) => !THREE_MONTH_NAMES.has(c.name));
    }
    const overlaid = courses.map(applyOverrideToCourse);
    return [...addonPromos, ...overlaid];
  }

  function getSelectedCardObject() {
    if (state.courseId == null) return null;
    const promos = getActivePromos();
    const addon = promos.find((p) => !p.targetCourseId && p.id === state.courseId);
    if (addon) {
      return {
        id: addon.id,
        name: addon.name,
        description: addon.description,
        duration: addon.duration,
        price: addon.price,
        isPromo: true,
      };
    }
    if (state._coursesList) {
      const c = state._coursesList.find((c) => c.id === state.courseId);
      if (c) return applyOverrideToCourse(c);
    }
    return null;
  }

  // -------------------------------------------------------------------
  // Step state machine
  // -------------------------------------------------------------------

  function recomputeStepStates() {
    setStepState(1, 'active', state.firstTime !== null);
    setStepState(2, state.firstTime === null ? 'locked' : 'active', state.courseId !== null);
    // Step 3 is "done" (collapsed) only when user explicitly moves to step 4.
    // While they may be adding 2nd/3rd choices, keep step 3 active.
    setStepState(
      3,
      state.firstTime === null || state.courseId === null ? 'locked' : 'active',
      false
    );
    setStepState(4, state.selectedIsos.length === 0 ? 'locked' : 'active', false);
    updateSummaries();
    updateBookingPanel();
  }

  function setStepState(n, st, done) {
    const el = document.getElementById('step-' + n);
    if (!el) return;
    el.dataset.state = done ? 'done' : st;
  }

  function updateSummaries() {
    const s1 = document.getElementById('sum-1');
    const e1 = document.querySelector('[data-edit="1"]');
    if (state.firstTime !== null) {
      s1.textContent = visitModeLabel();
      e1.hidden = false;
    } else { s1.textContent = ''; e1.hidden = true; }

    const s2 = document.getElementById('sum-2');
    const e2 = document.querySelector('[data-edit="2"]');
    const card = getSelectedCardObject();
    if (card) {
      s2.textContent = card.name;
      e2.hidden = false;
    } else { s2.textContent = ''; e2.hidden = true; }

    const s3 = document.getElementById('sum-3');
    const e3 = document.querySelector('[data-edit="3"]');
    if (state.selectedIsos.length > 0) {
      const first = fmtDateTimeJp(state.selectedIsos[0]);
      const more = state.selectedIsos.length > 1 ? ` ほか${state.selectedIsos.length - 1}件` : '';
      s3.textContent = first + more;
      e3.hidden = false;
    } else { s3.textContent = ''; e3.hidden = true; }

    renderStep3Pin(card);
    renderFirstTimeNameField();
  }

  function renderStep3Pin(card) {
    const wrap = document.getElementById('step3-pin');
    if (!wrap) return;
    if (!card || state.firstTime === null) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    const courseEl = document.getElementById('pin-course');
    const meta = [];
    if (card.duration) meta.push(`${card.duration}分`);
    if (typeof card.price === 'number') meta.push(fmtPrice(card.price));
    const metaStr = meta.length ? ` (${meta.join('・')})` : '';
    courseEl.textContent = `${visitModeLabel()}・${card.name}${metaStr}`;

    const ul = document.getElementById('pin-picks');
    ul.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const iso = state.selectedIsos[i];
      const li = document.createElement('li');
      li.className = 'pin-slot' + (iso ? ' is-set' : '');
      li.innerHTML = `<span class="pin-slot-no">第${i + 1}希望</span>`
        + `<span class="pin-slot-val">${iso ? escapeHtml(fmtDateTimeJp(iso)) : '未選択'}</span>`;
      ul.appendChild(li);
    }
  }

  function renderFirstTimeNameField() {
    const wrap = document.getElementById('firsttime-name-wrap');
    if (!wrap) return;
    wrap.hidden = state.firstTime !== true;
  }

  // Custom smooth scroll — the browser-native scrollIntoView with
  // behavior:'smooth' tends to be too fast on phones. We control the
  // duration manually with an ease-in-out curve.
  function smoothScrollToY(targetY, duration) {
    const startY = window.scrollY || window.pageYOffset || 0;
    const dist = targetY - startY;
    if (Math.abs(dist) < 2) return;
    const start = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      window.scrollTo(0, startY + dist * ease(t));
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function smoothScrollToElement(el, opts) {
    if (!el) return;
    const offset = (opts && typeof opts.offset === 'number') ? opts.offset : 0;
    const duration = (opts && typeof opts.duration === 'number') ? opts.duration : 900;
    const top = el.getBoundingClientRect().top + (window.scrollY || 0) + offset;
    smoothScrollToY(top, duration);
  }

  function activateStep(n) {
    const el = document.getElementById('step-' + n);
    if (el) el.dataset.state = 'active';
    if (el) {
      setTimeout(() => smoothScrollToElement(el, { offset: -8, duration: 900 }), 60);
    }
  }

  // -------------------------------------------------------------------
  // Loading / error UI helpers
  // -------------------------------------------------------------------

  function showCoursesLoading(on) { document.getElementById('courses-loading').hidden = !on; }
  function showCoursesError(msg) {
    const el = document.getElementById('courses-error');
    if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; }
  }
  // ----- Grid loading + progress bar -----
  // Real progress is hard to surface since the heavy work happens server-side;
  // animate a smooth "fake" bar that targets ~95% over ~4s and then jumps to
  // 100% when the response actually arrives. Better than a static "loading".
  let _progressTimer = null;
  let _progressStart = 0;
  function setProgress(pct) {
    pct = Math.max(0, Math.min(100, pct));
    const bar = document.getElementById('grid-progress-bar');
    const txt = document.getElementById('grid-loading-pct');
    if (bar) bar.style.width = pct.toFixed(0) + '%';
    if (txt) txt.textContent = pct.toFixed(0) + '%';
  }
  function startProgress() {
    stopProgress();
    _progressStart = Date.now();
    setProgress(0);
    // Ease-out: fast at first, slow as we approach the cap (95%)
    const TARGET_DURATION_MS = 8000;
    _progressTimer = setInterval(() => {
      const elapsed = Date.now() - _progressStart;
      const t = Math.min(elapsed / TARGET_DURATION_MS, 1);
      // 1 - (1-t)^1.6 — fast start, gentle approach to 1
      const eased = 1 - Math.pow(1 - t, 1.6);
      setProgress(eased * 95);
    }, 120);
  }
  function stopProgress(complete) {
    if (_progressTimer) {
      clearInterval(_progressTimer);
      _progressTimer = null;
    }
    if (complete) setProgress(100);
  }
  function showGridLoading(on) {
    const el = document.getElementById('grid-loading');
    el.hidden = !on;
    if (on) {
      stopProgress();
      setProgress(0);
      // 「読み込み開始」の手応えを出すため、開始から少しだけ進めておく。
      // 実際の per-day 進捗 (>=14%) が来たら自然に上書きされる。
      setTimeout(() => {
        const bar = document.getElementById('grid-progress-bar');
        const cur = bar ? parseFloat(bar.style.width) || 0 : 0;
        if (cur < 8) setProgress(8);
      }, 80);
    } else {
      stopProgress(true);
    }
  }
  function showGridError(msg) {
    const el = document.getElementById('grid-error');
    if (msg) {
      el.innerHTML = '';
      const p = document.createElement('div');
      p.textContent = '空き状況を取得できませんでした。少し時間をおいてから再読み込みしてください。';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'grid-retry-btn';
      btn.textContent = '再読み込み';
      btn.addEventListener('click', () => {
        showGridError(null);
        fetchAvailability();
      });
      el.appendChild(p);
      el.appendChild(btn);
      el.hidden = false;
    } else {
      el.hidden = true;
      el.innerHTML = '';
    }
  }

  // -------------------------------------------------------------------
  // Step 2: load and render courses
  // -------------------------------------------------------------------

  async function loadCoursesForCurrentSelection() {
    if (state.firstTime === null) return;
    showCoursesLoading(true);
    showCoursesError(null);
    const myToken = ++state.fetchToken;
    try {
      // 3ヶ月モードでも threease 側に for_new=false の専用コース（コンビ60分・
      // オールイン90分）が存在するため、特別なケースは不要。
      const courses = await getCoursesPromise(state.clinic, state.firstTime);
      if (myToken !== state.fetchToken) return;
      state._coursesList = courses.map((c) => Object.assign({}, c, { _forNew: state.firstTime }));
      renderCourses();
      const stillValid =
        getActivePromos().some((p) => p.id === state.courseId) ||
        state._coursesList.some((c) => c.id === state.courseId);
      if (state.courseId && !stillValid) {
        state.courseId = null;
        state.selectedIsos = [];
      }
      recomputeStepStates();
    } catch (e) {
      if (myToken !== state.fetchToken) return;
      showCoursesError('コース取得に失敗しました');
    } finally {
      if (myToken === state.fetchToken) showCoursesLoading(false);
    }
  }

  function renderCourses() {
    const list = document.getElementById('course-list');
    list.innerHTML = '';
    const cards = getAllCardsForStep2(state._coursesList || []);
    if (!cards.length) {
      list.innerHTML = '<div class="status">表示できるコースがありません</div>';
      return;
    }
    for (const c of cards) {
      const btn = document.createElement('button');
      btn.className = 'choice course-card';
      if (c.isPromo) btn.classList.add('is-promo');
      if (c._isPromoOverride) btn.classList.add('is-promo-override');
      if (String(state.courseId) === String(c.id)) btn.classList.add('is-selected');
      btn.dataset.courseId = String(c.id);
      const meta = [];
      if (c.duration) meta.push(`${c.duration}分`);
      // Override price shown with strikethrough of original
      let priceHtml = '';
      if (c._isPromoOverride && typeof c._origPrice === 'number' && typeof c.price === 'number' && c._origPrice !== c.price) {
        priceHtml = `<span class="price-orig">${fmtPrice(c._origPrice)}</span> <span class="price-promo">${fmtPrice(c.price)}</span>`;
      } else if (typeof c.price === 'number') {
        priceHtml = fmtPrice(c.price);
      }
      let descShort = '';
      if (c.description) {
        const txt = c.description.replace(/\\n|\n/g, ' ').slice(0, 90);
        descShort = txt + (c.description.length > 90 ? '…' : '');
      }
      const badge = c.isPromo
        ? '<span class="promo-badge">限定</span>'
        : (c._isPromoOverride ? '<span class="promo-badge">限定価格</span>' : '');
      btn.innerHTML =
        badge +
        `<span class="choice-title">${escapeHtml(c.name || '')}</span>` +
        (meta.length || priceHtml ? `<span class="choice-meta">${[...meta, priceHtml].filter(Boolean).join(' / ')}</span>` : '') +
        (descShort ? `<span class="choice-desc">${escapeHtml(descShort)}</span>` : '');
      list.appendChild(btn);
    }
  }

  // -------------------------------------------------------------------
  // Step 3: availability fetch and grid render
  // -------------------------------------------------------------------

  async function fetchAvailability() {
    const baseParams = [];
    const card = getSelectedCardObject();
    if (typeof state.courseId === 'number') {
      baseParams.push(`course_id=${state.courseId}`);
      const dur = card ? Number(card.duration) : null;
      if (dur && Number.isFinite(dur)) baseParams.push(`duration=${dur}`);
    }
    // 3ヶ月モードでは選択コース毎に for_new が違うので、コードに付随する
    // _forNew を最優先で使う。コース未選択時は state.firstTime にフォールバック。
    let forNewToUse = null;
    if (card && typeof card._forNew === 'boolean') forNewToUse = card._forNew;
    else if (state.firstTime !== null) forNewToUse = state.firstTime;
    if (forNewToUse !== null) {
      baseParams.push(`for_new=${forNewToUse ? 'true' : 'false'}`);
    }
    const baseSuffix = baseParams.length ? '&' + baseParams.join('&') : '';

    // Cache-bust key for this whole 7-day window (so a stale day-result from
    // a previous course/clinic doesn't bleed into the new render).
    const fetchKey = `${state.clinic}|${state.weekStart.getTime()}|${baseSuffix}`;
    state._availabilityFetchKey = fetchKey;

    // Reset state.availability to an empty per-day structure that renderGrid
    // can render against immediately. Days fill in as their fetches resolve.
    state.availability = { available: [], axisAvailable: [], _dayResults: {}, _doneDays: 0, _totalDays: 7 };

    showGridLoading(true);
    showGridError(null);
    setProgress(0);
    renderGrid();

    let anyError = false;
    const dayPromises = [];
    for (let i = 0; i < 7; i++) {
      const ymd = jstYmdCompact(addDays(state.weekStart, i));
      const url = `/api/availability?clinic=${state.clinic}&start=${ymd}&end=${ymd}${baseSuffix}`;
      // 直近日から順に表示できるよう、後の日ほど発射を少し遅らせる。
      // (7日同時発射より体感が良く、threease の瞬間負荷も少し軽くなる)
      const stagger = i * 80;
      dayPromises.push((async () => {
        if (stagger > 0) await new Promise((res) => setTimeout(res, stagger));
        if (state._availabilityFetchKey !== fetchKey) return;
        try {
          const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
          if (state._availabilityFetchKey !== fetchKey) return;
          if (!r.ok) { anyError = true; return; }
          const data = await r.json();
          if (state._availabilityFetchKey !== fetchKey) return;
          state.availability._dayResults[ymd] = data;
          state.availability.available.push(...(data.available || []));
          state.availability.axisAvailable.push(...(data.axisAvailable || []));
          state.availability._doneDays++;
          // Real progress: completed days / total days
          setProgress((state.availability._doneDays / state.availability._totalDays) * 100);
          renderGrid();
        } catch (e) {
          anyError = true;
          if (state._availabilityFetchKey !== fetchKey) return;
        }
      })());
    }

    await Promise.all(dayPromises);
    if (state._availabilityFetchKey !== fetchKey) return;
    if (anyError && state.availability._doneDays === 0) {
      // Total failure: surface the error
      showGridError('取得に失敗しました');
      state.availability = null;
      renderGrid();
    }
    showGridLoading(false);
  }

  // Slot grid increment in minutes. Auto-detected from the API response
  // (threease typically uses 30-min slots, but be robust just in case).
  let slotIncrementMin = 30;

  function detectSlotIncrement(all) {
    const byDate = new Map();
    for (const s of all) {
      const t = fmtTimeFromIso(s.iso);
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push(t);
    }
    let minGap = Infinity;
    for (const list of byDate.values()) {
      const mins = list.map((t) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      }).sort((a, b) => a - b);
      for (let i = 1; i < mins.length; i++) {
        const gap = mins[i] - mins[i - 1];
        if (gap > 0 && gap < minGap) minGap = gap;
      }
    }
    return Number.isFinite(minGap) ? minGap : 30;
  }

  function addMinutesHHMM(hhmm, minutesToAdd) {
    const [h, m] = hhmm.split(':').map((s) => parseInt(s, 10));
    const total = h * 60 + m + minutesToAdd;
    if (total < 0 || total >= 24 * 60) return null;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function getSlotsForSelection() {
    if (!state.availability || !state.courseId) return [];
    // サーバ側 (/api/availability) で threease の /courses?start_time=Y を
    // 使った per-time per-course の正確なフィルタが既に適用されているので、
    // クライアントで連続枠の二重チェックはしない（連続枠を仮定すると
    // /calendar?course_id=X が省く 60分枠 (例:14:30→15:00 が無いケース)
    // を誤って弾いてしまう）。
    return state.availability.available;
  }

  function renderGrid() {
    const grid = document.getElementById('grid');
    const empty = document.getElementById('grid-empty');
    grid.innerHTML = '';
    empty.hidden = true;

    // Range label (2 weeks)
    const startYmd = jstYmd(state.weekStart);
    const endYmd = jstYmd(addDays(state.weekStart, 6));
    document.getElementById('week-label').textContent =
      `${startYmd.slice(0, 4)}/${startYmd.slice(5, 7)}/${startYmd.slice(8, 10)} 〜 ${endYmd.slice(5, 7)}/${endYmd.slice(8, 10)}`;

    if (!state.availability || !state.courseId) {
      updateUpdatedAt();
      return;
    }

    const slots = getSlotsForSelection();
    const byDate = new Map();
    for (const s of slots) {
      const t = fmtTimeFromIso(s.iso);
      if (!byDate.has(s.date)) byDate.set(s.date, new Map());
      byDate.get(s.date).set(t, s.iso);
    }

    const allDays = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(state.weekStart, i);
      const ymd = jstYmd(d);
      allDays.push({
        date: d,
        ymd,
        weekday: WEEKDAYS_JP[jstWeekdayIdx(d)],
        wIdx: jstWeekdayIdx(d),
        monthDay: fmtMonthDay(d),
      });
    }

    // Common time axis across both weeks for visual alignment
    // Build the time axis from the raw room-level availability (before any
    // per-course filtering) so the row layout stays stable when some rows
    // are entirely unbookable for the selected course.
    const axisSource = (state.availability && Array.isArray(state.availability.axisAvailable))
      ? state.availability.axisAvailable
      : slots;
    const axisByDate = new Map();
    for (const s of axisSource) {
      const t = fmtTimeFromIso(s.iso);
      if (!axisByDate.has(s.date)) axisByDate.set(s.date, new Set());
      axisByDate.get(s.date).add(t);
    }
    const timeSet = new Set();
    // Baseline: always show 09:00 / 09:30 because Sat/Sun open at 9:00.
    // Weekdays will simply show "—" at those rows (per request).
    timeSet.add('09:00');
    timeSet.add('09:30');
    for (const d of allDays) {
      const m = axisByDate.get(d.ymd);
      if (m) for (const t of m) timeSet.add(t);
    }
    const times = [...timeSet].sort();

    // "完全に空きなし" 表示は実スロット（filtered）が 0 件のときのみ。
    // ベースライン行は常にあるので times は空にならない。
    if (slots.length === 0 && state.availability && state.availability._doneDays === state.availability._totalDays) {
      empty.hidden = false;
    }

    const todayYmd = jstYmd(new Date());
    const weeks = [allDays];

    let html = '';
    weeks.forEach((days) => {
      html += `<div class="week-block">`;
      html += '<div class="grid-table" role="table">';
      html += '<div class="grid-row grid-header" role="row">';
      html += '<div class="cell time-label-cell" role="columnheader"></div>';
      for (const d of days) {
        const cls = ['cell', 'day-cell'];
        if (d.ymd === todayYmd) cls.push('is-today');
        if (d.wIdx === 0) cls.push('is-sun');
        if (d.wIdx === 6) cls.push('is-sat');
        html += `<div class="${cls.join(' ')}" role="columnheader">`;
        html += `<span class="day-wday">${d.weekday}</span>`;
        html += `<span class="day-md">${d.monthDay}</span>`;
        html += '</div>';
      }
      html += '</div>';

      for (const t of times) {
        html += '<div class="grid-row" role="row">';
        html += `<div class="cell time-label-cell" role="rowheader">${t}</div>`;
        for (const d of days) {
          const m = byDate.get(d.ymd);
          const iso = m ? m.get(t) : null;
          const cls = ['cell', 'slot'];
          if (d.wIdx === 0) cls.push('is-sun');
          if (d.wIdx === 6) cls.push('is-sat');
          if (iso) {
            cls.push('avail');
            const priorityIdx = state.selectedIsos.indexOf(iso);
            if (priorityIdx >= 0) {
              cls.push('is-selected');
              cls.push('is-priority-' + (priorityIdx + 1));
            }
            const badge = priorityIdx >= 0
              ? `<span class="priority-badge">第${priorityIdx + 1}希望</span>`
              : '<span class="avail-mark">〇</span>';
            html += `<button class="${cls.join(' ')}" data-iso="${iso}" aria-label="${d.monthDay} ${d.weekday} ${t} 予約可">${badge}</button>`;
          } else {
            cls.push('none');
            html += `<div class="${cls.join(' ')}" aria-label="満員">―</div>`;
          }
        }
        html += '</div>';
      }
      html += '</div>';
      html += '</div>';
    });

    grid.innerHTML = html;
    updateUpdatedAt();
  }

  function updateUpdatedAt() {
    const now = new Date().toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
    });
    document.getElementById('updated').textContent = `最終更新: ${now}`;
  }

  // -------------------------------------------------------------------
  // Step 4: booking panel (LINE / phone / threease)
  // -------------------------------------------------------------------

  function updateBookingPanel() {
    const clinic = CLINICS[state.clinic];
    const card = getSelectedCardObject();

    document.getElementById('m-clinic').textContent = clinic.name;
    document.getElementById('m-firsttime').textContent =
      state.firstTime === null ? '—' : visitModeLabel();

    const addrEl = document.getElementById('m-address');
    if (addrEl) addrEl.textContent = clinic.address || '';
    const photoEl = document.getElementById('confirm-photo');
    if (photoEl) {
      if (clinic.photo) {
        photoEl.src = clinic.photo;
        photoEl.alt = clinic.name;
        photoEl.style.display = '';
      } else {
        photoEl.style.display = 'none';
      }
    }
    document.getElementById('m-course').textContent = card ? card.name : '—';
    const dtSummary = state.selectedIsos.length === 0
      ? '—'
      : [0, 1, 2]
          .map((i) => `第${i + 1}希望: ${state.selectedIsos[i] ? fmtDateTimeJp(state.selectedIsos[i]) : ''}`)
          .join('\n');
    const dtCell = document.getElementById('m-datetime');
    dtCell.textContent = dtSummary;
    dtCell.style.whiteSpace = 'pre-line';

    // LINE message text
    const ta = document.getElementById('m-text');
    if (state.selectedIsos.length > 0 && card) {
      const courseLine = buildCourseLine(card);
      const promoLine = card.isPromo
        ? `\n※ ${card.name.replace(/^【.*?】/, '')}（チラシご持参）`
        : (card._isPromoOverride
          ? `\n※ キャンペーン価格 ${fmtPrice(card.price)}（チラシご持参）`
          : '');
      const dtLines = [0, 1, 2]
        .map((i) => `  第${i + 1}希望: ${state.selectedIsos[i] ? fmtDateTimeJp(state.selectedIsos[i]) : ''}`)
        .join('\n');
      const nameInput = document.getElementById('m-name');
      const nameVal = nameInput ? nameInput.value.trim() : '';
      const nameLine = state.firstTime ? `\nお名前: ${nameVal}` : '';
      ta.value =
`【予約希望】
院: ${clinic.name}
来院: ${visitModeLabel()}
${courseLine}
日時:
${dtLines}${promoLine}${nameLine}
————————————————
コチラからの返信で予約が確定になります。
メッセージはこのまま送信してください。`;
    } else {
      ta.value = '';
    }
  }

  function buildCourseLine(card) {
    if (!card) return 'コース: ';
    const parts = [];
    if (card.duration) parts.push(`${card.duration}分`);
    if (typeof card.price === 'number') parts.push(fmtPrice(card.price));
    const meta = parts.length ? ` (${parts.join('・')})` : '';
    return `コース: ${card.name}${meta}`;
  }

  async function copyAndOpenLine() {
    if (state.selectedIsos.length === 0) return;
    // First-visit guard: name is required for new patients
    if (state.firstTime === true) {
      const nameInput = document.getElementById('m-name');
      const name = nameInput ? nameInput.value.trim() : '';
      if (!name) {
        const wrap = document.getElementById('firsttime-name-wrap');
        if (wrap) {
          wrap.classList.add('is-error');
          if (nameInput) {
            nameInput.focus();
            nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        return;
      }
    }
    const ta = document.getElementById('m-text');
    const text = ta.value;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      try {
        ta.removeAttribute('readonly');
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        ta.setAttribute('readonly', 'readonly');
      } catch { copied = false; }
    }

    const btn = document.getElementById('copy-and-go');
    const orig = btn.textContent;
    btn.textContent = copied ? 'コピーしました。LINEを開きます…' : 'コピーできません。手動でコピーしてください';
    btn.disabled = true;

    // Prefer the oaMessage scheme so the chat opens with the text already
    // entered in the input box. This works for users who are already friends
    // with the OA. Fall back to the friend-add link if the basic ID isn't set.
    const clinic = CLINICS[state.clinic];
    let openUrl;
    if (clinic.lineBasicId) {
      const id = encodeURIComponent(clinic.lineBasicId);
      openUrl = `https://line.me/R/oaMessage/${id}/?${encodeURIComponent(text)}`;
    } else {
      openUrl = clinic.lineUrl;
    }
    setTimeout(() => {
      window.location.href = openUrl;
      btn.textContent = orig;
      btn.disabled = false;
    }, 600);
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // -------------------------------------------------------------------
  // Event wiring
  // -------------------------------------------------------------------

  document.addEventListener('click', (e) => {
    // Clinic tabs
    const tab = e.target.closest('.tab');
    if (tab) {
      if (tab.classList.contains('is-active')) return;
      document.querySelectorAll('.tab').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      state.clinic = tab.dataset.clinic;
      // Reset downstream (different clinic = different schedule)
      state.courseId = null;
      state.selectedIsos = [];
      state.availability = null;
      state._coursesList = null;
      renderCourses();
      renderGrid();
      recomputeStepStates();
      prefetchCourses(state.clinic);
      fetchAvailability();
      if (state.firstTime !== null) {
        loadCoursesForCurrentSelection();
      }
      return;
    }

    // Step 1
    const ftBtn = e.target.closest('.choice[data-visit]');
    if (ftBtn) {
      const mode = ftBtn.dataset.visit; // 'first' | 'returning' | 'three_months'
      const ft = mode === 'first';
      const changed = state.visitMode !== mode;
      state.visitMode = mode;
      state.firstTime = ft;
      if (changed) {
        state.courseId = null;
        state.selectedIsos = [];
        state._coursesList = null;
      }
      document.querySelectorAll('.choice[data-visit]').forEach((b) => {
        b.classList.toggle('is-selected', b === ftBtn);
      });
      recomputeStepStates();
      activateStep(2);
      loadCoursesForCurrentSelection();
      return;
    }

    // Step 2: course choice
    const courseBtn = e.target.closest('.course-card');
    if (courseBtn) {
      const raw = courseBtn.dataset.courseId;
      const id = /^\d+$/.test(raw) ? parseInt(raw, 10) : raw;
      const courseChanged = state.courseId !== id;
      if (courseChanged) {
        state.courseId = id;
        state.selectedIsos = [];
      }
      document.querySelectorAll('.course-card').forEach((b) => {
        b.classList.toggle('is-selected', b === courseBtn);
      });
      // Re-fetch availability for the selected (threease) course so duration
      // filtering happens upstream
      if (courseChanged && typeof id === 'number') {
        fetchAvailability();
      } else {
        renderGrid();
      }
      recomputeStepStates();
      activateStep(3);
      return;
    }

    // Step 3: time slot (multi-select up to 3, in priority order)
    const slot = e.target.closest('.slot.avail');
    if (slot && slot.dataset.iso) {
      const iso = slot.dataset.iso;
      const idx = state.selectedIsos.indexOf(iso);
      if (idx >= 0) {
        // Already selected → deselect
        state.selectedIsos.splice(idx, 1);
      } else {
        if (state.selectedIsos.length >= MAX_SELECTIONS) {
          // Replace last one (lowest priority)
          state.selectedIsos.pop();
        }
        state.selectedIsos.push(iso);
      }
      renderGrid(); // re-render so priority badges update
      recomputeStepStates();
      // Only auto-scroll to step 4 on the FIRST selection
      if (state.selectedIsos.length === 1 && idx < 0) {
        activateStep(4);
      }
      return;
    }

    // Edit (collapse-back) buttons
    const edit = e.target.closest('.step-edit');
    if (edit) {
      const n = parseInt(edit.dataset.edit, 10);
      const target = document.getElementById('step-' + n);
      if (target) target.dataset.state = 'active';
      if (target && target.scrollIntoView) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    // Week navigation (keep prior week selections; iso is unambiguous)
    if (e.target.id === 'prev-week') {
      state.weekStart = addDays(state.weekStart, -7);
      recomputeStepStates();
      fetchAvailability();
      return;
    }
    if (e.target.id === 'next-week') {
      state.weekStart = addDays(state.weekStart, 7);
      recomputeStepStates();
      fetchAvailability();
      return;
    }

    // Copy & go (LINE)
    if (e.target.id === 'copy-and-go') {
      copyAndOpenLine();
      return;
    }
  });

  // -------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------

  // Live-update the LINE message text and clear the name-required error
  // marker as the user types in the first-visit name field.
  const nameInputEl = document.getElementById('m-name');
  if (nameInputEl) {
    nameInputEl.addEventListener('input', () => {
      const wrap = document.getElementById('firsttime-name-wrap');
      if (wrap) wrap.classList.remove('is-error');
      updateBookingPanel();
    });
  }

  // Fire prefetches immediately so STEP2 & STEP3 are instant
  prefetchCourses(state.clinic);
  fetchAvailability();

  // If a promo code is in URL, fetch the menus (banner shows when fetch returns >0 menus)
  if (state.promoCode) fetchPromoMenus();

  recomputeStepStates();
})();
