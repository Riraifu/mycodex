'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const homeDir = os.homedir();
const codexDir = path.join(homeDir, '.codex');
const agentsDir = path.join(homeDir, '.agents');
const pluginCacheDir = path.join(codexDir, 'plugins', 'cache');

function safeId(value) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'plugin';
}

function hasSkillChildren(skillsDir) {
  try {
    return fs.readdirSync(skillsDir, { withFileTypes: true })
      .some((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsDir, entry.name, 'SKILL.md')));
  } catch {
    return false;
  }
}

function discoverPluginSources(root = pluginCacheDir) {
  const sources = [];

  function visit(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    if (path.basename(dir) === 'skills' && hasSkillChildren(dir)) {
      const relative = path.relative(root, path.dirname(dir));
      const label = relative || path.dirname(dir);
      sources.push({
        id: safeId(relative),
        label,
        skillsDir: dir,
        disabledDir: path.join(path.dirname(dir), 'skills.disabled')
      });
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        visit(path.join(dir, entry.name));
      }
    }
  }

  visit(root);
  return sources.sort((a, b) => a.label.localeCompare(b.label));
}

const personalSkillsDir = path.join(codexDir, 'skills');

const categories = [
  {
    id: 'personal',
    label: 'Personal',
    description: 'Your user-level Codex skills.',
    sources: [{
      id: 'personal',
      label: 'Personal',
      skillsDir: personalSkillsDir,
      disabledDir: path.join(codexDir, 'skills.disabled'),
      reservedNames: new Set(['skill-switchboard'])
    }]
  },
  {
    id: 'system',
    label: 'System',
    description: 'Codex system skills under ~/.codex/skills/.system.',
    warning: 'System skills may be restored by Codex updates.',
    sources: [{
      id: 'system',
      label: 'System',
      skillsDir: path.join(personalSkillsDir, '.system'),
      disabledDir: path.join(codexDir, 'skills', '.system.disabled')
    }]
  },
  {
    id: 'agent',
    label: 'Agent',
    description: 'Agent skills under ~/.agents/skills.',
    sources: [{
      id: 'agent',
      label: 'Agent',
      skillsDir: path.join(agentsDir, 'skills'),
      disabledDir: path.join(agentsDir, 'skills.disabled')
    }]
  },
  {
    id: 'plugins',
    label: 'Plugins',
    description: 'Skills provided by installed plugin caches.',
    warning: 'Plugin updates may restore or overwrite plugin skill changes.',
    sources: discoverPluginSources()
  }
];

module.exports = {
  host: process.env.SKILL_SWITCHBOARD_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.SKILL_SWITCHBOARD_PORT || '8787', 10),
  categories,
  skillsDir: personalSkillsDir,
  disabledDir: path.join(codexDir, 'skills.disabled'),
  reservedNames: new Set(['skill-switchboard'])
};
