#!/bin/zsh
set -eu

ROOT_DIR="/Users/liyizhu/mycodex/tmeoa-card-monitor"
LABEL="com.codex.tmeoa-card-monitor"
SOURCE_PLIST="$ROOT_DIR/$LABEL.plist"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/$LABEL.plist"

mkdir -p "$ROOT_DIR/logs" "$TARGET_DIR"
chmod +x "$ROOT_DIR/check.js"
chmod +x "$ROOT_DIR/login.sh"

cp "$SOURCE_PLIST" "$TARGET_PLIST"

launchctl bootout "gui/$UID" "$TARGET_PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$TARGET_PLIST"
launchctl enable "gui/$UID/$LABEL"
launchctl kickstart -k "gui/$UID/$LABEL"

echo "Installed $LABEL"
echo "Logs: $ROOT_DIR/logs/checks.log"
echo "Status: launchctl print gui/$UID/$LABEL"
