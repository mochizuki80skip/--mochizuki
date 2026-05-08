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
      // TODO: 実際の電話番号に差替え（数字のみ：tel: 用）
      phone: '055-000-0000',
      hours: '受付時間: 平日 10:00-19:00 / 土日 9:00-18:00',
      threeaseUrl: 'https://reservation.threease.com/192',
    },
    '193': {
      name: 'リカバリー鍼灸院 裾野長泉院',
      short: '裾野長泉院',
      lineUrl: 'https://lin.ee/7RkbmAz',
      // TODO: 実際の電話番号に差替え
      phone: '055-000-0000',
      hours: '受付時間: 平日 10:00-19:00 / 土日 9:00-18:00',
      threeaseUrl: 'https://reservation.threease.com/193',
    },
  };

  // ?promo=CODE で表示される限定メニュー定義。
  // forFirstTime: 'true' = 初回のみ / 'false' = 2回目以降のみ / 'both' = 両方
  // forClinic:    '192' / '193' / 'both'
  // threeaseCourseId: 数値 = その course の空き時間でフィルタ / null = 全空き時間表示
  const PROMO_MENUS = {
    'sample2026': [
      {
        id: 'promo-sample-1',
        name: '【チラシ限定】お試しコース',
        description: 'チラシをご持参の方限定の特別メニュー。',
        duration: 30,
        price: 3000,
        threeaseCourseId: null,
        forFirstTime: 'both',
        forClinic: 'both',
      },
    ],
  };

  const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

  // -------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------

  const state = {
    clinic: '192',
    firstTime: null,        // null | true | false
    courseId: null,         // number (threease) | string (promo) | null
    weekStart: jstMidnightOf(new Date()),
    selectedIso: null,
    availability: null,     // { available: [...] }
    fetchToken: 0,
    promoCode: getPromoFromUrl(),
  };

  // In-memory cache: courses[clinic][forNew] = Promise<courses[]>
  const courseCache = {};

  function getPromoFromUrl() {
    try {
      const p = new URLSearchParams(window.location.search).get('promo');
      return p && PROMO_MENUS[p] ? p : null;
    } catch { return null; }
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
  function jstWeekdayIdx(d) {
    return new Date(jstYmd(d) + 'T00:00:00+09:00').getUTCDay();
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
    const d = new Date(`${y}-${mo}-${da}T00:00:00+09:00`);
    const w = WEEKDAYS_JP[d.getUTCDay()];
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
    if (!state.promoCode) return [];
    const promos = PROMO_MENUS[state.promoCode] || [];
    return promos.filter((p) => {
      if (p.forClinic && p.forClinic !== 'both' && p.forClinic !== state.clinic) return false;
      if (state.firstTime === null) return true;
      if (p.forFirstTime === 'both') return true;
      if (p.forFirstTime === 'true' && state.firstTime === true) return true;
      if (p.forFirstTime === 'false' && state.firstTime === false) return true;
      return false;
    });
  }

  function getAllCardsForStep2(threaseCourses) {
    const promos = getActivePromos().map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      duration: p.duration,
      price: p.price,
      isPromo: true,
      threeaseCourseId: p.threeaseCourseId,
    }));
    return [...promos, ...threaseCourses];
  }

  function getSelectedCardObject() {
    if (!state.courseId) return null;
    const promos = getActivePromos();
    const promo = promos.find((p) => p.id === state.courseId);
    if (promo) {
      return {
        id: promo.id,
        name: promo.name,
        description: promo.description,
        duration: promo.duration,
        price: promo.price,
        isPromo: true,
        threeaseCourseId: promo.threeaseCourseId,
      };
    }
    if (state._coursesList) {
      const c = state._coursesList.find((c) => c.id === state.courseId);
      if (c) return c;
    }
    return null;
  }

  // -------------------------------------------------------------------
  // Step state machine
  // -------------------------------------------------------------------

  function recomputeStepStates() {
    setStepState(1, 'active', state.firstTime !== null);
    setStepState(2, state.firstTime === null ? 'locked' : 'active', state.courseId !== null);
    setStepState(
      3,
      state.firstTime === null || state.courseId === null ? 'locked' : 'active',
      state.selectedIso !== null
    );
    setStepState(4, state.selectedIso === null ? 'locked' : 'active', false);
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
      s1.textContent = state.firstTime ? '初回' : '2回目以降';
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
    if (state.selectedIso) {
      s3.textContent = fmtDateTimeJp(state.selectedIso);
      e3.hidden = false;
    } else { s3.textContent = ''; e3.hidden = true; }
  }

  function activateStep(n) {
    const el = document.getElementById('step-' + n);
    if (el) el.dataset.state = 'active';
    if (el && el.scrollIntoView) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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
  function showGridLoading(on) { document.getElementById('grid-loading').hidden = !on; }
  function showGridError(msg) {
    const el = document.getElementById('grid-error');
    if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; }
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
      const courses = await getCoursesPromise(state.clinic, state.firstTime);
      if (myToken !== state.fetchToken) return;
      state._coursesList = courses;
      renderCourses();
      // If previously selected courseId is no longer in the list (and not a promo), clear
      const stillValid =
        getActivePromos().some((p) => p.id === state.courseId) ||
        courses.some((c) => c.id === state.courseId);
      if (state.courseId && !stillValid) {
        state.courseId = null;
        state.selectedIso = null;
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
      if (String(state.courseId) === String(c.id)) btn.classList.add('is-selected');
      btn.dataset.courseId = String(c.id);
      const meta = [];
      if (c.duration) meta.push(`${c.duration}分`);
      if (typeof c.price === 'number') meta.push(fmtPrice(c.price));
      let descShort = '';
      if (c.description) {
        const txt = c.description.replace(/\\n|\n/g, ' ').slice(0, 90);
        descShort = txt + (c.description.length > 90 ? '…' : '');
      }
      btn.innerHTML =
        (c.isPromo ? '<span class="promo-badge">限定</span>' : '') +
        `<span class="choice-title">${escapeHtml(c.name || '')}</span>` +
        (meta.length ? `<span class="choice-meta">${meta.join(' / ')}</span>` : '') +
        (descShort ? `<span class="choice-desc">${escapeHtml(descShort)}</span>` : '');
      list.appendChild(btn);
    }
  }

  // -------------------------------------------------------------------
  // Step 3: availability fetch and grid render
  // -------------------------------------------------------------------

  async function fetchAvailability() {
    if (state.firstTime === null) return;
    const start = jstYmdCompact(state.weekStart);
    const end = jstYmdCompact(addDays(state.weekStart, 6));
    const url = `/api/availability?clinic=${state.clinic}&start=${start}&end=${end}&for_new=${state.firstTime}`;

    showGridLoading(true);
    showGridError(null);

    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        throw new Error(`サーバーエラー (${r.status}) ${body.slice(0, 120)}`);
      }
      const data = await r.json();
      state.availability = data;
      renderGrid();
    } catch (e) {
      const msg = (e && e.message) || '取得に失敗しました';
      showGridError(msg);
      state.availability = null;
      renderGrid();
    } finally {
      showGridLoading(false);
    }
  }

  function getSlotsForSelection() {
    if (!state.availability || !state.courseId) return [];
    const card = getSelectedCardObject();
    if (!card) return [];
    if (card.isPromo) {
      if (card.threeaseCourseId == null) {
        return state.availability.available.filter((a) => a.course_ids.length > 0);
      }
      return state.availability.available.filter((a) =>
        a.course_ids.indexOf(card.threeaseCourseId) !== -1
      );
    }
    return state.availability.available.filter((a) =>
      a.course_ids.indexOf(card.id) !== -1
    );
  }

  function renderGrid() {
    const grid = document.getElementById('grid');
    const empty = document.getElementById('grid-empty');
    grid.innerHTML = '';
    empty.hidden = true;

    // Week label
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

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(state.weekStart, i);
      const ymd = jstYmd(d);
      days.push({
        date: d,
        ymd,
        weekday: WEEKDAYS_JP[jstWeekdayIdx(d)],
        wIdx: jstWeekdayIdx(d),
        monthDay: fmtMonthDay(d),
      });
    }

    const timeSet = new Set();
    for (const d of days) {
      const m = byDate.get(d.ymd);
      if (m) for (const t of m.keys()) timeSet.add(t);
    }
    const times = [...timeSet].sort();

    if (times.length === 0) {
      empty.hidden = false;
      updateUpdatedAt();
      return;
    }

    const todayYmd = jstYmd(new Date());

    let html = '<div class="grid-table" role="table">';
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
          if (iso === state.selectedIso) cls.push('is-selected');
          html += `<button class="${cls.join(' ')}" data-iso="${iso}" aria-label="${d.monthDay} ${d.weekday} ${t} 予約可">●</button>`;
        } else {
          cls.push('none');
          html += `<div class="${cls.join(' ')}" aria-label="満員">―</div>`;
        }
      }
      html += '</div>';
    }
    html += '</div>';
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
      state.firstTime === null ? '—' : (state.firstTime ? '初回' : '2回目以降');
    document.getElementById('m-course').textContent = card ? card.name : '—';
    document.getElementById('m-datetime').textContent =
      state.selectedIso ? fmtDateTimeJp(state.selectedIso) : '—';

    // LINE message text
    const ta = document.getElementById('m-text');
    if (state.selectedIso && card) {
      const courseLine = buildCourseLine(card);
      const promoLine = card.isPromo
        ? `\n※ ${card.name.replace(/^【.*?】/, '')}（チラシご持参）`
        : '';
      ta.value =
`【予約希望】
院: ${clinic.name}
来院: ${state.firstTime ? '初回' : '2回目以降'}
${courseLine}
日時: ${fmtDateTimeJp(state.selectedIso)}${promoLine}
お名前:
ご連絡先: `;
    } else {
      ta.value = '';
    }

    // Phone link
    const phoneLink = document.getElementById('phone-link');
    const phoneNum = document.getElementById('phone-num');
    const phoneHours = document.getElementById('phone-hours');
    phoneLink.href = `tel:${clinic.phone.replace(/[^0-9+]/g, '')}`;
    phoneNum.textContent = clinic.phone;
    phoneHours.textContent = clinic.hours || '';

    // Threease link
    const threaseLink = document.getElementById('threease-link');
    threaseLink.href = clinic.threeaseUrl;
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
    if (!state.selectedIso) return;
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

    const lineUrl = CLINICS[state.clinic].lineUrl;
    setTimeout(() => {
      if (copied) window.location.href = lineUrl;
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
      // Reset downstream
      state.courseId = null;
      state.selectedIso = null;
      state.availability = null;
      state._coursesList = null;
      renderCourses();
      renderGrid();
      recomputeStepStates();
      prefetchCourses(state.clinic);
      if (state.firstTime !== null) {
        loadCoursesForCurrentSelection();
        fetchAvailability();
      }
      return;
    }

    // Step 1
    const ftBtn = e.target.closest('.choice[data-firsttime]');
    if (ftBtn) {
      const v = ftBtn.dataset.firsttime === 'true';
      const changed = state.firstTime !== v;
      state.firstTime = v;
      if (changed) {
        state.courseId = null;
        state.selectedIso = null;
        state.availability = null;
        state._coursesList = null;
      }
      document.querySelectorAll('.choice[data-firsttime]').forEach((b) => {
        b.classList.toggle('is-selected', b === ftBtn);
      });
      recomputeStepStates();
      activateStep(2);
      // Load courses (instant if cached) and start fetching availability in parallel
      loadCoursesForCurrentSelection();
      fetchAvailability();
      return;
    }

    // Step 2: course choice
    const courseBtn = e.target.closest('.course-card');
    if (courseBtn) {
      const raw = courseBtn.dataset.courseId;
      const id = /^\d+$/.test(raw) ? parseInt(raw, 10) : raw;
      if (state.courseId !== id) {
        state.courseId = id;
        state.selectedIso = null;
      }
      document.querySelectorAll('.course-card').forEach((b) => {
        b.classList.toggle('is-selected', b === courseBtn);
      });
      renderGrid();
      recomputeStepStates();
      activateStep(3);
      return;
    }

    // Step 3: time slot
    const slot = e.target.closest('.slot.avail');
    if (slot && slot.dataset.iso) {
      state.selectedIso = slot.dataset.iso;
      document.querySelectorAll('.slot.avail').forEach((b) => {
        b.classList.toggle('is-selected', b === slot);
      });
      recomputeStepStates();
      activateStep(4);
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

    // Week navigation
    if (e.target.id === 'prev-week') {
      state.weekStart = addDays(state.weekStart, -7);
      state.selectedIso = null;
      recomputeStepStates();
      fetchAvailability();
      return;
    }
    if (e.target.id === 'next-week') {
      state.weekStart = addDays(state.weekStart, 7);
      state.selectedIso = null;
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

  // Show promo banner if active
  if (state.promoCode) {
    const banner = document.getElementById('promo-banner');
    if (banner) banner.hidden = false;
  }

  // Fire prefetch immediately so course list is instant after step 1
  prefetchCourses(state.clinic);

  recomputeStepStates();
})();
