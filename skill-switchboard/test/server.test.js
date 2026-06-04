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
  const publicDir = path.join(root, 'public');

  await fs.mkdir(path.join(skillsDir, 'brainstorming'), { recursive: true });
  await fs.writeFile(path.join(skillsDir, 'brainstorming', 'SKILL.md'), '---\nname: brainstorming\n---\n');
  await fs.mkdir(disabledDir, { recursive: true });
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, 'index.html'), '<h1>ok</h1>');

  const store = createSkillStore({
    skillsDir,
    disabledDir,
    reservedNames: new Set(['.system', 'skill-switchboard'])
  });
  const server = createServer({ store, publicDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return { server, baseUrl };
}

test('GET /api/skills returns skill list', async (t) => {
  const { server, baseUrl } = await makeFixture();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/skills`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.skills[0].name, 'brainstorming');
  assert.equal(body.skills[0].enabled, true);
});

test('POST /api/skills/:name/toggle toggles a skill', async (t) => {
  const { server, baseUrl } = await makeFixture();
  t.after(() => server.close());

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

test('GET / serves the static app', async (t) => {
  const { server, baseUrl } = await makeFixture();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/`);
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(text, /ok/);
});

test('POST /api/skills/bulk sets all editable skills to requested state', async (t) => {
  const { server, baseUrl } = await makeFixture();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/skills/bulk`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.result.enabled, false);
  assert.deepEqual(body.result.changed.map((skill) => skill.name), ['brainstorming']);
});


test('GET /api/health reports available features', async (t) => {
  const { server, baseUrl } = await makeFixture();
  t.after(() => server.close());

  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.features.includes('bulk'), true);
  assert.equal(body.features.includes('custom-directories'), true);
  assert.equal(body.features.includes('source-filtering'), true);
});

test('category API lists categories and toggles only within the requested category', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-switchboard-category-http-'));
  const personalDir = path.join(root, 'personal');
  const personalDisabledDir = path.join(root, 'personal.disabled');
  const agentDir = path.join(root, 'agent');
  const agentDisabledDir = path.join(root, 'agent.disabled');
  const publicDir = path.join(root, 'public');

  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, 'index.html'), '<h1>ok</h1>');
  await fs.mkdir(path.join(personalDir, 'brainstorming'), { recursive: true });
  await fs.writeFile(path.join(personalDir, 'brainstorming', 'SKILL.md'), '---\nname: brainstorming\n---\n');
  await fs.mkdir(path.join(agentDir, 'gold-trump-monitor'), { recursive: true });
  await fs.writeFile(path.join(agentDir, 'gold-trump-monitor', 'SKILL.md'), '---\nname: gold-trump-monitor\n---\n');

  const { createSwitchboardStore } = require('../src/skillStore');
  const store = createSwitchboardStore({
    categories: [
      { id: 'personal', label: 'Personal', sources: [{ id: 'personal', label: 'Personal', skillsDir: personalDir, disabledDir: personalDisabledDir }] },
      { id: 'agent', label: 'Agent', sources: [{ id: 'agent', label: 'Agent', skillsDir: agentDir, disabledDir: agentDisabledDir }] }
    ]
  });
  const server = createServer({ store, publicDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const categories = await (await fetch(`${baseUrl}/api/categories`)).json();
  assert.deepEqual(categories.categories.map((category) => category.id), ['personal', 'agent']);

  const agent = await (await fetch(`${baseUrl}/api/categories/agent/skills`)).json();
  assert.deepEqual(agent.skills.map((skill) => skill.name), ['gold-trump-monitor']);

  const response = await fetch(`${baseUrl}/api/categories/agent/skills/gold-trump-monitor/toggle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: false })
  });
  assert.equal(response.status, 200);
  assert.equal((await fs.stat(path.join(agentDisabledDir, 'gold-trump-monitor', 'SKILL.md'))).isFile(), true);
  assert.equal((await fs.stat(path.join(personalDir, 'brainstorming', 'SKILL.md'))).isFile(), true);
});

test('category API filters skills by sourceId query parameter', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-switchboard-source-http-'));
  const continueDir = path.join(root, 'continue', 'skills');
  const continueDisabledDir = path.join(root, 'continue', 'skills.disabled');
  const claudeDir = path.join(root, 'claude', 'skills');
  const claudeDisabledDir = path.join(root, 'claude', 'skills.disabled');
  const publicDir = path.join(root, 'public');

  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, 'index.html'), '<h1>ok</h1>');
  await fs.mkdir(path.join(continueDir, 'continue-only'), { recursive: true });
  await fs.writeFile(path.join(continueDir, 'continue-only', 'SKILL.md'), '---\nname: continue-only\n---\n');
  await fs.mkdir(path.join(claudeDir, 'claude-only'), { recursive: true });
  await fs.writeFile(path.join(claudeDir, 'claude-only', 'SKILL.md'), '---\nname: claude-only\n---\n');

  const { createSwitchboardStore } = require('../src/skillStore');
  const store = createSwitchboardStore({
    categories: [{
      id: 'custom',
      label: 'Custom',
      sources: [
        { id: 'continue', label: 'Continue', skillsDir: continueDir, disabledDir: continueDisabledDir },
        { id: 'claude', label: 'Claude', skillsDir: claudeDir, disabledDir: claudeDisabledDir }
      ]
    }]
  });
  const server = createServer({ store, publicDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const categories = await (await fetch(`${baseUrl}/api/categories`)).json();
  assert.deepEqual(categories.categories[0].sources.map((source) => [source.id, source.total]), [['continue', 1], ['claude', 1]]);

  const claude = await (await fetch(`${baseUrl}/api/categories/custom/skills?sourceId=claude`)).json();
  assert.deepEqual(claude.skills.map((skill) => skill.name), ['claude-only']);
});
