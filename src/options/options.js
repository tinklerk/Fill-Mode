// Fill Mode — options page

const DEFAULTS = {
  persistence: 'session',
  transitionSpeed: 300,
  ratioSource: 'screen',
};

async function load() {
  const { settings } = await chrome.storage.sync.get('settings');
  const s = { ...DEFAULTS, ...settings };
  document.querySelector(`input[name="persistence"][value="${s.persistence}"]`).checked = true;
  document.getElementById('transition-speed').value = String(s.transitionSpeed);
  document.querySelector(`input[name="ratio-source"][value="${s.ratioSource}"]`).checked = true;
}

document.getElementById('save').addEventListener('click', async () => {
  const settings = {
    persistence: document.querySelector('input[name="persistence"]:checked').value,
    transitionSpeed: Number(document.getElementById('transition-speed').value),
    ratioSource: document.querySelector('input[name="ratio-source"]:checked').value,
  };
  await chrome.storage.sync.set({ settings });
  const status = document.getElementById('status');
  status.textContent = '저장되었습니다.';
  setTimeout(() => (status.textContent = ''), 1500);
});

load();
