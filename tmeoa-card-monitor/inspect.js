#!/usr/bin/env node

async function cdpClient(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  ws.onmessage = async (event) => {
    const data = typeof event.data === 'string' ? event.data : await event.data.text();
    const message = JSON.parse(data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  return {
    close: () => ws.close(),
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
  };
}

async function main() {
  const tabs = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const page = tabs.find((tab) => tab.type === 'page' && tab.title.includes('单曲卡片'));
  if (!page) {
    throw new Error('No target tab found on port 9223');
  }

  const client = await cdpClient(page.webSocketDebuggerUrl);
  try {
    await client.send('Runtime.enable');
    const expression = `(() => {
      const all = Array.from(document.querySelectorAll('body *')).map((e, idx) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return {
          idx,
          tag: e.tagName,
          cls: String(e.className || '').slice(0, 100),
          text: String(e.innerText || e.textContent || '').trim().slice(0, 120),
          bg: s.backgroundColor,
          color: s.color,
          border: s.borderColor,
          w: Number(r.width.toFixed(1)),
          h: Number(r.height.toFixed(1)),
          top: Number(r.top.toFixed(1)),
          left: Number(r.left.toFixed(1)),
          display: s.display,
          visibility: s.visibility,
        };
      });
      return {
        title: document.title,
        url: location.href,
        body: String(document.body && document.body.innerText || '').slice(0, 500),
        nearTitle: all.filter((x) => x.text.includes('单曲卡片') || (x.top >= 0 && x.top < 240 && x.left > 240)).slice(0, 160),
        small: all.filter((x) => x.w >= 4 && x.w <= 60 && x.h >= 4 && x.h <= 60 && x.top >= 0 && x.top < 280).slice(0, 220),
      };
    })()`;
    const result = await client.send('Runtime.evaluate', {
      awaitPromise: true,
      expression,
      returnByValue: true,
    });
    console.log(JSON.stringify(result.result.value, null, 2));
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
