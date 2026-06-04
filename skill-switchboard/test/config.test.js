'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { buildCategories, defaultDisabledDirFor, expandHome } = require('../src/config');

test('defaultDisabledDirFor uses sibling skills.disabled for skills directories', () => {
  assert.equal(
    defaultDisabledDirFor('/tmp/.continue/skills'),
    '/tmp/.continue/skills.disabled'
  );
  assert.equal(
    defaultDisabledDirFor('/tmp/custom-skill-root'),
    '/tmp/custom-skill-root.disabled'
  );
});

test('buildCategories includes custom skill directories in a separate category', () => {
  const customDir = path.join(os.tmpdir(), 'external-skills');
  const categories = buildCategories({
    homeDir: '/Users/example',
    customSkillDirectories: [
      { label: 'Continue', skillsDir: '~/.continue/skills' },
      { label: 'Extra', skillsDir: customDir, disabledDir: `${customDir}.off` }
    ],
    pluginSources: []
  });

  const custom = categories.find((category) => category.id === 'custom');

  assert.equal(custom.label, 'Custom');
  assert.deepEqual(custom.sources.map((source) => [source.id, source.label, source.skillsDir, source.disabledDir]), [
    ['continue', 'Continue', '/Users/example/.continue/skills', '/Users/example/.continue/skills.disabled'],
    ['claude', 'Claude', '/Users/example/.claude/skills', '/Users/example/.claude/skills.disabled'],
    ['tme-claude', 'TME Claude', '/Users/example/.tme-claude/skills', '/Users/example/.tme-claude/skills.disabled'],
    ['extra', 'Extra', customDir, `${customDir}.off`]
  ]);
});

test('expandHome expands tilde paths only at the start', () => {
  assert.equal(expandHome('~/skills', '/Users/example'), '/Users/example/skills');
  assert.equal(expandHome('/tmp/~/skills', '/Users/example'), '/tmp/~/skills');
});
