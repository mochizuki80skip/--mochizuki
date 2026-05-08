(function () {
  'use strict';

  const CLINICS = {
    '192': {
      name: 'リカバリー鍼灸院 長泉三島院',
      short: '長泉三島院',
      lineUrl: 'https://lin.ee/s6l4Yso',
    },
    '193': {
      name: 'リカバリー鍼灸院 裾野長泉院',
      short: '裾野長泉院',
      lineUrl: 'https://lin.ee/7RkbmAz',
    },
  };

  const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

  const state = {
    clinic: '192',
    firstTime: null,        // null | true | false
    courseId: null,         // number | null
    weekStart: jstMidnightOf(new Date()),
    selectedIso: null,      // string | null
    data: null,             // {courses, available} | null
    fetchToken: 0,
  };

  // ---- Date helpers (everything anchored in JST) ----

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

  // ---- Step state machine ----

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
  }

  function setStepState(n, state_, done) {
    const el = document.getElementById('step-' + n);
    if (!el) return;
    if (done) el.dataset.state = 'done';
    else el.dataset.state = state_;
  }

  function updateSummaries() {
    // Step 1
    const s1 = document.getElementById('sum-1');
    const e1 = document.querySelector('[data-edit="1"]');
    if (state.firstTime !== null) {
      s1.textContent = state.firstTime ? '初回' : '2回目以降';
      e1.hidden = false;
    } else {
      s1.textContent = '';
      e1.hidden = true;
    }

    // Step 2
    const s2 = document.getElementById('sum-2');
    const e2 = document.querySelector('[data-edit="2"]');
    const course = state.data && state.courseId
      ? state.data.courses.find((c) => c.id === state.courseId)
      : null;
    if (course) {
      s2.textContent = course.name;
      e2.hidden = false;
    } else {
      s2.textContent = '';
      e2.hidden = true;
    }

    // Step 3
    const s3 = document.getElementById('sum-3');
    const e3 = document.querySelector('[data-edit="3"]');
    if (state.selectedIso) {
      s3.textContent = fmtDateTimeJp(state.selectedIso);
      e3.hidden = false;
    } else {
      s3.textContent = '';
      e3.hidden = true;
    }
  }

  function activateStep(n) {
    const el = document.getElementById('step-' + n);
    if (el) el.dataset.state = 'active';
    if (el && el.scrollIntoView) {
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }

  // ---- Data fetch ----

  async function fetchData() {
    if (state.firstTime === null) return;
    const start = jstYmdCompact(state.weekStart);
    const end = jstYmdCompact(addDays(state.weekStart, 6));
    const url = `/api/availability?clinic=${state.clinic}&start=${start}&end=${end}&for_new=${state.firstTime}`;

    const myToken = ++state.fetchToken;

    showCoursesLoading(true);
    showCoursesError(null);
    showGridLoading(true);
    showGridError(null);

    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        throw new Error(`サーバーエラー (${r.status}) ${body.slice(0, 120)}`);
      }
      const data = await r.json();
      if (myToken !== state.fetchToken) return;
      state.data = data;
      // If previously selected courseId is gone from new course list, clear it
      if (state.courseId && !data.courses.find((c) => c.id === state.courseId)) {
        state.courseId = null;
        state.selectedIso = null;
      }
      renderCourses();
      renderGrid();
      recomputeStepStates();
    } catch (e) {
      if (myToken !== state.fetchToken) return;
      const msg = (e && e.message) || '取得に失敗しました';
      showCoursesError(msg);
      showGridError(msg);
      state.data = null;
      renderCourses();
      renderGrid();
      recomputeStepStates();
    } finally {
      if (myToken === state.fetchToken) {
        showCoursesLoading(false);
        showGridLoading(false);
      }
    }
  }

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

  // ---- Render: course list ----

  function renderCourses() {
    const list = document.getElementById('course-list');
    list.innerHTML = '';
    if (!state.data) return;
    const courses = state.data.courses || [];
    if (!courses.length) {
      list.innerHTML = '<div class="status">表示できるコースがありません</div>';
      return;
    }
    for (const c of courses) {
      const btn = document.createElement('button');
      btn.className = 'choice course-card';
      if (state.courseId === c.id) btn.classList.add('is-selected');
      btn.dataset.courseId = String(c.id);
      const meta = [];
      if (c.duration) meta.push(`${c.duration}分`);
      if (typeof c.price === 'number') meta.push(fmtPrice(c.price));
      btn.innerHTML =
        `<span class="choice-title">${escapeHtml(c.name || '')}</span>` +
        (meta.length ? `<span class="choice-meta">${meta.join(' / ')}</span>` : '') +
        (c.description ? `<span class="choice-desc">${escapeHtml(c.description.slice(0, 80))}${c.description.length > 80 ? '…' : ''}</span>` : '');
      list.appendChild(btn);
    }
  }

  // ---- Render: calendar grid ----

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

    if (!state.data || !state.courseId) {
      updateUpdatedAt();
      return;
    }

    // Filter availability by course_id
    const slotsForCourse = state.data.available.filter((a) => a.course_ids.indexOf(state.courseId) !== -1);

    // Group by date
    const byDate = new Map();
    for (const s of slotsForCourse) {
      const t = fmtTimeFromIso(s.iso);
      if (!byDate.has(s.date)) byDate.set(s.date, new Map());
      byDate.get(s.date).set(t, s.iso);
    }

    // Days array
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

    // Time labels: union of available times
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

  // ---- Render: LINE text ----

  function updateLineText() {
    if (!state.selectedIso) {
      document.getElementById('m-text').value = '';
      return;
    }
    const clinic = CLINICS[state.clinic];
    const course = state.data && state.courseId
      ? state.data.courses.find((c) => c.id === state.courseId)
      : null;

    document.getElementById('m-clinic').textContent = clinic.name;
    document.getElementById('m-firsttime').textContent = state.firstTime ? '初回' : '2回目以降';
    document.getElementById('m-course').textContent = course ? course.name : '—';
    document.getElementById('m-datetime').textContent = fmtDateTimeJp(state.selectedIso);

    const courseLine = course
      ? `コース: ${course.name}${course.duration ? ` (${course.duration}分` : ''}${typeof course.price === 'number' ? `${course.duration ? '・' : ' ('}${fmtPrice(course.price)}` : ''}${course.duration || typeof course.price === 'number' ? ')' : ''}`
      : '';

    const text =
`【予約希望】
院: ${clinic.name}
来院: ${state.firstTime ? '初回' : '2回目以降'}
${courseLine}
日時: ${fmtDateTimeJp(state.selectedIso)}
お名前:
ご連絡先: `;

    document.getElementById('m-text').value = text;
  }

  async function copyAndOpenLine() {
    if (!state.selectedIso) return;
    const ta = document.getElementById('m-text');
    const text = ta.value;
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch (e) {
      try {
        ta.removeAttribute('readonly');
        ta.focus();
        ta.select();
        copied = document.execCommand('copy');
        ta.setAttribute('readonly', 'readonly');
      } catch (e2) {
        copied = false;
      }
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

  // ---- Helpers ----

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---- Event wiring ----

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
      // Clinic change resets everything below
      state.courseId = null;
      state.selectedIso = null;
      state.data = null;
      renderCourses();
      renderGrid();
      updateLineText();
      recomputeStepStates();
      if (state.firstTime !== null) fetchData();
      return;
    }

    // Step 1: first-time choice
    const ftBtn = e.target.closest('.choice[data-firsttime]');
    if (ftBtn) {
      const v = ftBtn.dataset.firsttime === 'true';
      if (state.firstTime !== v) {
        state.firstTime = v;
        // Reset downstream
        state.courseId = null;
        state.selectedIso = null;
        state.data = null;
      }
      // Visual select
      document.querySelectorAll('.choice[data-firsttime]').forEach((b) => {
        b.classList.toggle('is-selected', b === ftBtn);
      });
      updateLineText();
      recomputeStepStates();
      activateStep(2);
      fetchData();
      return;
    }

    // Step 2: course choice
    const courseBtn = e.target.closest('.course-card');
    if (courseBtn) {
      const id = parseInt(courseBtn.dataset.courseId, 10);
      if (state.courseId !== id) {
        state.courseId = id;
        state.selectedIso = null;
      }
      document.querySelectorAll('.course-card').forEach((b) => {
        b.classList.toggle('is-selected', b === courseBtn);
      });
      updateLineText();
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
      updateLineText();
      recomputeStepStates();
      activateStep(4);
      return;
    }

    // Edit buttons (collapse-back)
    const edit = e.target.closest('.step-edit');
    if (edit) {
      const n = parseInt(edit.dataset.edit, 10);
      if (n === 1) { /* keep current selection but show as active */ }
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
      updateLineText();
      recomputeStepStates();
      fetchData();
      return;
    }
    if (e.target.id === 'next-week') {
      state.weekStart = addDays(state.weekStart, 7);
      state.selectedIso = null;
      updateLineText();
      recomputeStepStates();
      fetchData();
      return;
    }

    // Copy & go
    if (e.target.id === 'copy-and-go') {
      copyAndOpenLine();
      return;
    }
  });

  // ---- Init ----
  recomputeStepStates();
})();
