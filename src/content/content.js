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
  fmApply();
}

function fmHandleCommand(command) {
  switch (command) {
    case 'increase-zoom':
      fmStepManualScale(+0.05);
      break;
    case 'decrease-zoom':
      fmStepManualScale(-0.05);
      break;
    case 'cycle-preset':
      fmCyclePreset();
      break;
    case 'reset-zoom':
      fmReset();
      break;
  }
}

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
      fmApply();
      sendResponse({ ok: true });
      return;
  }
});

// 리사이즈/전체화면 전환/SPA 네비게이션 시 재적용
window.addEventListener('resize', () => fmState.enabled && fmApply());
document.addEventListener('fullscreenchange', () => fmState.enabled && fmApply());
fmObserveVideoChanges(() => fmState.enabled && fmApply());
