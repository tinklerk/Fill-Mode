// Fill Mode — popup UI

const LANDSCAPE = ['16:10', '16:9', '18:9', '21:9', '32:9'];
const PORTRAIT = ['9:16', '9:18', '9:21', '10:16', '3:4'];

let currentState = null;

const t = (key) => chrome.i18n.getMessage(key);

function localize() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.getElementById('enable-label').title = t('enable');
}

function parseRatioInput(input) {
  const m = input.trim().match(/^(\d+(?:\.\d+)?)\s*[:x]\s*(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const w = parseFloat(m[1]);
  const h = parseFloat(m[2]);
  if (w <= 0 || h <= 0) return null;
  return { w, h, ratio: w / h };
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function sendToContent(message) {
  const tab = await activeTab();
  if (!tab?.id) return null;
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch {
    return null; // content script 없는 페이지
  }
}

async function patchState(patch) {
  await sendToContent({ type: 'setState', patch });
  await refresh();
}

// 아래 프리셋 선택지와 비교하기 쉽도록 비율을 W:H 형식으로 표시
const RATIO_LABELS = [
  ['32:9', 32 / 9],
  ['21:9', 21 / 9],
  ['18:9', 18 / 9],
  ['16:9', 16 / 9],
  ['16:10', 16 / 10],
  ['4:3', 4 / 3],
  ['1:1', 1],
  ['3:4', 3 / 4],
  ['10:16', 10 / 16],
  ['9:16', 9 / 16],
  ['9:18', 9 / 18],
  ['9:21', 9 / 21],
];

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function ratioLabel(width, height) {
  const g = gcd(width, height);
  const rw = width / g;
  const rh = height / g;
  if (rw <= 32 && rh <= 32) return `${rw}:${rh}`;
  // 약분이 안 되는 해상도(1366x768 등)는 가장 가까운 통용 비율로 근사
  const ratio = width / height;
  let best = null;
  let bestDiff = Infinity;
  for (const [label, value] of RATIO_LABELS) {
    const diff = Math.abs(ratio - value) / value;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = label;
    }
  }
  return bestDiff < 0.03 ? `≈${best}` : ratio.toFixed(3);
}

function formatSize(width, height) {
  if (!width || !height) return t('notDetected');
  return `${width}x${height} (${ratioLabel(width, height)})`;
}

async function refresh() {
  const res = await sendToContent({ type: 'getState' });
  currentState = res?.state ?? null;

  document.getElementById('monitor-ratio').textContent = formatSize(screen.width, screen.height);
  document.getElementById('video-ratio').textContent = formatSize(
    res?.videoWidth,
    res?.videoHeight
  );
  document.getElementById('enabled').checked = !!currentState?.enabled;

  const scale =
    currentState?.mode === 'manual' ? currentState.manualScale : res?.appliedScale ?? 1;
  document.getElementById('scale-value').textContent = `x${scale.toFixed(2)}`;

  panLocal.panX = clampPan(currentState?.panX ?? 0);
  panLocal.panY = clampPan(currentState?.panY ?? 0);
  document.getElementById('pan-x').value = panLocal.panX;
  document.getElementById('pan-y').value = panLocal.panY;

  document.querySelectorAll('.preset-row button').forEach((btn) => {
    btn.classList.toggle(
      'active',
      !!currentState?.enabled &&
        currentState.mode === 'preset' &&
        btn.dataset.presetId === currentState.presetId
    );
  });
}

function renderPresets() {
  const rows = {
    landscape: document.querySelector('[data-orientation="landscape"]'),
    portrait: document.querySelector('[data-orientation="portrait"]'),
  };
  for (const [orientation, ids] of [['landscape', LANDSCAPE], ['portrait', PORTRAIT]]) {
    for (const id of ids) {
      const btn = document.createElement('button');
      btn.textContent = id;
      btn.dataset.presetId = id;
      btn.addEventListener('click', () =>
        patchState({ enabled: true, mode: 'preset', presetId: id })
      );
      rows[orientation].appendChild(btn);
    }
  }
}

document.getElementById('enabled').addEventListener('change', (e) => {
  patchState({ enabled: e.target.checked });
});

document.getElementById('zoom-in').addEventListener('click', async () => {
  const base = currentState?.mode === 'manual' ? currentState.manualScale : 1;
  await patchState({ enabled: true, mode: 'manual', manualScale: Math.min(4, base + 0.05) });
});

document.getElementById('zoom-out').addEventListener('click', async () => {
  const base = currentState?.mode === 'manual' ? currentState.manualScale : 1;
  await patchState({ enabled: true, mode: 'manual', manualScale: Math.max(0.5, base - 0.05) });
});

document.getElementById('custom-apply').addEventListener('click', () => {
  const parsed = parseRatioInput(document.getElementById('custom-input').value);
  if (!parsed) {
    document.getElementById('custom-input').setCustomValidity(t('invalidFormat'));
    document.getElementById('custom-input').reportValidity();
    return;
  }
  patchState({ enabled: true, mode: 'custom', customRatio: parsed });
});

const clampPan = (v) => Math.min(50, Math.max(-50, Number(v) || 0));

// D-pad 이동 중 refresh()가 돌아오기 전에도 다음 스텝이 이어지도록 로컬 미러를 둔다
const panLocal = { panX: 0, panY: 0 };

// 짧게 누르면 1%, 길게 누르면 연속 이동
document.querySelectorAll('.pan-step').forEach((btn) => {
  const axis = btn.dataset.axis;
  const dir = Number(btn.dataset.dir);
  const step = () => {
    panLocal[axis] = clampPan(panLocal[axis] + dir);
    patchState({ [axis]: panLocal[axis] });
  };
  let delay = null;
  let repeat = null;
  const stop = () => {
    clearTimeout(delay);
    clearInterval(repeat);
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    step();
    delay = setTimeout(() => {
      repeat = setInterval(step, 90);
    }, 350);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) =>
    btn.addEventListener(ev, stop)
  );
});

document.getElementById('pan-x').addEventListener('change', (e) => {
  patchState({ panX: clampPan(e.target.value) });
});

document.getElementById('pan-y').addEventListener('change', (e) => {
  patchState({ panY: clampPan(e.target.value) });
});

document.getElementById('pan-reset').addEventListener('click', () => {
  patchState({ panX: 0, panY: 0 });
});

document.getElementById('reset').addEventListener('click', () => {
  patchState({ enabled: false, mode: 'preset', manualScale: 1, panX: 0, panY: 0 });
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// 단축키 안내 — 설정 페이지에서 변경한 키맵을 그대로 표시
const DEFAULT_KEYMAP = { toggle: 'z', cycle: 'x', zoomOut: '[', zoomIn: ']', panReset: 'x' };

async function renderShortcuts() {
  const { settings } = await chrome.storage.sync.get('settings');
  const keymap = { ...DEFAULT_KEYMAP, ...settings?.keymap };
  document.querySelectorAll('kbd[data-key]').forEach((el) => {
    const key = keymap[el.dataset.key];
    const label = key.length === 1 ? key.toUpperCase() : key;
    el.textContent = el.dataset.key === 'panReset' ? `Shift + ${label}` : label;
  });
}

localize();
renderPresets();
renderShortcuts();
refresh();
