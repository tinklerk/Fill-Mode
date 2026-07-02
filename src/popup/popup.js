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

function formatSize(width, height) {
  if (!width || !height) return t('notDetected');
  return `${width}x${height} (${(width / height).toFixed(3)})`;
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

document.getElementById('reset').addEventListener('click', () => {
  patchState({ enabled: false, mode: 'preset', manualScale: 1, panX: 0, panY: 0 });
});

document.getElementById('open-options').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

localize();
renderPresets();
refresh();
