#!/bin/bash
# 스토어 자산 렌더링 스크립트 — 영어판 HTML 생성 후 ko/en 모두 렌더링
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$(dirname "$SRC")"

python3 "$SRC/gen_en.py"

shot() { # file.html out.png WxH
  local size="$3"
  "$CHROME" --headless=new --disable-gpu --allow-file-access-from-files \
    --hide-scrollbars --window-size="${size/x/,}" \
    --screenshot="$OUT/$2" "file://$SRC/$1" 2>/dev/null
  echo "rendered $2"
}

shot screenshot1-ko.html screenshot-1-ko.png 1280x800
shot screenshot2-ko.html screenshot-2-ko.png 1280x800
shot tile-440x280.html promo-tile-440x280-ko.png 440x280

shot screenshot1-en.html screenshot-1-en.png 1280x800
shot screenshot2-en.html screenshot-2-en.png 1280x800
shot tile-440x280-en.html promo-tile-440x280-en.png 440x280
