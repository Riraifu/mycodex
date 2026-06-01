# Skill Switchboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local browser panel that toggles personal Codex skills on and off by safely moving skill directories between enabled and disabled parent folders.

**Architecture:** A dependency-free Node.js server exposes a JSON API and serves a static UI. Filesystem logic is isolated in `skillStore.js` so it can be tested with temporary directories before wiring it into HTTP and browser interactions.

**Tech Stack:** Node.js CommonJS, built-in `http`, `fs/promises`, `node:test`, static HTML/CSS/JS.

---

## File Structure

- Create: `skill-switchboard/package.json` declares scripts and Node runtime type.
- Create: `skill-switchboard/README.md` explains usage and safety model.
- Create: `skill-switchboard/src/config.js` defines default paths, host, port, and reserved names.
- Create: `skill-switchboard/src/skillStore.js` owns listing, validation, and toggle filesystem operations.
- Create: `skill-switchboard/src/server.js` owns HTTP routing and static file serving.
- Create: `skill-switchboard/server.js` starts the app from the project root.
- Create: `skill-switchboard/public/index.html` renders the app shell.
- Create: `skill-switchboard/public/styles.css` gives the panel a clear visual design.
- Create: `skill-switchboard/public/app.js` calls the API and manages browser state.
- Create: `skill-switchboard/test/skillStore.test.js` tests filesystem behavior using temporary directories.
- Create: `skill-switchboard/test/server.test.js` tests HTTP API behavior using temporary directories.

### Task 1: Project Scaffold

**Files:**
- Create: `skill-switchboard/package.json`
- Create: `skill-switchboard/README.md`
- Create: `skill-switchboard/src/config.js`
- Create: `skill-switchboard/server.js`

- [ ] **Step 1: Create package metadata**

Create `skill-switchboard/package.json`:

```json
{
  "name": "skill-switchboard",
  "version": "1.0.0",
  "private": true,
  "description": "Local web switchboard for enabling and disabling personal Codex skills.",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: Create runtime config**

Create `skill-switchboard/src/config.js`:

```js
'use strict';

const path = require('node:path');
const os = require('node:os');

const codexDir = path.join(os.homedir(), '.codex');

module.exports = {
  host: process.env.SKILL_SWITCHBOARD_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.SKILL_SWITCHBOARD_PORT || '8787', 10),
  skillsDir: process.env.SKILL_SWITCHBOARD_SKILLS_DIR || path.join(codexDir, 'skills'),
  disabledDir: process.env.SKILL_SWITCHBOARD_DISABLED_DIR || path.join(codexDir, 'skills.disabled'),
  reservedNames: new Set(['.system', 'skill-switchboard'])
};
```

- [ ] **Step 3: Create root server launcher**

Create `skill-switchboard/server.js`:

```js
'use strict';

const config = require('./src/config');
const { createServer } = require('./src/server');
const { createSkillStore } = require('./src/skillStore');

const store = createSkillStore({
  skillsDir: config.skillsDir,
  disabledDir: config.disabledDir,
  reservedNames: config.reservedNames
});

const server = createServer({ store });

server.listen(config.port, config.host, () => {
  console.log(`Skill Switchboard running at http://${config.host}:${config.port}`);
  console.log(`Enabled skills: ${config.skillsDir}`);
  console.log(`Disabled skills: ${config.disabledDir}`);
});
```

- [ ] **Step 4: Create README**

Create `skill-switchboard/README.md`:

```markdown
# Skill Switchboard

Local web panel for enabling and disabling personal Codex skills.

## Safety Model

The app does not delete or edit skill files. It toggles a skill by moving its directory between:

- Enabled: `/Users/liyizhu/.codex/skills/<skill-name>`
- Disabled: `/Users/liyizhu/.codex/skills.disabled/<skill-name>`

Reserved entries such as `.system` and hidden directories cannot be toggled.

## Usage

```bash
npm test
npm start
```

Open:

```text
http://127.0.0.1:8787
```

## Environment Overrides

```bash
SKILL_SWITCHBOARD_PORT=8788 npm start
SKILL_SWITCHBOARD_SKILLS_DIR=/tmp/skills SKILL_SWITCHBOARD_DISABLED_DIR=/tmp/skills.disabled npm test
```
```

- [ ] **Step 5: Run scaffold check**

Run: `node -e "require('./skill-switchboard/src/config'); console.log('config ok')"`

Expected: prints `config ok`.

### Task 2: Skill Store Tests and Implementation

**Files:**
- Create: `skill-switchboard/src/skillStore.js`
- Create: `skill-switchboard/test/skillStore.test.js`

- [ ] **Step 1: Write failing store tests**

Create `skill-switchboard/test/skillStore.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createSkillStore } = require('../src/skillStore');

async function makeTempStore() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-switchboard-'));
  const skillsDir = path.join(root, 'skills');
  const disabledDir = path.join(root, 'skills.disabled');
  await fs.mkdir(skillsDir, { recursive: true });
  await fs.mkdir(disabledDir, { recursive: true });
  const store = createSkillStore({
    skillsDir,
    disabledDir,
    reservedNames: new Set(['.system', 'skill-switchboard'])
  });
  return { root, skillsDir, disabledDir, store };
}

async function createSkill(parent, name) {
  const dir = path.join(parent, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'SKILL.md'), `---\nname: ${name}\n---\n`, 'utf8');
  return dir;
}

test('listSkills returns enabled and disabled skills sorted by name', async () => {
  const { skillsDir, disabledDir, store } = await makeTempStore();
  await createSkill(skillsDir, 'brainstorming');
  await createSkill(disabledDir, 'call-me-boss');

  const skills = await store.listSkills();

  assert.deepEqual(skills.map((skill) => [skill.name, skill.enabled, skill.reserved]), [
    ['brainstorming', true, false],
    ['call-me-boss', false, false]
  ]);
});

test('toggleSkill disables an enabled skill without deleting it', async () => {
  const { skillsDir, disabledDir, store } = await makeTempStore();
  await createSkill(skillsDir, 'brainstorming');

  const result = await store.toggleSkill('brainstorming', false);

  assert.equal(result.enabled, false);
  await assert.rejects(fs.stat(path.join(skillsDir, 'brainstorming')));
  const moved = await fs.stat(path.join(disabledDir, 'brainstorming', 'SKILL.md'));
  assert.equal(moved.isFile(), true);
});

test('toggleSkill enables a disabled skill', async () => {
  const { skillsDir, disabledDir, store } = await makeTempStore();
  await createSkill(disabledDir, 'call-me-boss');

  const result = await store.toggleSkill('call-me-boss', true);

  assert.equal(result.enabled, true);
  const moved = await fs.stat(path.join(skillsDir, 'call-me-boss', 'SKILL.md'));
  assert.equal(moved.isFile(), true);
});

test('toggleSkill rejects reserved skills', async () => {
  const { skillsDir, store } = await makeTempStore();
  await createSkill(skillsDir, '.system');

  await assert.rejects(
    store.toggleSkill('.system', false),
    /reserved/i
  );
});

test('toggleSkill rejects destination conflicts', async () => {
  const { skillsDir, disabledDir, store } = await makeTempStore();
  await createSkill(skillsDir, 'brainstorming');
  await createSkill(disabledDir, 'brainstorming');

  await assert.rejects(
    store.toggleSkill('brainstorming', false),
    /destination already exists/i
  );
});

test('toggleSkill rejects path traversal names', async () => {
  const { store } = await makeTempStore();

  await assert.rejects(
    store.toggleSkill('../brainstorming', false),
    /invalid skill name/i
  );
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `cd skill-switchboard && npm test`

Expected: FAIL because `../src/skillStore` does not exist.

- [ ] **Step 3: Implement skill store**

Create `skill-switchboard/src/skillStore.js`:

```js
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const VALID_NAME = /^[A-Za-z0-9._-]+$/;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function createSkillStore({ skillsDir, disabledDir, reservedNames = new Set() }) {
  function assertValidName(name) {
    if (!name || typeof name !== 'string' || !VALID_NAME.test(name) || name.includes('..') || name.includes('/')) {
      throw createHttpError(400, 'Invalid skill name');
    }
  }

  function isReserved(name) {
    return name.startsWith('.') || reservedNames.has(name);
  }

  function skillPath(enabled, name) {
    return path.join(enabled ? skillsDir : disabledDir, name);
  }

  async function exists(targetPath) {
    try {
      await fs.stat(targetPath);
      return true;
    } catch (error) {
      if (error && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async function hasSkillFile(dir) {
    try {
      const stat = await fs.stat(path.join(dir, 'SKILL.md'));
      return stat.isFile();
    } catch (error) {
      if (error && error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async function readSkillEntries(parent, enabled) {
    await fs.mkdir(parent, { recursive: true });
    const entries = await fs.readdir(parent, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(parent, entry.name);
      if (!(await hasSkillFile(dir)) && !isReserved(entry.name)) continue;
      skills.push({
        name: entry.name,
        enabled,
        reserved: isReserved(entry.name),
        path: dir
      });
    }

    return skills;
  }

  async function listSkills() {
    const enabled = await readSkillEntries(skillsDir, true);
    const disabled = await readSkillEntries(disabledDir, false);
    const byName = new Map();

    for (const skill of [...enabled, ...disabled]) {
      const existing = byName.get(skill.name);
      if (!existing || skill.enabled) {
        byName.set(skill.name, skill);
      }
    }

    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function toggleSkill(name, enabled) {
    assertValidName(name);
    if (isReserved(name)) {
      throw createHttpError(403, 'This skill is reserved and cannot be toggled');
    }

    const from = skillPath(!enabled, name);
    const to = skillPath(enabled, name);

    if (!(await exists(from))) {
      throw createHttpError(404, `Skill is not ${enabled ? 'disabled' : 'enabled'}`);
    }

    if (!(await hasSkillFile(from))) {
      throw createHttpError(400, 'Source directory is not a skill');
    }

    if (await exists(to)) {
      throw createHttpError(409, 'Destination already exists');
    }

    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.rename(from, to);

    return {
      name,
      enabled,
      reserved: false,
      path: to
    };
  }

  return {
    listSkills,
    toggleSkill,
    isReserved
  };
}

module.exports = {
  createSkillStore,
  createHttpError
};
```

- [ ] **Step 4: Run store tests**

Run: `cd skill-switchboard && npm test`

Expected: PASS for `skillStore.test.js` and FAIL for missing server only after server tests are added later.

### Task 3: HTTP Server Tests and Implementation

**Files:**
- Create: `skill-switchboard/src/server.js`
- Create: `skill-switchboard/test/server.test.js`

- [ ] **Step 1: Write failing server tests**

Create `skill-switchboard/test/server.test.js`:

```js
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../src/server');
const { createSkillStore } = require('../src/skillStore');

async function makeFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-switchboard-http-'));
  const skillsDir = path.join(root, 'skills');
  const disabledDir = path.join(root, 'skills.disabled');
  await fs.mkdir(path.join(skillsDir, 'brainstorming'), { recursive: true });
  await fs.writeFile(path.join(skillsDir, 'brainstorming', 'SKILL.md'), '---\nname: brainstorming\n---\n');
  await fs.mkdir(disabledDir, { recursive: true });
  const store = createSkillStore({ skillsDir, disabledDir, reservedNames: new Set(['.system', 'skill-switchboard']) });
  const server = createServer({ store, publicDir: path.join(root, 'public') });
  await fs.mkdir(path.join(root, 'public'), { recursive: true });
  await fs.writeFile(path.join(root, 'public', 'index.html'), '<h1>ok</h1>');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

test('GET /api/skills returns skill list', async () => {
  const { server, baseUrl } = await makeFixture();
  test.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/skills`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.skills[0].name, 'brainstorming');
  assert.equal(body.skills[0].enabled, true);
});

test('POST /api/skills/:name/toggle toggles a skill', async () => {
  const { server, baseUrl } = await makeFixture();
  test.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/skills/brainstorming/toggle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.skill.name, 'brainstorming');
  assert.equal(body.skill.enabled, false);
});

test('GET / serves the static app', async () => {
  const { server, baseUrl } = await makeFixture();
  test.after(() => server.close());

  const response = await fetch(`${baseUrl}/`);
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(text, /ok/);
});
```

- [ ] **Step 2: Run tests to verify server failure**

Run: `cd skill-switchboard && npm test`

Expected: FAIL because `../src/server` does not exist.

- [ ] **Step 3: Implement HTTP server**

Create `skill-switchboard/src/server.js`:

```js
'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function safeStaticPath(publicDir, requestPath) {
  const pathname = requestPath === '/' ? '/index.html' : requestPath;
  const decoded = decodeURIComponent(pathname);
  const target = path.normalize(path.join(publicDir, decoded));
  if (!target.startsWith(publicDir)) {
    return null;
  }
  return target;
}

async function serveStatic(request, response, publicDir) {
  const url = new URL(request.url, 'http://127.0.0.1');
  const target = safeStaticPath(publicDir, url.pathname);
  if (!target) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(target);
    const type = MIME_TYPES[path.extname(target)] || 'application/octet-stream';
    response.writeHead(200, { 'content-type': type });
    response.end(content);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    throw error;
  }
}

function createServer({ store, publicDir = DEFAULT_PUBLIC_DIR }) {
  const resolvedPublicDir = path.resolve(publicDir);

  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1');

      if (request.method === 'GET' && url.pathname === '/api/skills') {
        const skills = await store.listSkills();
        sendJson(response, 200, { skills });
        return;
      }

      const toggleMatch = url.pathname.match(/^\/api\/skills\/([^/]+)\/toggle$/);
      if (request.method === 'POST' && toggleMatch) {
        const body = await readJson(request);
        const name = decodeURIComponent(toggleMatch[1]);
        const skill = await store.toggleSkill(name, Boolean(body.enabled));
        sendJson(response, 200, { skill });
        return;
      }

      if (request.method === 'GET') {
        await serveStatic(request, response, resolvedPublicDir);
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const status = error.status || 500;
      sendJson(response, status, { error: error.message || 'Internal server error' });
    }
  });
}

module.exports = {
  createServer
};
```

- [ ] **Step 4: Run HTTP tests**

Run: `cd skill-switchboard && npm test`

Expected: PASS for store and server tests.

### Task 4: Browser UI

**Files:**
- Create: `skill-switchboard/public/index.html`
- Create: `skill-switchboard/public/styles.css`
- Create: `skill-switchboard/public/app.js`

- [ ] **Step 1: Create HTML app shell**

Create `skill-switchboard/public/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Skill Switchboard</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <p class="eyebrow">Codex Local Control</p>
        <h1>Skill Switchboard</h1>
        <p class="lede">一键开启或关闭个人 Codex skills。关闭时只会移动目录，不会删除或改写内容。</p>
      </section>

      <section class="toolbar" aria-label="Skill controls">
        <label class="search">
          <span>搜索 skill</span>
          <input id="search" type="search" placeholder="例如 brainstorming">
        </label>
        <button id="refresh" class="ghost" type="button">刷新</button>
      </section>

      <p id="message" class="message" role="status"></p>
      <section id="skills" class="skills" aria-live="polite"></section>
    </main>
    <script src="/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create CSS visual design**

Create `skill-switchboard/public/styles.css`:

```css
:root {
  --ink: #17211b;
  --muted: #647067;
  --paper: #fbf6ea;
  --card: rgba(255, 252, 243, 0.86);
  --line: rgba(23, 33, 27, 0.14);
  --green: #2e7d4f;
  --amber: #b36b19;
  --red: #b33a2f;
  --shadow: 0 24px 70px rgba(42, 33, 19, 0.16);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--ink);
  font-family: Georgia, 'Times New Roman', serif;
  background:
    radial-gradient(circle at 12% 18%, rgba(46, 125, 79, 0.22), transparent 28rem),
    radial-gradient(circle at 88% 8%, rgba(179, 107, 25, 0.2), transparent 24rem),
    linear-gradient(135deg, #f7edda 0%, #eaf1df 100%);
}

button,
input {
  font: inherit;
}

.shell {
  width: min(1080px, calc(100% - 32px));
  margin: 0 auto;
  padding: 48px 0;
}

.hero {
  padding: 34px;
  border: 1px solid var(--line);
  border-radius: 30px;
  background: var(--card);
  box-shadow: var(--shadow);
}

.eyebrow {
  margin: 0 0 10px;
  color: var(--green);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(2.4rem, 7vw, 5.8rem);
  line-height: 0.88;
}

.lede {
  max-width: 720px;
  margin: 22px 0 0;
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1.7;
}

.toolbar {
  display: flex;
  gap: 16px;
  align-items: end;
  justify-content: space-between;
  margin: 24px 0 14px;
}

.search {
  display: grid;
  gap: 8px;
  flex: 1;
  color: var(--muted);
  font-size: 0.92rem;
}

.search input {
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 14px 16px;
  background: rgba(255, 255, 255, 0.62);
  color: var(--ink);
  outline: none;
}

.search input:focus {
  border-color: rgba(46, 125, 79, 0.55);
  box-shadow: 0 0 0 4px rgba(46, 125, 79, 0.12);
}

.ghost,
.switch {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 12px 18px;
  background: var(--ink);
  color: #fffaf0;
  cursor: pointer;
  transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
}

.ghost:hover,
.switch:hover {
  transform: translateY(-1px);
}

.message {
  min-height: 24px;
  margin: 0 0 14px;
  color: var(--muted);
}

.message.error {
  color: var(--red);
}

.skills {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.card {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 24px;
  background: rgba(255, 252, 243, 0.78);
  box-shadow: 0 18px 44px rgba(42, 33, 19, 0.1);
}

.card header {
  display: flex;
  gap: 12px;
  align-items: start;
  justify-content: space-between;
}

.name {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 1.25rem;
}

.path {
  margin: 8px 0 0;
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.5;
}

.badge {
  border-radius: 999px;
  padding: 6px 10px;
  color: #fff;
  background: var(--green);
  font-size: 0.78rem;
  white-space: nowrap;
}

.badge.disabled {
  background: var(--amber);
}

.badge.reserved {
  background: var(--muted);
}

.switch {
  justify-self: start;
  min-width: 108px;
}

.switch.off {
  background: #fffaf0;
  color: var(--ink);
}

.switch:disabled {
  cursor: not-allowed;
  opacity: 0.54;
  transform: none;
}

.empty {
  grid-column: 1 / -1;
  padding: 28px;
  border: 1px dashed var(--line);
  border-radius: 24px;
  color: var(--muted);
  text-align: center;
}

@media (max-width: 640px) {
  .shell {
    width: min(100% - 20px, 1080px);
    padding: 20px 0;
  }

  .hero {
    padding: 24px;
  }

  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }
}
```

- [ ] **Step 3: Create browser logic**

Create `skill-switchboard/public/app.js`:

```js
'use strict';

const state = {
  skills: [],
  query: ''
};

const skillsEl = document.querySelector('#skills');
const messageEl = document.querySelector('#message');
const searchEl = document.querySelector('#search');
const refreshEl = document.querySelector('#refresh');

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('error', isError);
}

function statusLabel(skill) {
  if (skill.reserved) return 'Reserved';
  return skill.enabled ? 'Enabled' : 'Disabled';
}

function render() {
  const query = state.query.trim().toLowerCase();
  const visible = state.skills.filter((skill) => skill.name.toLowerCase().includes(query));
  skillsEl.innerHTML = '';

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? '没有匹配的 skill。' : '还没有找到可管理的 skill。';
    skillsEl.append(empty);
    return;
  }

  for (const skill of visible) {
    const card = document.createElement('article');
    card.className = 'card';

    const header = document.createElement('header');
    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'name';
    title.textContent = skill.name;
    const path = document.createElement('p');
    path.className = 'path';
    path.textContent = skill.path;
    titleWrap.append(title, path);

    const badge = document.createElement('span');
    badge.className = `badge ${skill.reserved ? 'reserved' : skill.enabled ? '' : 'disabled'}`;
    badge.textContent = statusLabel(skill);
    header.append(titleWrap, badge);

    const button = document.createElement('button');
    button.className = `switch ${skill.enabled ? '' : 'off'}`;
    button.type = 'button';
    button.disabled = skill.reserved;
    button.textContent = skill.reserved ? '受保护' : skill.enabled ? '关闭' : '开启';
    button.addEventListener('click', () => toggleSkill(skill));

    card.append(header, button);
    skillsEl.append(card);
  }
}

async function loadSkills() {
  setMessage('正在读取 skills...');
  const response = await fetch('/api/skills');
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || '读取失败');
  }
  state.skills = body.skills;
  setMessage(`已读取 ${state.skills.length} 个 skill。`);
  render();
}

async function toggleSkill(skill) {
  const nextEnabled = !skill.enabled;
  setMessage(`${nextEnabled ? '开启' : '关闭'} ${skill.name}...`);

  try {
    const response = await fetch(`/api/skills/${encodeURIComponent(skill.name)}/toggle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || '切换失败');
    }
    setMessage(`${body.skill.name} 已${body.skill.enabled ? '开启' : '关闭'}。`);
    await loadSkills();
  } catch (error) {
    setMessage(error.message, true);
  }
}

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  render();
});

refreshEl.addEventListener('click', () => {
  loadSkills().catch((error) => setMessage(error.message, true));
});

loadSkills().catch((error) => setMessage(error.message, true));
```

- [ ] **Step 4: Smoke test static files**

Run: `cd skill-switchboard && npm test`

Expected: PASS.

### Task 5: Final Verification

**Files:**
- Modify only if verification reveals issues.

- [ ] **Step 1: Run automated tests**

Run: `cd skill-switchboard && npm test`

Expected: all tests pass.

- [ ] **Step 2: Start the local server**

Run: `cd skill-switchboard && npm start`

Expected output includes `Skill Switchboard running at http://127.0.0.1:8787`.

- [ ] **Step 3: Verify API manually**

In another terminal, run: `curl -s http://127.0.0.1:8787/api/skills | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(Array.isArray(j.skills), j.skills.length)})"`

Expected: prints `true` followed by a number.

- [ ] **Step 4: Verify browser UI**

Open `http://127.0.0.1:8787` and confirm:

- Skill cards are visible.
- Search filters the list.
- Reserved entries show disabled controls.
- A non-critical skill can be toggled off and back on.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add skill-switchboard docs/superpowers/plans/2026-06-01-skill-switchboard.md
git commit -m "feat: add skill switchboard"
```

Expected: commit succeeds.
