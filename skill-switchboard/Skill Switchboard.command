#!/bin/zsh
set -u

APP_DIR="/Users/liyizhu/mycodex/skill-switchboard"
URL="http://127.0.0.1:8787"
LABEL="com.codex.skill-switchboard"
NODE_BIN="/opt/homebrew/bin/node"
LAUNCH_AGENTS="$HOME/Library/LaunchAgents"
PLIST="$LAUNCH_AGENTS/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/SkillSwitchboard"
LOG_FILE="$LOG_DIR/server.log"
ERR_FILE="$LOG_DIR/server.err.log"

mkdir -p "$LOG_DIR" "$LAUNCH_AGENTS"

echo "Skill Switchboard launcher"
echo "App: $APP_DIR"
echo "URL: $URL"
echo ""

if curl -fsS "$URL/api/health" >/dev/null 2>&1 && curl -fsS "$URL/api/categories" >/dev/null 2>&1; then
  echo "Skill Switchboard is already running. Opening browser..."
  open "$URL"
  exit 0
fi

existing_pid=$(lsof -tiTCP:8787 -sTCP:LISTEN 2>/dev/null | head -1 || true)
if [ -n "$existing_pid" ]; then
  echo "Found an older Skill Switchboard server on port 8787. Restarting it..."
  kill "$existing_pid" 2>/dev/null || true
  sleep 0.5
fi

if [ ! -d "$APP_DIR" ]; then
  echo "Cannot find app directory: $APP_DIR"
  echo "Press any key to close this window."
  read -k 1
  exit 1
fi

if [ ! -x "$NODE_BIN" ]; then
  NODE_BIN=$(command -v node || true)
fi

if [ -z "${NODE_BIN:-}" ] || [ ! -x "$NODE_BIN" ]; then
  echo "Cannot find a working node executable."
  echo "Press any key to close this window."
  read -k 1
  exit 1
fi

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$APP_DIR/server.js</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$APP_DIR</string>
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$ERR_FILE</string>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
PLIST

echo "Starting local service with launchctl..."
launchctl bootout "gui/$UID/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID" "$PLIST" >/dev/null 2>&1 || true
launchctl kickstart -k "gui/$UID/$LABEL" >/dev/null 2>&1 || true

for attempt in {1..40}; do
  if curl -fsS "$URL/api/health" >/dev/null 2>&1 && curl -fsS "$URL/api/categories" >/dev/null 2>&1; then
    echo "Server is ready. Opening browser..."
    open "$URL"
    echo ""
    echo "You can close this Terminal window. The server keeps running as a user service."
    exit 0
  fi
  sleep 0.3
done

echo "Server did not become ready in time."
echo "Log file: $LOG_FILE"
echo "Error log: $ERR_FILE"
echo "Press any key to close this window."
read -k 1
exit 1
