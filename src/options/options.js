// Fill Mode — options page

const DEFAULTS = {
  persistence: 'session',
  transitionSpeed: 300,
  ratioSource: 'screen',
};

const t = (key) => chrome.i18n.getMessage(key);

function localize() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.title = t('optionsTitle');
}

async function load() {
  const { settings } = await chrome.storage.sync.get('settings');
  const s = { ...DEFAULTS, ...settings };
  document.querySelector(`input[name="persistence"][value="${s.persistence}"]`).checked = true;
  document.querySelector(
    `input[name="transition-speed"][value="${s.transitionSpeed}"]`
  ).checked = true;
  document.querySelector(`input[name="ratio-source"][value="${s.ratioSource}"]`).checked = true;
}

document.getElementById('save').addEventListener('click', async () => {
  const settings = {
    persistence: document.querySelector('input[name="persistence"]:checked').value,
    transitionSpeed: Number(
      document.querySelector('input[name="transition-speed"]:checked').value
    ),
    ratioSource: document.querySelector('input[name="ratio-source"]:checked').value,
  };
  await chrome.storage.sync.set({ settings });
  const status = document.getElementById('status');
  status.textContent = t('saved');
  setTimeout(() => (status.textContent = ''), 1500);
});

localize();
load();
