// ARROWS EYE - Vision Training PWA
(() => {
  'use strict';

  // ===== Screen navigation =====
  const screens = {
    menu: document.getElementById('screen-menu'),
    'mode-test': document.getElementById('screen-mode-test'),
    'mode-train': document.getElementById('screen-mode-train'),
    kva: document.getElementById('screen-kva'),
    eye: document.getElementById('screen-eye'),
    result: document.getElementById('screen-result'),
  };
  function show(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => show(btn.dataset.goto));
  });

  // ===== Rank pickers =====
  // Each picker identified by data-rank-for, e.g. "test-kva", "train-kva", etc.
  const ranks = {
    'test-kva': 3, 'test-eye': 3,
    'train-kva': 3, 'train-eye': 3,
  };
  function clampRank(n) { return Math.max(1, Math.min(5, n)); }
  document.querySelectorAll('.rank-picker').forEach(picker => {
    const key = picker.dataset.rankFor;
    const valEl = picker.querySelector('.rank-val');
    picker.querySelectorAll('.rank-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const delta = parseInt(btn.dataset.delta, 10);
        ranks[key] = clampRank(ranks[key] + delta);
        valEl.textContent = ranks[key];
      });
    });
  });

  // ===== Preset parameters per rank =====
  // KVA presets: duration(ms) speed, char size, path mode, charset, count
  const KVA_PRESETS = {
    1: { duration: 2200, size: 140, path: 'h',      charset: 'num',   count: 5 },
    2: { duration: 1700, size: 120, path: 'h',      charset: 'num',   count: 8 },
    3: { duration: 1300, size: 96,  path: 'h',      charset: 'num',   count: 10 },
    4: { duration: 950,  size: 80,  path: 'random', charset: 'mix',   count: 12 },
    5: { duration: 650,  size: 64,  path: 'random', charset: 'mix',   count: 15 },
  };
  // Eye presets: showMs, gapMs, count
  const EYE_PRESETS = {
    1: { showMs: 1400, gapMs: 700, count: 10 },
    2: { showMs: 1000, gapMs: 600, count: 15 },
    3: { showMs: 700,  gapMs: 500, count: 20 },
    4: { showMs: 500,  gapMs: 400, count: 25 },
    5: { showMs: 300,  gapMs: 300, count: 30 },
  };
  // For "test" mode, use slightly reduced question count for a quick measurement
  function testify(preset, type) {
    const count = type === 'kva' ? 10 : 15;
    return { ...preset, count };
  }

  const CHARSETS = {
    num: '0123456789'.split(''),
    alpha: 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split(''),
    mix: '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'.split(''),
  };
  const PATHS = ['h', 'v', 'd'];

  // ===== Drill launcher =====
  // Clicking any hex-card with data-mode+data-drill launches that drill.
  document.querySelectorAll('.hex-card[data-drill]').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;   // 'test' | 'train'
      const drill = card.dataset.drill; // 'kva' | 'eye'
      const rank = ranks[`${mode}-${drill}`];
      launchDrill(mode, drill, rank);
    });
  });

  // ===== Shared session state =====
  const session = {
    mode: null,   // 'test' | 'train'
    drill: null,  // 'kva' | 'eye'
    rank: 3,
  };
  const results = { correct: 0, total: 0, rtList: [] };
  function resetResults() {
    results.correct = 0;
    results.total = 0;
    results.rtList = [];
  }

  function launchDrill(mode, drill, rank) {
    session.mode = mode;
    session.drill = drill;
    session.rank = rank;
    resetResults();
    if (drill === 'kva') startKva();
    else startEye();
  }

  function modeLabel() {
    return session.mode === 'test' ? 'TEST' : 'TRAINING';
  }

  function showResult() {
    const rate = results.total ? Math.round((results.correct / results.total) * 100) : 0;
    const rt = results.rtList.length
      ? Math.round(results.rtList.reduce((a, b) => a + b, 0) / results.rtList.length)
      : null;
    document.getElementById('r-rate').firstChild.textContent = rate;
    document.getElementById('r-correct').textContent = results.correct;
    document.getElementById('r-total').textContent = results.total;
    document.getElementById('r-rt').textContent = rt == null ? '-' : rt;
    const titleEn = session.mode === 'test' ? 'Test result' : 'Training result';
    const titleJa = session.mode === 'test' ? 'テスト結果' : 'トレーニング結果';
    document.getElementById('result-title').textContent = titleEn;
    document.getElementById('result-subtitle').textContent = titleJa;
    show('result');
  }

  document.getElementById('r-retry').addEventListener('click', () => {
    if (!session.mode) return show('menu');
    launchDrill(session.mode, session.drill, session.rank);
  });

  // ===== KVA (Dynamic Visual Acuity) =====
  const kvaStage = document.getElementById('kva-stage');
  const kvaChar = document.getElementById('kva-char');
  const kvaAnswer = document.getElementById('kva-answer');
  const kvaInput = document.getElementById('kva-input');
  const kvaSubmit = document.getElementById('kva-submit');
  const kvaProgress = document.getElementById('kva-progress');
  const kvaModeLabel = document.getElementById('kva-mode-label');

  let kvaState = null;

  function startKva() {
    let preset = KVA_PRESETS[session.rank];
    if (session.mode === 'test') preset = testify(preset, 'kva');
    kvaState = {
      total: preset.count,
      idx: 0,
      current: null,
      charset: CHARSETS[preset.charset],
      duration: preset.duration,
      size: preset.size,
      pathMode: preset.path,
      animId: null,
    };
    kvaModeLabel.textContent = modeLabel();
    show('kva');
    kvaAnswer.classList.add('hidden');
    nextKva();
  }

  function pickPath() {
    return kvaState.pathMode === 'random'
      ? PATHS[Math.floor(Math.random() * PATHS.length)]
      : kvaState.pathMode;
  }

  function nextKva() {
    if (kvaState.idx >= kvaState.total) {
      showResult();
      return;
    }
    kvaState.idx++;
    kvaProgress.textContent = `${kvaState.idx} / ${kvaState.total}`;

    const ch = kvaState.charset[Math.floor(Math.random() * kvaState.charset.length)];
    kvaState.current = ch;
    kvaChar.textContent = ch;
    kvaChar.style.fontSize = kvaState.size + 'px';

    const rect = kvaStage.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    const path = pickPath();
    const margin = kvaState.size;
    let sx, sy, ex, ey;
    switch (path) {
      case 'v': {
        const x = margin + Math.random() * Math.max(0, W - margin * 2);
        const dir = Math.random() < 0.5 ? 1 : -1;
        sx = x; ex = x;
        sy = dir > 0 ? -margin : H + margin;
        ey = dir > 0 ? H + margin : -margin;
        break;
      }
      case 'd': {
        const dir = Math.random() < 0.5 ? 1 : -1;
        const down = Math.random() < 0.5 ? 1 : -1;
        sx = dir > 0 ? -margin : W + margin;
        ex = dir > 0 ? W + margin : -margin;
        sy = down > 0 ? -margin : H + margin;
        ey = down > 0 ? H + margin : -margin;
        break;
      }
      case 'h':
      default: {
        const y = margin + Math.random() * Math.max(0, H - margin * 2);
        const dir = Math.random() < 0.5 ? 1 : -1;
        sx = dir > 0 ? -margin : W + margin;
        ex = dir > 0 ? W + margin : -margin;
        sy = y; ey = y;
        break;
      }
    }

    const start = performance.now();
    const duration = kvaState.duration;

    function frame(t) {
      const p = Math.min(1, (t - start) / duration);
      const x = sx + (ex - sx) * p;
      const y = sy + (ey - sy) * p;
      kvaChar.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      if (p < 1) {
        kvaState.animId = requestAnimationFrame(frame);
      } else {
        kvaChar.style.transform = `translate(-200px, -200px)`;
        promptKvaAnswer();
      }
    }
    kvaState.animId = requestAnimationFrame(frame);
  }

  function promptKvaAnswer() {
    kvaAnswer.classList.remove('hidden');
    kvaInput.value = '';
    kvaState.promptTime = performance.now();
    setTimeout(() => kvaInput.focus(), 50);
  }

  function submitKvaAnswer() {
    const raw = (kvaInput.value || '').trim().toUpperCase();
    if (!raw) return;
    const ans = raw[0];
    const correct = ans === kvaState.current.toUpperCase();
    results.total++;
    if (correct) results.correct++;
    results.rtList.push(Math.round(performance.now() - kvaState.promptTime));
    kvaAnswer.classList.add('hidden');
    nextKva();
  }
  kvaSubmit.addEventListener('click', submitKvaAnswer);
  kvaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitKvaAnswer(); }
  });

  document.getElementById('kva-quit').addEventListener('click', () => {
    if (kvaState && kvaState.animId) cancelAnimationFrame(kvaState.animId);
    show('menu');
  });

  // ===== Eye Movement (3x3 grid) =====
  const grid = document.querySelector('.grid3');
  const cells = grid ? Array.from(grid.querySelectorAll('.cell')) : [];
  const choices = document.querySelectorAll('.choice');
  const eyeProgress = document.getElementById('eye-progress');
  const eyeHint = document.getElementById('eye-hint');
  const eyeModeLabel = document.getElementById('eye-mode-label');

  let eyeState = null;

  function startEye() {
    let preset = EYE_PRESETS[session.rank];
    if (session.mode === 'test') preset = testify(preset, 'eye');
    eyeState = {
      total: preset.count,
      idx: 0,
      showMs: preset.showMs,
      gapMs: preset.gapMs,
      current: null,
      activeCell: null,
      showTime: 0,
      locked: false,
      timers: [],
    };
    eyeModeLabel.textContent = modeLabel();
    show('eye');
    clearEye();
    eyeHint.textContent = '表示された記号をタップ';
    eyeState.timers.push(setTimeout(nextEye, eyeState.gapMs));
  }

  function clearEye() {
    cells.forEach(c => {
      c.textContent = '';
      c.classList.remove('flash', 'correct', 'wrong');
    });
    choices.forEach(c => {
      c.classList.remove('locked-correct', 'locked-wrong');
      c.disabled = false;
    });
  }

  function nextEye() {
    if (!eyeState) return;
    if (eyeState.idx >= eyeState.total) {
      showResult();
      return;
    }
    eyeState.idx++;
    eyeProgress.textContent = `${eyeState.idx} / ${eyeState.total}`;

    const cellIdx = Math.floor(Math.random() * 9);
    const sym = Math.random() < 0.5 ? 'circle' : 'triangle';
    const cell = cells[cellIdx];
    cell.textContent = sym === 'circle' ? '○' : '△';
    cell.classList.add('flash');

    eyeState.current = sym;
    eyeState.activeCell = cell;
    eyeState.showTime = performance.now();
    eyeState.locked = false;

    eyeState.timers.push(setTimeout(() => {
      if (eyeState && eyeState.activeCell === cell && !eyeState.locked) {
        cell.textContent = '';
      }
    }, eyeState.showMs));
  }

  function answerEye(ans) {
    if (!eyeState || !eyeState.current || eyeState.locked) return;
    eyeState.locked = true;
    const rt = Math.round(performance.now() - eyeState.showTime);
    const correct = ans === eyeState.current;
    results.total++;
    if (correct) results.correct++;
    results.rtList.push(rt);

    const cell = eyeState.activeCell;
    cell.textContent = eyeState.current === 'circle' ? '○' : '△';
    cell.classList.remove('flash');
    cell.classList.add(correct ? 'correct' : 'wrong');

    choices.forEach(c => {
      const isThis = c.dataset.ans === ans;
      if (isThis) c.classList.add(correct ? 'locked-correct' : 'locked-wrong');
      c.disabled = true;
    });
    eyeHint.textContent = correct
      ? `正解 (${rt}ms)`
      : `不正解 - 正解は ${eyeState.current === 'circle' ? '○' : '△'}`;

    eyeState.timers.push(setTimeout(() => {
      if (!eyeState) return;
      clearEye();
      eyeHint.textContent = '表示された記号をタップ';
      nextEye();
    }, eyeState.gapMs + 400));
  }

  choices.forEach(btn => {
    btn.addEventListener('click', () => answerEye(btn.dataset.ans));
  });

  function clearEyeTimers() {
    if (!eyeState) return;
    eyeState.timers.forEach(t => clearTimeout(t));
    eyeState.timers = [];
  }

  document.getElementById('eye-quit').addEventListener('click', () => {
    clearEyeTimers();
    eyeState = null;
    show('menu');
  });

  // ===== Service worker =====
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  show('menu');
})();
