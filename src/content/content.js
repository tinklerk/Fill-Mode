// Fill Mode — 상태 관리와 배율 적용

const FM_BUILTIN_PRESETS = [
  // 가로 (landscape)
  { id: '16:10', ratio: 16 / 10 },
  { id: '16:9', ratio: 16 / 9 },
  { id: '18:9', ratio: 18 / 9 },
  { id: '21:9', ratio: 21 / 9 },
  { id: '32:9', ratio: 32 / 9 },
  // 세로 (portrait) — 이 확장의 차별점
  { id: '9:16', ratio: 9 / 16 },
  { id: '9:18', ratio: 9 / 18 },
  { id: '9:21', ratio: 9 / 21 },
  { id: '10:16', ratio: 10 / 16 },
  { id: '3:4', ratio: 3 / 4 },
];

const fmState = {
  enabled: false,
  mode: 'preset', // 'preset' | 'custom' | 'manual'
  presetId: '16:9',
  customRatio: null, // { w, h, ratio }
  manualScale: 1.0,
  panX: 0,
  panY: 0, // % 단위, 세로 모드 크롭 중심 이동용
};

let fmVideo = null;

// 이동 위치는 사이트(hostname)별로 세션에 보존 — 다음 비디오·새로고침에도 유지
const FM_PAN_KEY = `fmPan:${location.hostname}`;

function fmClampPan(v) {
  return Math.min(50, Math.max(-50, Number(v) || 0));
}

function fmSavePan() {
  chrome.storage.session
    .set({ [FM_PAN_KEY]: { panX: fmState.panX, panY: fmState.panY } })
    .catch(() => {});
}

async function fmRestorePan() {
  try {
    const data = await chrome.storage.session.get(FM_PAN_KEY);
    if (data[FM_PAN_KEY]) {
      fmState.panX = fmClampPan(data[FM_PAN_KEY].panX);
      fmState.panY = fmClampPan(data[FM_PAN_KEY].panY);
      if (fmState.enabled) fmApply();
    }
  } catch {
    // storage.session 접근이 막히면 페이지 수명 동안만 유지
  }
}

function fmTargetRatio() {
  if (fmState.mode === 'custom' && fmState.customRatio) return fmState.customRatio.ratio;
  const preset = FM_BUILTIN_PRESETS.find((p) => p.id === fmState.presetId);
  return preset ? preset.ratio : 16 / 9;
}

function fmComputeScale(video) {
  if (!video.videoWidth || !video.videoHeight) return 1;
  const videoRatio = video.videoWidth / video.videoHeight;
  const targetRatio = fmTargetRatio();
  return videoRatio < targetRatio ? targetRatio / videoRatio : videoRatio / targetRatio;
}

function fmApply() {
  const video = fmFindVideo();
  if (!video) return;
  if (fmVideo && fmVideo !== video) fmClear(fmVideo);
  fmVideo = video;

  if (!fmState.enabled) {
    fmClear(video);
    return;
  }

  const applyNow = () => {
    const scale = fmState.mode === 'manual' ? fmState.manualScale : fmComputeScale(video);
    fmEnsureClipContainer(video);
    video.classList.add('fm-zoomed');
    video.style.setProperty('--fm-scale', scale.toFixed(4));
    video.style.setProperty('--fm-pan-x', `${fmState.panX}%`);
    video.style.setProperty('--fm-pan-y', `${fmState.panY}%`);
  };

  // videoWidth/videoHeight는 loadedmetadata 이후에만 유효
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    applyNow();
  } else {
    video.addEventListener('loadedmetadata', applyNow, { once: true });
  }
}

function fmClear(video) {
  video.classList.remove('fm-zoomed');
  video.style.removeProperty('--fm-scale');
  video.style.removeProperty('--fm-pan-x');
  video.style.removeProperty('--fm-pan-y');
}

function fmStepManualScale(delta) {
  const base = fmState.mode === 'manual' ? fmState.manualScale : fmVideo ? fmComputeScale(fmVideo) : 1;
  fmState.mode = 'manual';
  fmState.manualScale = Math.min(4.0, Math.max(0.5, base + delta));
  fmState.enabled = true;
  fmApply();
}

function fmCyclePreset() {
  const idx = FM_BUILTIN_PRESETS.findIndex((p) => p.id === fmState.presetId);
  fmState.presetId = FM_BUILTIN_PRESETS[(idx + 1) % FM_BUILTIN_PRESETS.length].id;
  fmState.mode = 'preset';
  fmState.enabled = true;
  fmApply();
}

function fmReset() {
  fmState.enabled = false;
  fmState.mode = 'preset';
  fmState.manualScale = 1.0;
  fmState.panX = 0;
  fmState.panY = 0;
  fmSavePan();
  fmApply();
}

function fmHandleCommand(command) {
  switch (command) {
    case 'increase-zoom':
      fmStepManualScale(+0.05);
      fmShowHud(`×${fmState.manualScale.toFixed(2)}`);
      break;
    case 'decrease-zoom':
      fmStepManualScale(-0.05);
      fmShowHud(`×${fmState.manualScale.toFixed(2)}`);
      break;
    case 'cycle-preset':
      fmCyclePreset();
      fmShowHud(fmState.presetId);
      break;
    case 'reset-zoom':
      fmReset();
      fmShowHud('Fill Mode OFF');
      break;
  }
}

// ── HUD: 전체화면에서도 보이는 상태 토스트 ──
let fmHudEl = null;
let fmHudTimer = null;

function fmShowHud(text) {
  // 전체화면에서는 fullscreenElement 내부에 있어야 보인다
  const host = document.fullscreenElement || document.body;
  if (!fmHudEl) {
    fmHudEl = document.createElement('div');
    fmHudEl.className = 'fm-hud';
  }
  if (fmHudEl.parentElement !== host) host.appendChild(fmHudEl);
  fmHudEl.textContent = text;
  fmHudEl.classList.add('fm-hud-visible');
  clearTimeout(fmHudTimer);
  fmHudTimer = setTimeout(() => fmHudEl.classList.remove('fm-hud-visible'), 1400);
}

// ── 페이지 내 단축키 (전체화면에서도 동작) ──
// 기본: z 토글, x 프리셋 순환, [ ] 배율 ∓0.05, Shift+화살표 위치 이동, Shift+X 위치 초기화
// 옵션 페이지에서 변경 가능 (settings.keymap)
const FM_DEFAULT_KEYMAP = { toggle: 'z', cycle: 'x', zoomOut: '[', zoomIn: ']', panReset: 'x' };
let fmKeymap = { ...FM_DEFAULT_KEYMAP };

async function fmLoadKeymap() {
  try {
    const { settings } = await chrome.storage.sync.get('settings');
    if (settings?.keymap) fmKeymap = { ...FM_DEFAULT_KEYMAP, ...settings.keymap };
  } catch {
    // 기본 키맵 유지
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.settings?.newValue) {
    fmKeymap = { ...FM_DEFAULT_KEYMAP, ...changes.settings.newValue.keymap };
  }
});

function fmIsTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

document.addEventListener(
  'keydown',
  (e) => {
    if (fmIsTypingTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!document.querySelector('video')) return;

    let handled = false;
    if (e.shiftKey) {
      if (!fmState.enabled) return;
      const pan = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[e.key];
      if (pan) {
        fmState.panX = fmClampPan(fmState.panX + pan[0]);
        fmState.panY = fmClampPan(fmState.panY + pan[1]);
        fmSavePan();
        fmApply();
        fmShowHud(`X ${fmState.panX}% · Y ${fmState.panY}%`);
        handled = true;
      } else if (fmKeyFromEvent(e) === fmKeymap.panReset) {
        fmState.panX = 0;
        fmState.panY = 0;
        fmSavePan();
        fmApply();
        fmShowHud('X 0% · Y 0%');
        handled = true;
      }
    } else {
      const key = fmKeyFromEvent(e);
      if (key === fmKeymap.toggle) {
        fmState.enabled = !fmState.enabled;
        fmApply();
        fmShowHud(`Fill Mode ${fmState.enabled ? 'ON' : 'OFF'}`);
        handled = true;
      } else if (key === fmKeymap.cycle) {
        fmCyclePreset();
        fmShowHud(fmState.presetId);
        handled = true;
      } else if (key === fmKeymap.zoomOut) {
        fmStepManualScale(-0.05);
        fmShowHud(`×${fmState.manualScale.toFixed(2)}`);
        handled = true;
      } else if (key === fmKeymap.zoomIn) {
        fmStepManualScale(+0.05);
        fmShowHud(`×${fmState.manualScale.toFixed(2)}`);
        handled = true;
      }
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  true // 사이트 자체 핸들러(YouTube 등)보다 먼저 받도록 capture 사용
);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'command':
      fmHandleCommand(message.command);
      break;
    case 'getState': {
      const video = fmFindVideo();
      sendResponse({
        state: fmState,
        videoWidth: video?.videoWidth || null,
        videoHeight: video?.videoHeight || null,
        appliedScale: video && fmState.enabled ? fmComputeScale(video) : null,
      });
      return; // sendResponse 사용
    }
    case 'setState':
      Object.assign(fmState, message.patch);
      fmState.panX = fmClampPan(fmState.panX);
      fmState.panY = fmClampPan(fmState.panY);
      if ('panX' in message.patch || 'panY' in message.patch) fmSavePan();
      fmApply();
      sendResponse({ ok: true });
      return;
  }
});

// 리사이즈/전체화면 전환/SPA 네비게이션 시 재적용
window.addEventListener('resize', () => fmState.enabled && fmApply());
document.addEventListener('fullscreenchange', () => fmState.enabled && fmApply());
fmObserveVideoChanges(() => fmState.enabled && fmApply());
fmRestorePan();
fmLoadKeymap();
