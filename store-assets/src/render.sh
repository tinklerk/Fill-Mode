#!/bin/bash
# 스토어 자산 렌더링 스크립트
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$(dirname "$SRC")"

shot() { # file.html out.png WxH
  local size="$3"
  "$CHROME" --headless=new --disable-gpu --allow-file-access-from-files \
    --hide-scrollbars --window-size="${size/x/,}" \
    --screenshot="$OUT/$2" "file://$SRC/$1" 2>/dev/null
  echo "rendered $2"
}

shot screenshot1-ko.html screenshot-1.png 1280x800
shot screenshot2-ko.html screenshot-2.png 1280x800
shot tile-440x280.html promo-tile-440x280.png 440x280
