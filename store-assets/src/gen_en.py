"""한국어 스토어 자산 HTML에서 영어판을 생성한다."""
import os

SRC = os.path.dirname(os.path.abspath(__file__))

REPLACEMENTS = {
    "popup-replica-ko.html": {
        'lang="ko"': 'lang="en"',
        ">모니터<": ">Monitor<",
        ">비디오<": ">Video<",
        ">가로<": ">Landscape<",
        ">세로<": ">Portrait<",
        "W:H 또는 WxH (예: 9:19.5)": "W:H or WxH (e.g. 9:19.5)",
        ">적용<": ">Apply<",
        ">위치 이동<": ">Position<",
        ">단축키<": ">Shortcuts<",
        ">초기화<": ">Reset<",
        ">설정<": ">Settings<",
    },
    "screenshot1-ko.html": {
        'lang="ko"': 'lang="en"',
        "popup-replica-ko.html": "popup-replica-en.html",
        "비디오를 화면에<br /><em>꽉 차게</em>": "Make videos<br /><em>fill your screen</em>",
        "레터박스 제거 — 세로 모니터(9:16)와 커스텀 비율까지":
            "Remove letterboxing — vertical (9:16) monitors and custom ratios",
        "📐 프리셋 10종": "📐 10 presets",
        "✏️ 커스텀 비율": "✏️ Custom ratios",
        "🕹️ 위치 이동": "🕹️ Pan control",
        "⌨️ 전체화면 단축키": "⌨️ Fullscreen shortcuts",
        "🌐 6개 언어": "🌐 6 languages",
        ">기존<": ">Before<",
    },
    "screenshot2-ko.html": {
        'lang="ko"': 'lang="en"',
        "전체화면에서도<br />키보드로 바로 조절": "Keyboard control,<br />even in fullscreen",
        "조작 결과는 화면 위 HUD로 표시되고, 키는 원하는 대로 바꿀 수 있습니다":
            "Actions appear as an on-screen HUD, and every key is remappable",
        ">기본 단축키<": ">Default shortcuts<",
        ">켜기/끄기<": ">Toggle on/off<",
        ">비율 프리셋 순환<": ">Cycle ratio presets<",
        ">배율 감소 / 증가<": ">Decrease / increase zoom<",
        ">위치 이동<": ">Pan<",
        ">위치 초기화<": ">Reset position<",
    },
    "tile-440x280.html": {
        'lang="ko"': 'lang="en"',
        "비디오 레터박스 제거 · 세로 비율 지원": "Remove video black bars · Vertical ratios",
    },
}

OUT_NAMES = {
    "popup-replica-ko.html": "popup-replica-en.html",
    "screenshot1-ko.html": "screenshot1-en.html",
    "screenshot2-ko.html": "screenshot2-en.html",
    "tile-440x280.html": "tile-440x280-en.html",
}

for src_name, table in REPLACEMENTS.items():
    with open(os.path.join(SRC, src_name), encoding="utf-8") as f:
        html = f.read()
    for ko, en in table.items():
        if ko not in html:
            raise SystemExit(f"{src_name}: 치환 대상 없음 — {ko!r}")
        html = html.replace(ko, en)
    out = OUT_NAMES[src_name]
    with open(os.path.join(SRC, out), "w", encoding="utf-8") as f:
        f.write(html)
    print(f"wrote {out}")
