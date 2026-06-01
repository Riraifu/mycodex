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
      const id = nextId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
  };
}

async function main() {
  const tabs = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const page = tabs.find((tab) => tab.type === 'page' && tab.title.includes('单曲卡片'));
  const client = await cdpClient(page.webSocketDebuggerUrl);
  try {
    await client.send('Runtime.enable');
    const expression = `(() => {
      function interesting(value) {
        return /rgb\\((?:9[0-9]|1[0-4][0-9]|2[0-5][0-9]),\\s*(?:1[0-9][0-9]|2[0-5][0-9]),\\s*(?:[0-9]|[1-9][0-9]|1[01][0-9])\\)/.test(value)
          || /rgb\\((?:2[0-5][0-9]),\\s*(?:1[0-9][0-9]),\\s*(?:[0-9]|[1-9][0-9])\\)/.test(value)
          || /rgb\\(96,\\s*190,\\s*48\\)/.test(value)
          || /rgb\\(237,\\s*168,\\s*54\\)/.test(value);
      }
      return Array.from(document.querySelectorAll('body *')).map((e, idx) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return {
          idx,
          tag: e.tagName,
          cls: String(e.className || '').slice(0, 120),
          text: String(e.innerText || e.textContent || '').trim().slice(0, 80),
          bg: s.backgroundColor,
          color: s.color,
          border: s.borderColor,
          fill: s.fill,
          stroke: s.stroke,
          w: Number(r.width.toFixed(1)),
          h: Number(r.height.toFixed(1)),
          top: Number(r.top.toFixed(1)),
          left: Number(r.left.toFixed(1)),
        };
      }).filter((x) => [x.bg, x.color, x.border, x.fill, x.stroke].some(interesting)).slice(0, 300);
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
