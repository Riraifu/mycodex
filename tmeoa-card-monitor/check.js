#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const { isDoneForDate, isLeftmostGreen } = require('./color');

const TARGET_URL = 'https://abt.tmeoa.com/kugou/analyseFeat/13/2486?share=5JrETLGwia4EyrmoNdNpHS';
const TARGET_URL_PREFIX = 'https://abt.tmeoa.com/kugou/analyseFeat/13/2486';
const ROOT_DIR = __dirname;
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE_DIR = path.join(ROOT_DIR, 'chrome-profile');
const POPUP_DIR = path.join(ROOT_DIR, 'popup');
const POPUP_PROFILE_DIR = path.join(ROOT_DIR, 'popup-profile');
const REMOTE_DEBUGGING_PORT = 9223;
const STATE_FILE = path.join(ROOT_DIR, 'state.json');
const NOTIFY_CONFIG_FILE = path.join(ROOT_DIR, 'notify-config.json');
const LOG_DIR = path.join(ROOT_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'checks.log');

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function readNotifyConfig() {
  try {
    return JSON.parse(fs.readFileSync(NOTIFY_CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

function log(message, details = {}) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const payload = {
    time: new Date().toISOString(),
    message,
    ...details,
  };
  fs.appendFileSync(LOG_FILE, `${JSON.stringify(payload)}\n`);
  console.log(`${payload.time} ${message}`);
}

function asAppleString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildDialogScript(title, body) {
  return [
    `display alert ${asAppleString(title)}`,
    `message ${asAppleString(body)}`,
    'as informational',
    'buttons {"好"}',
    'default button "好"',
    'giving up after 30',
  ].join(' ');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isSafeCssColor(value) {
  return /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(String(value || ''));
}

function fallbackColorForStatus(status) {
  if (status === 'success') return '#67c23a';
  if (status === 'running') return '#409eff';
  return '#bec2ca';
}

function buildPopupHtml({ body, colors, done, statuses, title }) {
  const safeTitle = escapeHtml(title);
  const lines = String(body).split('\n').map((line) => `<p>${escapeHtml(line) || '&nbsp;'}</p>`).join('\n');
  const statusList = Array.isArray(statuses) ? statuses : [];
  const colorList = Array.isArray(colors) ? colors : [];
  const chips = statusList
    .map((status, index) => {
      const color = colorList[index];
      const dotColor = isSafeCssColor(color) ? color : fallbackColorForStatus(status);
      return `<span class="dot" title="${escapeHtml(status)}" style="background: ${escapeHtml(dotColor)}"></span>`;
    })
    .join('');
  const theme = done ? 'done' : 'running';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
    }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, #eef5ff 0%, #f7fbf8 52%, #ffffff 100%);
      color: #182230;
    }
    .status-card {
      width: 390px;
      border: 1px solid rgba(24, 34, 48, 0.1);
      border-radius: 18px;
      box-shadow: 0 20px 60px rgba(24, 34, 48, 0.18);
      overflow: hidden;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(18px);
    }
    .top {
      padding: 18px 20px;
      color: white;
      background: ${theme === 'done'
        ? 'linear-gradient(135deg, #2fb344 0%, #57c785 100%)'
        : 'linear-gradient(135deg, #246bfe 0%, #62b0ff 100%)'};
    }
    .eyebrow {
      margin: 0 0 5px;
      font-size: 12px;
      font-weight: 700;
      opacity: 0.82;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      line-height: 1.25;
      letter-spacing: 0;
    }
    .content {
      padding: 18px 20px 16px;
    }
    .content p {
      margin: 0 0 6px;
      font-size: 14px;
      line-height: 1.45;
    }
    .dots {
      display: flex;
      gap: 7px;
      margin: 12px 0 14px;
    }
    .dot {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.45), 0 2px 8px rgba(24,34,48,0.12);
    }
    .foot {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      padding-top: 10px;
      border-top: 1px solid rgba(24, 34, 48, 0.08);
      color: #667085;
      font-size: 12px;
    }
    button {
      border: 0;
      border-radius: 999px;
      background: #182230;
      color: white;
      font-size: 12px;
      font-weight: 700;
      padding: 7px 12px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <main class="status-card">
    <section class="top">
      <p class="eyebrow">TME OA Monitor</p>
      <h1>${safeTitle}</h1>
    </section>
    <section class="content">
      <div>${lines}</div>
      <div class="dots">${chips}</div>
      <div class="foot">
        <span>30s 后自动关闭</span>
        <button onclick="window.close()">关闭</button>
      </div>
    </section>
  </main>
  <script>
    setTimeout(() => window.close(), 30000);
  </script>
</body>
</html>`;
}

function showPopup(title, body, details = {}) {
  fs.mkdirSync(POPUP_DIR, { recursive: true });
  fs.mkdirSync(POPUP_PROFILE_DIR, { recursive: true });
  const htmlPath = path.join(POPUP_DIR, 'status.html');
  fs.writeFileSync(htmlPath, buildPopupHtml({ body, title, ...details }));
  const child = spawn(CHROME_PATH, [
    `--user-data-dir=${POPUP_PROFILE_DIR}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--app=file://' + htmlPath,
    '--window-size=440,420',
  ], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function notify(title, body, details = {}) {
  try {
    showPopup(title, body, details);
    return;
  } catch {
    // Fall back to the native alert if the styled popup cannot be opened.
  }
  const script = buildDialogScript(title, body);
  execFileSync('osascript', ['-e', script], { stdio: 'ignore' });
}

function buildFailureNotification(error) {
  const message = error && error.message ? error.message : String(error || 'unknown error');
  return {
    body: [
      '当前结果：无法打开或读取页面',
      '',
      '网络断开',
      '',
      `错误信息：${message}`,
    ].join('\n'),
    done: false,
    statuses: Array(7).fill('unknown'),
    title: 'TME OA 页面无法打开',
  };
}

function isFirstWechatRunForDate(state, today) {
  return !state || state.firstWechatRunDate !== today;
}

function shouldNotifyWechat(config, kind, options = {}) {
  if (!config || !config.wechatWebhookUrl) return false;
  if (options.firstRunToday === true) return true;
  if (kind === 'success') return config.notifyWechatOnSuccess === true;
  if (kind === 'failure') return config.notifyWechatOnFailure === true;
  if (kind === 'pending') return config.notifyWechatOnPending === true;
  return false;
}

function buildWechatWebhookPayload(notification, config = {}, kind = 'success') {
  const payload = {
    msgtype: 'text',
    text: {
      content: `[${notification.title}]\n${notification.body}`,
    },
  };
  if (kind === 'success' && config.mentionAllOnSuccess === true) {
    payload.text.mentioned_list = ['@all'];
  }
  return payload;
}

async function sendWechatNotification(config, kind, notification, options = {}) {
  if (!shouldNotifyWechat(config, kind, options)) return false;

  const response = await fetch(config.wechatWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildWechatWebhookPayload(notification, config, kind)),
  });
  if (!response.ok) {
    throw new Error(`WeCom webhook HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errcode !== 0) {
    throw new Error(`WeCom webhook failed: ${payload.errmsg || payload.errcode}`);
  }
  return true;
}

function statusFromClass(className) {
  const classes = String(className || '').split(/\s+/);
  if (classes.includes('st-2')) return 'success';
  if (classes.includes('st-1')) return 'running';
  if (classes.includes('st-0')) return 'pending';
  return 'unknown';
}

function pageExtractorJavascript() {
  return `
(() => {
  const titleText = '单曲卡片非触发类卡片-精排';
  const bodyText = document.body ? document.body.innerText || '' : '';
  if (/登录|login|sign in/i.test(bodyText) && !bodyText.includes('单曲卡片')) {
    return 'LOGIN:' + JSON.stringify({ title: document.title, url: location.href });
  }

  const anchor = Array.from(document.querySelectorAll('body *'))
    .filter((element) => (element.innerText || element.textContent || '').includes(titleText))
    .map((element) => ({ element, rect: element.getBoundingClientRect() }))
    .filter((item) => item.rect.width > 0 && item.rect.width < 900 && item.rect.height > 0 && item.rect.height < 120)
    .sort((a, b) => a.rect.width - b.rect.width)[0];
  const anchorRect = anchor ? anchor.rect : null;

  const candidates = Array.from(document.querySelectorAll('body *'))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        color: style.backgroundColor,
        className: element.className,
        height: rect.height,
        left: rect.left,
        top: rect.top,
        visible: style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0,
        width: rect.width,
      };
    })
    .filter((item) => {
      if (!item.visible) return false;
      if (item.top < -5) return false;
      if (!/\\bitem\\b/.test(String(item.className || '')) || !/\\bst-\\d+\\b/.test(String(item.className || ''))) return false;
      if (item.width < 8 || item.width > 32 || item.height < 8 || item.height > 32) return false;
      if (Math.abs(item.width - item.height) > 4) return false;
      if (!/^rgba?\\(/.test(item.color) || /rgba\\(0, 0, 0, 0\\)/.test(item.color)) return false;
      return true;
    })
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const deduped = [];
  for (const item of candidates) {
    const duplicate = deduped.some((seen) => Math.abs(seen.left - item.left) < 3 && Math.abs(seen.top - item.top) < 3);
    if (!duplicate) deduped.push(item);
  }

  const rows = new Map();
  for (const item of deduped) {
    const key = String(Math.round(item.top / 8) * 8);
    const row = rows.get(key) || [];
    row.push(item);
    rows.set(key, row);
  }

  const plausibleRows = Array.from(rows.values())
    .map((row) => row.sort((a, b) => a.left - b.left))
    .filter((row) => row.length >= 6)
    .sort((a, b) => {
      const aNearAnchor = anchorRect ? Math.abs(a[0].top - anchorRect.bottom) : a[0].top;
      const bNearAnchor = anchorRect ? Math.abs(b[0].top - anchorRect.bottom) : b[0].top;
      return aNearAnchor - bNearAnchor || a[0].top - b[0].top;
    });

  const squares = (plausibleRows[0] || []).slice(0, 7);
  return 'OK:' + JSON.stringify({
    anchorFound: Boolean(anchorRect),
    colors: squares.map((item) => item.color),
    count: squares.length,
    statuses: squares.map((item) => (${statusFromClass.toString()})(item.className)),
    title: document.title,
    url: location.href,
  });
})()
`;
}

function buildChromeArgs({
  headless,
  profileDir = PROFILE_DIR,
  remoteDebuggingPort = REMOTE_DEBUGGING_PORT,
  url = TARGET_URL,
}) {
  const args = [
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${remoteDebuggingPort}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-allow-origins=*',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--window-size=1280,900',
  ];

  if (headless) {
    args.push('--headless=new');
  }

  args.push(url);
  return args;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, fallbackValue) {
  let timeoutId;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(fallbackValue), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
}

async function waitForDebugPort(port) {
  const versionUrl = `http://127.0.0.1:${port}/json/version`;
  for (let i = 0; i < 30; i += 1) {
    try {
      await fetchJson(versionUrl);
      return;
    } catch {
      await delay(1000);
    }
  }
  throw new Error(`Chrome DevTools port ${port} did not become ready`);
}

async function ensureChromeStarted({ headless = true } = {}) {
  fs.mkdirSync(PROFILE_DIR, { recursive: true });
  try {
    await fetchJson(`http://127.0.0.1:${REMOTE_DEBUGGING_PORT}/json/version`);
    return;
  } catch {
    const child = spawn(CHROME_PATH, buildChromeArgs({ headless }), {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    await waitForDebugPort(REMOTE_DEBUGGING_PORT);
  }
}

function chooseTargetTab(tabs) {
  const existing = tabs.find((tab) => tab.type === 'page' && tab.url && tab.url.startsWith(TARGET_URL_PREFIX));
  if (existing && existing.webSocketDebuggerUrl) {
    return { webSocketUrl: existing.webSocketDebuggerUrl, shouldNavigate: true };
  }
  return null;
}

async function openTargetTab() {
  const listUrl = `http://127.0.0.1:${REMOTE_DEBUGGING_PORT}/json/list`;
  const tabs = await fetchJson(listUrl);
  const existing = chooseTargetTab(tabs);
  if (existing) return existing;

  const newTabUrl = `http://127.0.0.1:${REMOTE_DEBUGGING_PORT}/json/new?${encodeURIComponent(TARGET_URL)}`;
  const created = await fetchJson(newTabUrl, { method: 'PUT' });
  if (!created.webSocketDebuggerUrl) {
    throw new Error('Chrome did not return a debuggable page');
  }
  return { webSocketUrl: created.webSocketDebuggerUrl, shouldNavigate: true };
}

function createCdpClient(webSocketUrl) {
  const ws = new WebSocket(webSocketUrl);
  let nextId = 1;
  const pending = new Map();

  ws.addEventListener('message', async (event) => {
    const data = typeof event.data === 'string' ? event.data : await event.data.text();
    const message = JSON.parse(data);
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message));
    } else {
      resolve(message.result);
    }
  });

  function send(method, params = {}) {
    const id = nextId;
    nextId += 1;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`Timed out waiting for ${method}`));
        }
      }, 30000);
    });
  }

  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      resolve({
        close: () => ws.close(),
        send,
      });
    });
    ws.addEventListener('error', () => reject(new Error('Failed to connect to Chrome DevTools')));
  });
}

async function evaluateExtractor(client) {
  const expression = pageExtractorJavascript();
  const result = await client.send('Runtime.evaluate', {
    awaitPromise: true,
    expression,
    returnByValue: true,
  });
  return result.result.value;
}

async function runChromeCheck() {
  await ensureChromeStarted({ headless: true });
  const { webSocketUrl, shouldNavigate } = await openTargetTab();
  const client = await createCdpClient(webSocketUrl);

  try {
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    if (shouldNavigate) {
      await withTimeout(client.send('Page.navigate', { url: TARGET_URL }), 3000, null);
      await delay(5000);
    }

    for (let i = 0; i < 12; i += 1) {
      const output = await evaluateExtractor(client);
      if (typeof output === 'string' && output.startsWith('OK:')) {
        const parsed = JSON.parse(output.slice(3));
        if (parsed.count === 7 && Array.isArray(parsed.colors) && parsed.colors.length === 7) {
          return validateCheckResult(parsed);
        }
      }
      if (typeof output === 'string' && output.startsWith('LOGIN:')) {
        const details = JSON.parse(output.slice(6));
        throw new Error(`Dedicated Chrome profile is not logged in: ${details.title || details.url}`);
      }
      await delay(5000);
    }

    const output = await evaluateExtractor(client);
    const parsed = typeof output === 'string' && output.startsWith('OK:') ? JSON.parse(output.slice(3)) : null;
    validateCheckResult(parsed);
    throw new Error('Timed out waiting for TME OA square colors');
  } finally {
    client.close();
  }
}

function validateCheckResult(result) {
  if (!result || result.count !== 7 || !Array.isArray(result.colors) || result.colors.length !== 7) {
    throw new Error(`Expected 7 status squares, found ${result ? result.count : 'none'} on "${result ? result.title : 'unknown'}"`);
  }
  if (!Array.isArray(result.statuses) || result.statuses.length !== 7) {
    result.statuses = result.colors.map((color) => (isLeftmostGreen([color]) ? 'success' : 'unknown'));
  }
  return result;
}

function buildStatusNotification(result) {
  const statuses = Array.isArray(result.statuses) ? result.statuses : [];
  const colors = Array.isArray(result.colors) ? result.colors : [];
  const leftmostStatus = statuses[0] || 'unknown';
  const leftmostSuccess = leftmostStatus === 'success' || isLeftmostGreen(colors);
  const statusSummary = statuses.length > 0 ? statuses.join(', ') : colors.join(', ');

  if (leftmostSuccess) {
    return {
      body: [
        `昨日abt状态：${leftmostStatus}`,
        `完整abt状态：${statusSummary}`,
        '',
        '今天的检查已停止。',
      ].join('\n'),
      done: true,
      title: 'abt状态检查',
    };
  }

  return {
    body: [
      '当前结果：还没完成',
      '',
      `昨日abt状态：${leftmostStatus}`,
      `完整abt状态：${statusSummary}`,
    ].join('\n'),
    done: false,
    title: 'abt状态检查',
  };
}

async function main() {
  const today = todayLocal();
  const state = readState();
  const notifyConfig = readNotifyConfig();
  const firstRunToday = isFirstWechatRunForDate(state, today);

  if (isDoneForDate(state, today)) {
    log('already completed today', { today });
    return;
  }

  const result = await runChromeCheck();
  const leftmostSuccess = result.statuses[0] === 'success' || isLeftmostGreen(result.colors);
  log('checked page', {
    anchorFound: result.anchorFound,
    colors: result.colors,
    count: result.count,
    leftmostGreen: leftmostSuccess,
    statuses: result.statuses,
    title: result.title,
  });

  const notification = buildStatusNotification(result);
  const notificationKind = notification.done ? 'success' : 'pending';
  notify(notification.title, notification.body, {
    colors: result.colors,
    done: notification.done,
    statuses: result.statuses,
  });
  log('notified current status', {
    done: notification.done,
    leftmostStatus: result.statuses[0],
    today,
  });
  try {
    const sent = await sendWechatNotification(notifyConfig, notificationKind, notification, { firstRunToday });
    if (sent) {
      log('sent wechat notification', { firstRunToday, kind: notificationKind, today });
      if (firstRunToday) {
        writeState({ ...readState(), firstWechatRunDate: today });
      }
    }
  } catch (error) {
    log('wechat notification failed', { error: error.message, kind: notificationKind, today });
  }

  if (notification.done) {
    writeState({
      ...readState(),
      doneAt: new Date().toISOString(),
      doneDate: today,
      lastColors: result.colors,
      lastStatuses: result.statuses,
      user: os.userInfo().username,
    });
    log('notified and marked done', { today });
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    try {
      const today = todayLocal();
      const state = readState();
      const firstRunToday = isFirstWechatRunForDate(state, today);
      log('check failed', { error: error.message });
      const notification = buildFailureNotification(error);
      const notifyConfig = readNotifyConfig();
      notify(notification.title, notification.body, {
        done: notification.done,
        statuses: notification.statuses,
      });
      log('notified check failure', { error: error.message });
      try {
        const sent = await sendWechatNotification(notifyConfig, 'failure', notification, { firstRunToday });
        if (sent) {
          log('sent wechat notification', { firstRunToday, kind: 'failure', today });
          if (firstRunToday) {
            writeState({ ...readState(), firstWechatRunDate: today });
          }
        }
      } catch (wechatError) {
        log('wechat notification failed', { error: wechatError.message, kind: 'failure', today });
      }
    } catch {
      console.error(error);
    }
    process.exitCode = 1;
  });
}

module.exports = {
  buildChromeArgs,
  buildDialogScript,
  buildFailureNotification,
  buildPopupHtml,
  buildStatusNotification,
  buildWechatWebhookPayload,
  chooseTargetTab,
  isFirstWechatRunForDate,
  pageExtractorJavascript,
  readNotifyConfig,
  runChromeCheck,
  sendWechatNotification,
  shouldNotifyWechat,
  todayLocal,
  validateCheckResult,
  withTimeout,
};
