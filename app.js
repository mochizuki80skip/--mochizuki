// Arrows Vision Training - PWA
(() => {
  'use strict';

  // ===== Screen navigation =====
  const screens = {
    menu: document.getElementById('screen-menu'),
    'settings-kva': document.getElementById('screen-settings-kva'),
    kva: document.getElementById('screen-kva'),
    'settings-eye': document.getElementById('screen-settings-eye'),
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

  // ===== Segmented control =====
  const settings = {
    'kva-speed': 'normal',
    'kva-size': 'medium',
    'kva-path': 'h',
    'kva-charset': 'num',
    'kva-count': '10',
    'eye-show': '500',
    'eye-gap': '500',
    'eye-count': '20',
  };
  document.querySelectorAll('.seg').forEach(seg => {
    const key = seg.dataset.key;
    seg.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        seg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        settings[key] = b.dataset.val;
      });
    });
  });

  // ===== Shared result state =====
  let lastMode = null; // 'kva' | 'eye'
  const results = { correct: 0, total: 0, rtList: [] };
  function resetResults() {
    results.correct = 0;
    results.total = 0;
    results.rtList = [];
  }
  function showResult() {
    const rate = results.total ? Math.round((results.correct / results.total) * 100) : 0;
    const rt = results.rtList.length
      ? Math.round(results.rtList.reduce((a, b) => a + b, 0) / results.rtList.length)
      : null;
    document.getElementById('r-rate').textContent = rate + '%';
    document.getElementById('r-correct').textContent = results.correct;
    document.getElementById('r-total').textContent = results.total;
    document.getElementById('r-rt').textContent = rt == null ? '-' : rt;
    show('result');
  }
  document.getElementById('r-retry').addEventListener('click', () => {
    if (lastMode === 'kva') startKva();
    else if (lastMode === 'eye') startEye();
    else show('menu');
  });

  // ===== KVA (Dynamic Visual Acuity) =====
  const SPEED_MS = { slow: 2200, normal: 1500, fast: 1000, ultra: 650 };
  const SIZE_PX = { small: 56, medium: 96, large: 140 };
  const CHARSETS = {
    num: '0123456789'.split(''),
    alpha: 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split(''), // exclude I, O to avoid confusion with 1, 0
    mix: '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'.split(''),
  };
  const PATHS = ['h', 'v', 'd'];

  const kvaStage = document.getElementById('kva-stage');
  const kvaChar = document.getElementById('kva-char');
  const kvaAnswer = document.getElementById('kva-answer');
  const kvaInput = document.getElementById('kva-input');
  const kvaSubmit = document.getElementById('kva-submit');
  const kvaProgress = document.getElementById('kva-progress');

  let kvaState = null;

  function startKva() {
    lastMode = 'kva';
    resetResults();
    kvaState = {
      total: parseInt(settings['kva-count'], 10),
      idx: 0,
      current: null,
      charset: CHARSETS[settings['kva-charset']],
      duration: SPEED_MS[settings['kva-speed']],
      size: SIZE_PX[settings['kva-size']],
      pathMode: settings['kva-path'],
      animId: null,
    };
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

    // Compute start/end positions (CSS transform translate)
    // kvaChar is positioned at top:50%, left:0, and we translate to position
    let sx, sy, ex, ey;
    const margin = kvaState.size;
    switch (path) {
      case 'v': {
        const x = margin + Math.random() * (W - margin * 2);
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
        const y = margin + Math.random() * (H - margin * 2);
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
        // done, ask for input
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
    // RT here is "time to answer after the character finished", tracked for context
    results.rtList.push(Math.round(performance.now() - kvaState.promptTime));
    kvaAnswer.classList.add('hidden');
    nextKva();
  }
  kvaSubmit.addEventListener('click', submitKvaAnswer);
  kvaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submitKvaAnswer(); }
  });

  document.getElementById('start-kva').addEventListener('click', startKva);
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

  let eyeState = null;

  function startEye() {
    lastMode = 'eye';
    resetResults();
    eyeState = {
      total: parseInt(settings['eye-count'], 10),
      idx: 0,
      showMs: parseInt(settings['eye-show'], 10),
      gapMs: parseInt(settings['eye-gap'], 10),
      current: null,
      activeCell: null,
      showTime: 0,
      locked: false,
      timers: [],
    };
    show('eye');
    clearEye();
    eyeHint.textContent = '表示された記号をタップ';
    scheduleNextEye(eyeState.gapMs);
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

  function scheduleNextEye(delay) {
    eyeState.timers.push(setTimeout(nextEye, delay));
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

    // Hide after showMs, but keep accepting answer until user responds
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
    // Ensure symbol is shown as feedback even if already hidden
    cell.textContent = eyeState.current === 'circle' ? '○' : '△';
    cell.classList.remove('flash');
    cell.classList.add(correct ? 'correct' : 'wrong');

    choices.forEach(c => {
      const isThis = c.dataset.ans === ans;
      if (isThis) c.classList.add(correct ? 'locked-correct' : 'locked-wrong');
      c.disabled = true;
    });
    eyeHint.textContent = correct ? `正解 (${rt}ms)` : `不正解 - 正解は ${eyeState.current === 'circle' ? '○' : '△'}`;

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

  document.getElementById('start-eye').addEventListener('click', startEye);
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

  // Initial screen
  show('menu');
})();
