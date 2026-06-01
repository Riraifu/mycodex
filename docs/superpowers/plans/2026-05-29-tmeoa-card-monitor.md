# TME OA Card Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local macOS hourly task that checks the TME OA analysis page with the user's Chrome login state and notifies when the leftmost square turns green.

**Architecture:** A focused Node script drives Chrome through AppleScript, extracts the top-row square colors from the page DOM, and persists a per-day completion marker. A launchd plist runs the script every hour; once the marker is set for the current local date, later runs exit immediately.

**Tech Stack:** Node.js built-ins, AppleScript via `osascript`, macOS `launchd`, macOS Notification Center.

---

### Task 1: Color and State Logic

**Files:**
- Create: `tmeoa-card-monitor/color.js`
- Create: `tmeoa-card-monitor/test/color.test.js`

- [x] **Step 1: Write failing tests**

Test green RGB strings, orange RGB strings, and daily completion skip logic.

- [x] **Step 2: Run tests to verify failure**

Run: `node --test tmeoa-card-monitor/test/color.test.js`
Expected: FAIL because `color.js` does not exist yet.

- [x] **Step 3: Implement minimal logic**

Export `isGreenColor`, `isLeftmostGreen`, and `isDoneForDate`.

- [x] **Step 4: Run tests to verify pass**

Run: `node --test tmeoa-card-monitor/test/color.test.js`
Expected: PASS.

### Task 2: Chrome Check Script

**Files:**
- Create: `tmeoa-card-monitor/check.js`

- [x] **Step 1: Implement Chrome AppleScript runner**

Open or reuse the TME OA URL in Chrome, wait for the page, execute DOM extraction JavaScript, classify the leftmost color, and write logs.

- [x] **Step 2: Implement notification and daily state**

Send a macOS notification only when the leftmost square is green, then write today's completion marker.

- [x] **Step 3: Manually run one check**

Run: `node tmeoa-card-monitor/check.js --once`
Expected: Reports `green=false` or sends a notification if already green. If Chrome blocks JavaScript from Apple Events, print the required Chrome setting.

### Task 3: launchd Installation

**Files:**
- Create: `tmeoa-card-monitor/com.codex.tmeoa-card-monitor.plist`
- Create: `tmeoa-card-monitor/install.sh`

- [x] **Step 1: Add plist**

Configure hourly `StartInterval` and log files under `tmeoa-card-monitor/logs`.

- [x] **Step 2: Add installer**

Copy the plist to `~/Library/LaunchAgents`, unload any old copy, and bootstrap the new one.

- [x] **Step 3: Install and verify**

Run: `bash tmeoa-card-monitor/install.sh`
Expected: `launchctl print gui/$UID/com.codex.tmeoa-card-monitor` shows the agent.
