(function () {
  'use strict';

  const CLINICS = {
    '192': { name: 'リカバリー鍼灸院 長泉三島院', short: '長泉三島院' },
    '193': { name: 'リカバリー鍼灸院 裾野長泉院', short: '裾野長泉院' },
  };

  // 公式LINEのURL（lin.ee の短縮URL や https://line.me/R/ti/p/@xxxx 形式）
  // 公開前にここを差し替えてください
  const LINE_URL = 'https://lin.ee/REPLACE_ME';

  const WEEKDAYS_JP = ['日', '月', '火', '水', '木', '金', '土'];

  const state = {
    clinic: '192',
    weekStart: jstMidnightOf(new Date()),
    firstTime: false,
    data: null,
    selectedIso: null,
    fetchToken: 0,
  };

  // ---- Date helpers (everything anchored in JST) ----

  function jstYmd(d) {
    // returns "YYYY-MM-DD" in JST
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  }

  function jstYmdCompact(d) {
    return jstYmd(d).replace(/-/g, '');
  }

  function jstMidnightOf(d) {
    // Returns a Date that represents 00:00 JST of d's calendar day in JST.
    return new Date(jstYmd(d) + 'T00:00:00+09:00');
  }

  function addDays(d, n) {
    return new Date(d.getTime() + n * 86400000);
  }

  function jstWeekdayIdx(d) {
    // 0=Sun..6=Sat in JST
    const ymd = jstYmd(d);
    return new Date(ymd + 'T00:00:00+09:00').getUTCDay();
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
    const dateMatch = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!dateMatch) return iso;
    const [, y, mo, da, hh, mm] = dateMatch;
    const d = new Date(`${y}-${mo}-${da}T00:00:00+09:00`);
    const w = WEEKDAYS_JP[d.getUTCDay()];
    return `${y}年${parseInt(mo, 10)}月${parseInt(da, 10)}日(${w}) ${hh}:${mm}`;
  }

  // ---- Fetching ----

  async function fetchAvailability() {
    const start = jstYmdCompact(state.weekStart);
    const end = jstYmdCompact(addDays(state.weekStart, 6));
    const url = `/api/availability?clinic=${state.clinic}&start=${start}&end=${end}`;

    const myToken = ++state.fetchToken;

    showLoading(true);
    showError(null);

    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) {
        const body = await r.text().catch(() => '');
        throw new Error(`サーバーエラー (${r.status}) ${body.slice(0, 120)}`);
      }
      const data = await r.json();
      if (myToken !== state.fetchToken) return; // stale
      state.data = data;
      render();
    } catch (e) {
      if (myToken !== state.fetchToken) return;
      showError(e && e.message ? e.message : '取得に失敗しました');
      state.data = null;
      render();
    } finally {
      if (myToken === state.fetchToken) showLoading(false);
    }
  }

  function showLoading(on) {
    document.getElementById('loading').hidden = !on;
  }

  function showError(msg) {
    const el = document.getElementById('error');
    if (msg) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  // ---- Rendering ----

  function render() {
    const grid = document.getElementById('grid');
    const empty = document.getElementById('empty');

    // Update week label
    const start = state.weekStart;
    const end = addDays(start, 6);
    const startYmd = jstYmd(start);
    const endYmd = jstYmd(end);
    document.getElementById('week-label').textContent =
      `${startYmd.slice(0, 4)}/${startYmd.slice(5, 7)}/${startYmd.slice(8, 10)} 〜 ${endYmd.slice(5, 7)}/${endYmd.slice(8, 10)}`;

    const slots = (state.data && state.data.calendar && state.data.calendar.available_slots) || [];

    // Build per-day available time set
    const byDate = new Map();
    for (const day of slots) {
      const set = new Set((day.available_times || []).map(fmtTimeFromIso));
      byDate.set(day.date, set);
    }

    // Build day list (7 days from week start)
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

    // Build sorted union of times
    const timeSet = new Set();
    for (const d of days) {
      const set = byDate.get(d.ymd);
      if (set) for (const t of set) timeSet.add(t);
    }
    const times = [...timeSet].sort();

    if (times.length === 0) {
      grid.innerHTML = '';
      empty.hidden = false;
      updateUpdatedAt();
      return;
    }
    empty.hidden = true;

    const todayYmd = jstYmd(new Date());

    // Build header row
    let html = '<div class="grid-table" role="table" aria-label="空き状況">';
    html += '<div class="grid-row grid-header" role="row">';
    html += '<div class="cell time-label-cell" role="columnheader"></div>';
    for (const d of days) {
      const cls = ['day-cell'];
      if (d.ymd === todayYmd) cls.push('is-today');
      if (d.wIdx === 0) cls.push('is-sun');
      if (d.wIdx === 6) cls.push('is-sat');
      html += `<div class="cell ${cls.join(' ')}" role="columnheader">`;
      html += `<span class="day-wday">${d.weekday}</span>`;
      html += `<span class="day-md">${d.monthDay}</span>`;
      html += '</div>';
    }
    html += '</div>';

    // Body rows
    for (const t of times) {
      html += '<div class="grid-row" role="row">';
      html += `<div class="cell time-label-cell" role="rowheader">${t}</div>`;
      for (const d of days) {
        const set = byDate.get(d.ymd);
        const avail = set ? set.has(t) : false;
        const cellCls = ['cell', 'slot'];
        if (d.wIdx === 0) cellCls.push('is-sun');
        if (d.wIdx === 6) cellCls.push('is-sat');
        if (avail) {
          const iso = `${d.ymd}T${t}:00+09:00`;
          cellCls.push('avail');
          html += `<button class="${cellCls.join(' ')}" data-iso="${iso}" aria-label="${d.monthDay} ${d.weekday} ${t} 予約可">○</button>`;
        } else {
          cellCls.push('none');
          html += `<div class="${cellCls.join(' ')}" aria-label="満員">―</div>`;
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

  // ---- Modal ----

  function openModal(iso) {
    state.selectedIso = iso;
    updateModalText();
    const modal = document.getElementById('modal');
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    state.selectedIso = null;
    document.getElementById('modal').hidden = true;
    document.body.classList.remove('modal-open');
  }

  function updateModalText() {
    if (!state.selectedIso) return;
    const clinicName = CLINICS[state.clinic].name;
    const dt = fmtDateTimeJp(state.selectedIso);
    const ft = state.firstTime ? '初回' : '2回目以降';

    document.getElementById('m-clinic').textContent = clinicName;
    document.getElementById('m-datetime').textContent = dt;
    document.getElementById('m-firsttime').textContent = ft;

    const text =
`【予約希望】
院: ${clinicName}
日時: ${dt}
来院: ${ft}
お名前:
ご連絡先: `;

    document.getElementById('m-text').value = text;
  }

  async function copyAndOpenLine() {
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

    setTimeout(() => {
      if (copied) window.location.href = LINE_URL;
      btn.textContent = orig;
      btn.disabled = false;
    }, 600);
  }

  // ---- Event wiring ----

  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) {
      if (tab.classList.contains('is-active')) return;
      document.querySelectorAll('.tab').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      state.clinic = tab.dataset.clinic;
      fetchAvailability();
      return;
    }

    if (e.target.id === 'prev-week') {
      state.weekStart = addDays(state.weekStart, -7);
      fetchAvailability();
      return;
    }
    if (e.target.id === 'next-week') {
      state.weekStart = addDays(state.weekStart, 7);
      fetchAvailability();
      return;
    }

    const toggle = e.target.closest('.firsttime-toggle .toggle');
    if (toggle) {
      if (toggle.classList.contains('is-active')) return;
      document.querySelectorAll('.firsttime-toggle .toggle').forEach((t) => {
        const on = t === toggle;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-checked', on ? 'true' : 'false');
      });
      state.firstTime = toggle.dataset.firsttime === 'true';
      if (state.selectedIso) updateModalText();
      return;
    }

    const slot = e.target.closest('.slot.avail');
    if (slot && slot.dataset.iso) {
      openModal(slot.dataset.iso);
      return;
    }

    if (e.target.id === 'modal-close' || e.target.dataset.close === '1') {
      closeModal();
      return;
    }

    if (e.target.id === 'copy-and-go') {
      copyAndOpenLine();
      return;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('modal').hidden) {
      closeModal();
    }
  });

  // ---- Init ----

  fetchAvailability();
})();
