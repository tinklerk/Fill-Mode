// Fill Mode — 비디오/컨테이너 탐지
// 전략: 사이트별 셀렉터 → 폴백(가장 큰 재생 중 video) → MutationObserver로 교체 감지

const FM_SITE_SELECTORS = [
  { host: /(^|\.)youtube\.com$/, video: 'video.html5-main-video', container: '#movie_player' },
  { host: /(^|\.)netflix\.com$/, video: '.watch-video video', container: null },
  { host: /(^|\.)disneyplus\.com$/, video: 'video.btm-media-client-element', container: null },
];

function fmFindVideo() {
  const site = FM_SITE_SELECTORS.find((s) => s.host.test(location.hostname));
  if (site) {
    const v = document.querySelector(site.video);
    if (v) return v;
  }
  // 폴백: 재생 중이거나 화면에서 가장 큰 video
  let best = null;
  let bestArea = 0;
  for (const v of document.querySelectorAll('video')) {
    const rect = v.getBoundingClientRect();
    const area = rect.width * rect.height;
    const score = area * (v.paused ? 1 : 2);
    if (score > bestArea) {
      bestArea = score;
      best = v;
    }
  }
  return best;
}

// 크롭이 동작하려면 조상 중 하나가 overflow: hidden이어야 한다.
function fmEnsureClipContainer(video) {
  const site = FM_SITE_SELECTORS.find((s) => s.host.test(location.hostname));
  const container =
    (site?.container && document.querySelector(site.container)) || video.parentElement;
  if (!container) return;
  const overflow = getComputedStyle(container).overflow;
  if (overflow !== 'hidden' && overflow !== 'clip') {
    container.classList.add('fm-clip-container');
  }
}

// SPA 네비게이션 등으로 video가 교체되면 콜백 호출
function fmObserveVideoChanges(onChange) {
  const observer = new MutationObserver(() => onChange());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // YouTube는 페이지 이동 없이 video src만 교체됨
  window.addEventListener('yt-navigate-finish', () => onChange());
  return observer;
}
