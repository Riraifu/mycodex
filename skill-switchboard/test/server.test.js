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
});
