# Fill Mode — 커스텀 비율 지원 비디오 줌 크롬 확장

Netflix, YouTube, Disney+, Amazon Prime 등의 비디오에서 레터박스(검은 여백)를 제거하기 위해
비디오를 화면 비율에 맞게 확대/크롭하는 크롬 확장 프로그램.
기존 [Zoom to Fill](https://chromewebstore.google.com/) 확장과 유사하지만 아래가 다르다.

- **세로 모니터 지원**: 9:16, 9:18, 9:21, 10:16 등 세로(portrait) 비율 프리셋 제공
- **커스텀 해상도/비율 설정**: 사용자가 임의의 비율(`W:H`) 또는 해상도(`2160x3840`)를 직접 입력해 저장 가능

---

## 1. 동작 원리

비디오 자체의 해상도를 바꾸는 것이 아니라, `<video>` 엘리먼트에 CSS `transform: scale()`을
적용해 플레이어 컨테이너를 넘치도록 확대하고, 넘친 부분은 컨테이너의 `overflow: hidden`으로
잘려나가게 하는 방식이다.

```text
확대 배율 계산:

  targetRatio = 목표 비율 (예: 9/16 = 0.5625, 21/9 = 2.333)
  videoRatio  = 실제 비디오 비율 (videoWidth / videoHeight)

  가로가 부족한 경우(videoRatio < targetRatio):
    scale = targetRatio / videoRatio     → 좌우를 채우고 상하를 크롭

  세로가 부족한 경우(videoRatio > targetRatio):
    scale = videoRatio / targetRatio     → 상하를 채우고 좌우를 크롭
```

세로 모니터의 핵심 케이스: 16:9 영상(1.78)을 9:16 화면(0.5625)에 채우려면
`scale = 1.78 / 0.5625 ≈ 3.16`이 되어 좌우가 대부분 크롭된다. 이 때문에 세로 모드에서는

- 큰 배율 경고 UI를 표시 (예: scale > 2.0이면 "화질 저하/크롭 심함" 배지)
- `transform-origin`을 조절해 크롭 중심을 이동하는 pan 기능이 사실상 필수

```css
video.fm-zoomed {
  transform: scale(var(--fm-scale)) translate(var(--fm-pan-x), var(--fm-pan-y));
  transform-origin: center center;
  transition: transform var(--fm-speed, 300ms) ease;
}
```

---

## 2. 프로젝트 구조

```text
fill_mode/
├── manifest.json
├── _locales/                      # 다국어(ko, en, ja, zh_CN, es, fr) 메시지
│   └── <locale>/messages.json
├── src/
│   ├── background/
│   │   └── service-worker.js      # 단축키 커맨드 라우팅, 상태 브로드캐스트
│   ├── content/
│   │   ├── content.js             # video 탐지, scale 계산/적용, 키 리스너
│   │   ├── video-finder.js        # 사이트별 video/컨테이너 셀렉터 전략
│   │   └── content.css            # transform, transition, overflow 규칙
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.js               # 비율 버튼, 커스텀 입력, 배율 +/- UI
│   │   └── popup.css
│   └── options/
│       ├── options.html           # 커스텀 프리셋 관리, 기본 동작 설정
│       ├── options.js
│       └── options.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 3. manifest.json (Manifest V3)

```json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "version": "1.0.0",
  "description": "__MSG_extDesc__",
  "default_locale": "en",
  "permissions": ["storage", "activeTab"],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "src/background/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/video-finder.js", "src/content/content.js"],
      "css": ["src/content/content.css"],
      "run_at": "document_idle",
      "all_frames": true
    }
  ],
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": "icons/icon48.png"
  },
  "options_page": "src/options/options.html",
  "commands": {
    "increase-zoom": { "description": "__MSG_cmdIncreaseZoom__" },
    "decrease-zoom": { "description": "__MSG_cmdDecreaseZoom__" },
    "cycle-preset": { "description": "__MSG_cmdCyclePreset__" },
    "reset-zoom": { "description": "__MSG_cmdResetZoom__" }
  }
}
```

참고 사항

- `all_frames: true` 필수 — 많은 스트리밍 사이트가 iframe 내부에 플레이어를 둠
- `commands`는 확장당 최대 4개의 suggested_key만 허용되므로, 비율별 개별 단축키(원본 확장의 16:9, 21:9 키 등)는 content script 레벨의 단일 키 리스너로 구현 (원본의 "single key shortcuts"와 동일한 접근)
- DRM(EME) 영상도 CSS transform은 정상 적용됨 — 픽셀을 읽는 게 아니라 렌더링 변형이기 때문

---

## 4. 핵심 모듈 설계

### 4.1 video-finder.js — 비디오/컨테이너 탐지

```text
전략 우선순위:
1. 사이트별 알려진 셀렉터 (품질/안정성 최고)
   - YouTube:  video.html5-main-video, 컨테이너 #movie_player
   - Netflix:  .watch-video video
   - Disney+:  video.btm-media-client-element
2. 폴백: document.querySelectorAll('video') 중
   - 재생 중이거나(paused=false) 화면에서 가장 큰 video 선택
3. MutationObserver로 SPA 네비게이션 시 video 교체 감지
   - YouTube는 페이지 이동 없이 video src만 교체됨 (yt-navigate-finish 이벤트 활용 가능)
```

크롭이 동작하려면 video의 조상 중 하나가 `overflow: hidden`이어야 한다. 대부분의 플레이어
컨테이너는 이미 그렇지만, 아니라면 가장 가까운 플레이어 컨테이너에 클래스를 주입한다.

```css
.fm-clip-container { overflow: hidden !important; }
```

### 4.2 content.js — 상태 관리와 적용

```javascript
const state = {
  enabled: false,
  mode: 'preset',        // 'preset' | 'custom' | 'manual'
  presetId: '16:9',
  customRatio: null,     // { w: 9, h: 16 } 형태
  manualScale: 1.0,      // +/- 로 조절한 값
  panX: 0, panY: 0,      // % 단위, 세로 모드 크롭 중심 이동용
  persistence: 'session' // 'off' | 'session' | 'permanent'
};
```

- 배율 적용은 CSS 변수(`--fm-scale`) 갱신만으로 처리 → reflow 최소화
- `video.videoWidth/videoHeight`는 `loadedmetadata` 이후에만 유효하므로 이벤트 대기 필요
- 창 리사이즈/전체화면 전환 시 `resize`, `fullscreenchange` 이벤트에서 재계산
- 모니터 비율은 `screen.width / screen.height`로 감지하되, 창 모드에서는 `window.innerWidth / innerHeight` 기준 옵션도 제공 (세로 모니터에서 창을 절반만 쓰는 경우 등)

### 4.3 프리셋 정의

```javascript
const BUILTIN_PRESETS = [
  // 가로 (landscape)
  { id: '16:10', ratio: 16 / 10 },
  { id: '16:9',  ratio: 16 / 9 },
  { id: '18:9',  ratio: 18 / 9 },
  { id: '21:9',  ratio: 21 / 9 },
  { id: '32:9',  ratio: 32 / 9 },
  // 세로 (portrait) — 이 확장의 차별점
  { id: '9:16',  ratio: 9 / 16 },
  { id: '9:18',  ratio: 9 / 18 },
  { id: '9:21',  ratio: 9 / 21 },
  { id: '10:16', ratio: 10 / 16 },
  { id: '3:4',   ratio: 3 / 4 }
];
```

커스텀 프리셋은 두 가지 입력 형식을 파싱해 ratio로 정규화

- 비율 입력: `W:H` (예: `9:19.5` — 폰 화면 비율)
- 해상도 입력: `WxH` (예: `2160x3840` → 0.5625로 환산)

```javascript
function parseRatioInput(input) {
  const m = input.trim().match(/^(\d+(?:\.\d+)?)\s*[:x]\s*(\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const w = parseFloat(m[1]), h = parseFloat(m[2]);
  if (w <= 0 || h <= 0) return null;
  return { w, h, ratio: w / h };
}
```

### 4.4 스토리지

```text
chrome.storage.sync   → 커스텀 프리셋 목록, 기본 설정(transition speed, persistence mode, 단축키 매핑)
chrome.storage.session → persistence='session'일 때 탭/사이트별 현재 배율 상태
chrome.storage.local  → persistence='permanent'일 때 도메인별 마지막 상태
```

키 설계 예: `siteState:{hostname}` → `{ presetId, manualScale, panX, panY }`

### 4.5 단축키

- **커맨드 단축키(전역)**: manifest `commands` 4개 — increase/decrease/cycle/reset. `chrome.commands.onCommand` → 활성 탭 content script로 `chrome.tabs.sendMessage`
- **단일 키 단축키(페이지 내)**: content script `keydown` 리스너. input/textarea/contentEditable 포커스 시 무시. 기본 매핑 예: `z` 토글, `[` `]` pan 이동, `1~5` 프리셋. 옵션 페이지에서 remap 가능

---

## 5. 팝업 UI 구성

원본 확장의 3단 구조를 따르되 세로/커스텀 요소 추가

메인 화면

- Monitor aspect ratio: 감지값 표시 + **orientation 아이콘**(가로/세로)
- Video aspect ratio: 감지값 또는 Not detected
- 배율 스테퍼: `− x1.00 +` (step 0.05, 범위 0.5 ~ 4.0)
- 프리셋 버튼 2열
  - 가로: 16:10, 16:9, 18:9, 21:9, 32:9
  - 세로: 9:16, 9:18, 9:21, 3:4
- **Custom** 버튼 → 인라인 입력(`W:H` 또는 `WxH`) + 저장(별표) 버튼
- 저장된 커스텀 프리셋은 프리셋 영역에 칩으로 추가 표시 (길게 눌러 삭제)
- 세로 크롭 시 pan 슬라이더 노출 (crop center: left ↔ right)

설정 화면(원본의 Settings 대응)

- Persistent zoom mode: Off / Session / Permanent
- Player button default ratio: Off / 프리셋 선택 (커스텀 포함)
- Zoom transition speed: 0 / 150 / 300 / 500ms
- Monitor ratio source: Screen / Window
- Change single key shortcuts → 키 매핑 편집 화면
- Change multi key shortcuts → `chrome://extensions/shortcuts` 링크

---

## 6. 세로 모니터 특화 고려사항

- **회전 감지**: `screen.orientation.type` 변경 이벤트(`portrait-primary` 등)를 구독해, 피벗 모니터에서 회전 시 자동으로 세로 프리셋군을 우선 노출
- **극단적 배율 경고**: 16:9 → 9:16 채움은 scale ≈ 3.16으로 원본의 약 10% 면적만 보임. 배율이 임계값(기본 2.5) 초과 시 팝업에 경고 배지 + 실제 보이는 영역 프리뷰(사각형 오버레이) 표시
- **pan 기본값**: 세로 크롭 시 인물이 중앙에 없는 영상이 많으므로 pan-x 슬라이더를 세로 모드에서 기본 노출
- **YouTube Shorts / 세로 영상 역케이스**: 9:16 영상을 가로 모니터에 채우는 반대 방향도 동일 로직으로 자동 처리됨 (별도 코드 불필요)

---

## 7. 개발/테스트

```bash
# 로드
chrome://extensions → 개발자 모드 ON → "압축해제된 확장 프로그램 로드" → 프로젝트 루트 선택

# 빌드 도구 없이 vanilla JS로 시작 가능. 규모가 커지면:
npm create vite@latest  # + CRXJS 플러그인으로 MV3 HMR 개발 환경 구성
```

테스트 체크리스트

- [ ] YouTube 일반 영상 / Shorts / 극장 모드 / 전체화면
- [ ] Netflix, Disney+ (iframe + DRM 환경)
- [ ] SPA 네비게이션 후에도 새 video에 상태 재적용
- [ ] 세로 모니터(또는 창 세로 리사이즈)에서 9:16 프리셋 동작
- [ ] 커스텀 입력 파싱: `9:19.5`, `2160x3840`, 잘못된 입력 거부
- [ ] persistence 3모드 각각의 상태 복원
- [ ] 단축키가 사이트 자체 단축키(YouTube의 f, k 등)와 충돌하지 않는지

---

## 8. 로드맵

- v0.1: 프리셋 + 커스텀 비율 + 수동 배율, YouTube/Netflix 지원
- v0.2: 세로 pan, persistence, 단축키 remap
- v0.3: 사이트별 자동 프로파일, 플레이어 내장 버튼(원본의 player button 대응)
- v1.0: Chrome Web Store 배포 (프라이버시 정책, 스토어 스크린샷 준비)
