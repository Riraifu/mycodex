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

test('setAllSkills disables every editable enabled skill and skips reserved entries', async () => {
  const { skillsDir, disabledDir, store } = await makeTempStore();
  await createSkill(skillsDir, 'brainstorming');
  await createSkill(skillsDir, 'writing-plans');
  await createSkill(skillsDir, '.system');

  const result = await store.setAllSkills(false);

  assert.equal(result.enabled, false);
  assert.equal(result.changed.length, 2);
  assert.deepEqual(result.changed.map((skill) => skill.name).sort(), ['brainstorming', 'writing-plans']);
  assert.equal(result.skipped.some((skill) => skill.name === '.system' && skill.reason === 'reserved'), true);
  assert.equal((await fs.stat(path.join(disabledDir, 'brainstorming', 'SKILL.md'))).isFile(), true);
  assert.equal((await fs.stat(path.join(disabledDir, 'writing-plans', 'SKILL.md'))).isFile(), true);
  assert.equal((await fs.stat(path.join(skillsDir, '.system', 'SKILL.md'))).isFile(), true);
});

test('setAllSkills enables every editable disabled skill', async () => {
  const { skillsDir, disabledDir, store } = await makeTempStore();
  await createSkill(disabledDir, 'brainstorming');
  await createSkill(disabledDir, 'writing-plans');

  const result = await store.setAllSkills(true);

  assert.equal(result.enabled, true);
  assert.deepEqual(result.changed.map((skill) => skill.name).sort(), ['brainstorming', 'writing-plans']);
  assert.equal((await fs.stat(path.join(skillsDir, 'brainstorming', 'SKILL.md'))).isFile(), true);
  assert.equal((await fs.stat(path.join(skillsDir, 'writing-plans', 'SKILL.md'))).isFile(), true);
});

test('createSwitchboardStore keeps categories separated and supports plugin source ids', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-switchboard-categories-'));
  const personalDir = path.join(root, 'personal');
  const personalDisabledDir = path.join(root, 'personal.disabled');
  const agentDir = path.join(root, 'agent');
  const agentDisabledDir = path.join(root, 'agent.disabled');
  const pluginDir = path.join(root, 'plugins', 'browser', 'skills');
  const pluginDisabledDir = path.join(root, 'plugins', 'browser', 'skills.disabled');

  await createSkill(personalDir, 'brainstorming');
  await createSkill(agentDir, 'gold-trump-monitor');
  await createSkill(pluginDir, 'browser');

  const { createSwitchboardStore } = require('../src/skillStore');
  const store = createSwitchboardStore({
    categories: [
      { id: 'personal', label: 'Personal', sources: [{ id: 'personal', label: 'Personal', skillsDir: personalDir, disabledDir: personalDisabledDir }] },
      { id: 'agent', label: 'Agent', sources: [{ id: 'agent', label: 'Agent', skillsDir: agentDir, disabledDir: agentDisabledDir }] },
      { id: 'plugins', label: 'Plugins', sources: [{ id: 'browser-plugin', label: 'Browser plugin', skillsDir: pluginDir, disabledDir: pluginDisabledDir }] }
    ]
  });

  const personal = await store.listSkills('personal');
  const agent = await store.listSkills('agent');
  const plugins = await store.listSkills('plugins');

  assert.deepEqual(personal.map((skill) => skill.name), ['brainstorming']);
  assert.deepEqual(agent.map((skill) => skill.name), ['gold-trump-monitor']);
  assert.deepEqual(plugins.map((skill) => [skill.name, skill.sourceLabel]), [['browser', 'Browser plugin']]);

  await store.toggleSkill('plugins', plugins[0].id, false);
  assert.equal((await fs.stat(path.join(pluginDisabledDir, 'browser', 'SKILL.md'))).isFile(), true);
  assert.equal((await fs.stat(path.join(personalDir, 'brainstorming', 'SKILL.md'))).isFile(), true);
});
