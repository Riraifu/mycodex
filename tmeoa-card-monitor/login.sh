#!/bin/zsh
set -eu

ROOT_DIR="/Users/liyizhu/mycodex/tmeoa-card-monitor"
PROFILE_DIR="$ROOT_DIR/chrome-profile"
URL="https://abt.tmeoa.com/kugou/analyseFeat/13/2486?share=5JrETLGwia4EyrmoNdNpHS"

mkdir -p "$PROFILE_DIR" "$ROOT_DIR/logs"

/usr/bin/open -na "/Applications/Google Chrome.app" --args \
  --user-data-dir="$PROFILE_DIR" \
  --remote-debugging-port=9223 \
  --remote-debugging-address=127.0.0.1 \
  --no-first-run \
  --no-default-browser-check \
  --new-window \
  "$URL"

echo "Opened dedicated Chrome profile for TME OA login."
echo "After login succeeds, you can close that Chrome window. The hourly monitor will reuse this profile in the background."
