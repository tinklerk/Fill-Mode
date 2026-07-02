// Fill Mode — options page

const DEFAULTS = {
  persistence: 'session',
  transitionSpeed: 300,
  ratioSource: 'screen',
};

// content.js의 FM_DEFAULT_KEYMAP과 동일해야 한다
const DEFAULT_KEYMAP = { toggle: 'z', cycle: 'x', zoomOut: '[', zoomIn: ']', panReset: 'x' };

const t = (key) => chrome.i18n.getMessage(key);

function localize() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.title = t('optionsTitle');
}

// panReset은 Shift 조합, 나머지는 단독 키
function keyLabel(action, key) {
  const label = key.length === 1 ? key.toUpperCase() : key;
  return action === 'panReset' ? `Shift + ${label}` : label;
}

function setKeyInput(input, key) {
  input.dataset.key = key;
  input.value = keyLabel(input.dataset.action, key);
}

async function load() {
  const { settings } = await chrome.storage.sync.get('settings');
  const s = { ...DEFAULTS, ...settings };
  document.querySelector(`input[name="persistence"][value="${s.persistence}"]`).checked = true;
  document.querySelector(
    `input[name="transition-speed"][value="${s.transitionSpeed}"]`
  ).checked = true;
  document.querySelector(`input[name="ratio-source"][value="${s.ratioSource}"]`).checked = true;

  const keymap = { ...DEFAULT_KEYMAP, ...settings?.keymap };
  document.querySelectorAll('.key-input').forEach((input) => {
    setKeyInput(input, keymap[input.dataset.action]);
  });
}

document.querySelectorAll('.key-input').forEach((input) => {
  input.addEventListener('focus', () => {
    input.value = t('recordKey');
  });
  input.addEventListener('blur', () => setKeyInput(input, input.dataset.key));
  input.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (e.key === 'Escape' || e.key === 'Tab') {
      input.blur();
      return;
    }
    if (e.key.length !== 1 || e.key === ' ') return; // 문자·기호 키만 허용
    const key = e.key.toLowerCase();
    // 같은 조합 그룹(비 Shift 계열) 안에서 중복 방지
    const group =
      input.dataset.action === 'panReset'
        ? ['panReset']
        : ['toggle', 'cycle', 'zoomOut', 'zoomIn'];
    const duplicated = [...document.querySelectorAll('.key-input')].some(
      (other) =>
        other !== input && group.includes(other.dataset.action) && other.dataset.key === key
    );
    if (duplicated) return;
    setKeyInput(input, key);
    input.blur();
  });
});

document.getElementById('keys-default').addEventListener('click', () => {
  document.querySelectorAll('.key-input').forEach((input) => {
    setKeyInput(input, DEFAULT_KEYMAP[input.dataset.action]);
  });
});

document.getElementById('save').addEventListener('click', async () => {
  const settings = {
    persistence: document.querySelector('input[name="persistence"]:checked').value,
    transitionSpeed: Number(
      document.querySelector('input[name="transition-speed"]:checked').value
    ),
    ratioSource: document.querySelector('input[name="ratio-source"]:checked').value,
    keymap: Object.fromEntries(
      [...document.querySelectorAll('.key-input')].map((input) => [
        input.dataset.action,
        input.dataset.key,
      ])
    ),
  };
  await chrome.storage.sync.set({ settings });
  const status = document.getElementById('status');
  status.textContent = t('saved');
  setTimeout(() => (status.textContent = ''), 1500);
});

localize();
load();
