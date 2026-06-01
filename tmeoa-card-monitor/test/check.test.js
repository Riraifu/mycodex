const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildChromeArgs,
  buildDialogScript,
  buildFailureNotification,
  buildPopupHtml,
  buildStatusNotification,
  buildWechatWebhookPayload,
  isFirstWechatRunForDate,
  withTimeout,
  shouldNotifyWechat,
  pageExtractorJavascript,
  chooseTargetTab,
  validateCheckResult,
} = require('../check');

test('builds background Chrome args with a dedicated profile and remote debugging', () => {
  const args = buildChromeArgs({
    headless: true,
    profileDir: '/tmp/tmeoa-profile',
    remoteDebuggingPort: 9223,
    url: 'https://example.test/page',
  });

  assert.ok(args.includes('--headless=new'));
  assert.ok(args.includes('--user-data-dir=/tmp/tmeoa-profile'));
  assert.ok(args.includes('--remote-debugging-port=9223'));
  assert.ok(args.includes('--remote-allow-origins=*'));
  assert.ok(args.includes('https://example.test/page'));
});

test('extractor anchors square detection near the page title', () => {
  const source = pageExtractorJavascript();

  assert.match(source, /单曲卡片非触发类卡片-精排/);
  assert.match(source, /anchor/);
  assert.doesNotMatch(source, /item\.top > 120/);
});

test('re-navigates an existing target tab before reading status', () => {
  const selected = chooseTargetTab([
    {
      type: 'page',
      url: 'https://abt.tmeoa.com/kugou/analyseFeat/13/2486?share=old',
      webSocketDebuggerUrl: 'ws://example.test/devtools/page/1',
    },
  ]);

  assert.equal(selected.webSocketUrl, 'ws://example.test/devtools/page/1');
  assert.equal(selected.shouldNavigate, true);
});

test('can stop waiting for slow browser navigation without failing the check', async () => {
  const result = await withTimeout(
    new Promise((resolve) => setTimeout(() => resolve('late'), 50)),
    5,
    'timeout',
  );

  assert.equal(result, 'timeout');
});

test('rejects page results that do not contain all seven squares', () => {
  assert.throws(
    () => validateCheckResult({ anchorFound: false, colors: [], count: 0, title: 'abt.tmeoa.com' }),
    /Expected 7 status squares/,
  );
});

test('accepts semantic square status classes', () => {
  const result = validateCheckResult({
    anchorFound: true,
    colors: [
      'rgb(64, 158, 255)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
    ],
    count: 7,
    statuses: ['running', 'success', 'success', 'success', 'success', 'success', 'success'],
    title: '单曲卡片非触发类卡片-精排',
  });

  assert.equal(result.statuses[0], 'running');
});

test('builds a notification for non-success status without marking done', () => {
  const notification = buildStatusNotification({
    colors: [
      'rgb(64, 158, 255)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
      'rgb(103, 194, 58)',
    ],
    statuses: ['running', 'success', 'success', 'success', 'success', 'success', 'success'],
  });

  assert.equal(notification.done, false);
  assert.match(notification.title, /未变绿/);
  assert.match(notification.body, /running/);
  assert.match(notification.body, /当前结果/);
  // assert.match(notification.body, /下一次检查/);
});

test('builds a completion notification for success status', () => {
  const notification = buildStatusNotification({
    colors: Array(7).fill('rgb(103, 194, 58)'),
    statuses: Array(7).fill('success'),
  });

  assert.equal(notification.done, true);
  assert.match(notification.title, /abt状态检查/);
  assert.match(notification.body, /完整abt状态/);
});

test('builds a visible macOS dialog script with timeout', () => {
  const script = buildDialogScript('TME OA 检查结果', '当前还没完成：running');

  assert.match(script, /display alert/);
  assert.match(script, /as informational/);
  assert.match(script, /giving up after 30/);
  assert.match(script, /TME OA 检查结果/);
});

test('builds a styled popup html status card', () => {
  const html = buildPopupHtml({
    body: '当前结果：还没完成\n\n昨日abt状态：running',
    done: false,
    statuses: ['running', 'success', 'success', 'success', 'success', 'success', 'success'],
    title: 'abt状态检查',
  });

  assert.match(html, /status-card/);
  assert.match(html, /running/);
  assert.match(html, /success/);
  assert.doesNotMatch(html, /class="dot success"/);
  assert.doesNotMatch(html, /class="dot running"/);
  assert.match(html, /linear-gradient/);
  assert.match(html, /abt状态检查/);
  assert.match(html, /30s 后自动关闭/);
  assert.match(html, /setTimeout\(\(\) => window\.close\(\), 30000\)/);
});

test('renders status dots with the actual page colors', () => {
  const html = buildPopupHtml({
    body: '当前结果：其他状态',
    colors: [
      'rgb(250, 173, 20)',
      'rgb(103, 194, 58)',
      'rgb(64, 158, 255)',
      'rgba(190, 190, 190, 0.2)',
      'rgb(245, 108, 108)',
      'rgb(144, 147, 153)',
      'rgb(180, 90, 220)',
    ],
    done: false,
    statuses: ['unknown', 'success', 'running', 'pending', 'unknown', 'unknown', 'unknown'],
    title: 'TME OA 卡片状态',
  });

  assert.match(html, /background: rgb\(250, 173, 20\)/);
  assert.match(html, /background: rgba\(190, 190, 190, 0.2\)/);
  assert.match(html, /background: rgb\(180, 90, 220\)/);
});

test('builds a notification when the page cannot be opened', () => {
  const notification = buildFailureNotification(new Error('Timed out waiting for Page.navigate'));

  assert.equal(notification.done, false);
  assert.match(notification.title, /无法打开/);
  assert.match(notification.body, /网络|VPN|页面/);
  assert.match(notification.body, /Timed out waiting for Page\.navigate/);
});

test('builds a WeCom webhook payload for success notifications', () => {
  const payload = buildWechatWebhookPayload(
    {
      body: '完整状态：success, success',
      title: 'abt状态检查',
    },
    { mentionAllOnSuccess: true },
    'success',
  );

  assert.equal(payload.msgtype, 'text');
  // assert.match(payload.text.content, /TME OA 卡片状态变绿/);
  // assert.match(payload.text.content, /当前结果：已成功/);
  assert.deepEqual(payload.text.mentioned_list, ['@all']);
});

test('only sends WeCom messages for enabled notification kinds', () => {
  const config = {
    wechatWebhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test',
    notifyWechatOnSuccess: true,
  };

  assert.equal(shouldNotifyWechat(config, 'success'), true);
  assert.equal(shouldNotifyWechat({ ...config, notifyWechatOnSuccess: false }, 'success'), false);
  assert.equal(shouldNotifyWechat({ notifyWechatOnSuccess: true }, 'success'), false);
  assert.equal(shouldNotifyWechat({}, 'success'), false);
  assert.equal(shouldNotifyWechat({ ...config, notifyWechatOnFailure: true }, 'failure'), true);
  assert.equal(shouldNotifyWechat({ ...config, notifyWechatOnPending: true }, 'pending'), true);
});

test('sends WeCom on the first run of the day regardless of result kind', () => {
  const config = {
    wechatWebhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test',
    notifyWechatOnSuccess: false,
    notifyWechatOnFailure: false,
    notifyWechatOnPending: false,
  };

  assert.equal(shouldNotifyWechat(config, 'success', { firstRunToday: true }), true);
  assert.equal(shouldNotifyWechat(config, 'failure', { firstRunToday: true }), true);
  assert.equal(shouldNotifyWechat(config, 'pending', { firstRunToday: true }), true);
  assert.equal(shouldNotifyWechat(config, 'pending', { firstRunToday: false }), false);
});

test('detects whether the daily WeCom first-run notification has been sent', () => {
  assert.equal(isFirstWechatRunForDate({}, '2026-06-01'), true);
  assert.equal(isFirstWechatRunForDate({ firstWechatRunDate: '2026-05-31' }, '2026-06-01'), true);
  assert.equal(isFirstWechatRunForDate({ firstWechatRunDate: '2026-06-01' }, '2026-06-01'), false);
});
