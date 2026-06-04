'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const homeDir = os.homedir();
const codexDir = path.join(homeDir, '.codex');
const agentsDir = path.join(homeDir, '.agents');
const pluginCacheDir = path.join(codexDir, 'plugins', 'cache');
const customConfigPath = process.env.SKILL_SWITCHBOARD_CUSTOM_CONFIG || path.join(__dirname, '..', 'custom-skill-directories.json');

function safeId(value) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'source';
}

function expandHome(targetPath, baseHomeDir = homeDir) {
  if (targetPath === '~') return baseHomeDir;
  if (targetPath.startsWith('~/')) return path.join(baseHomeDir, targetPath.slice(2));
  return targetPath;
}

function defaultDisabledDirFor(skillsDir) {
  if (path.basename(skillsDir) === 'skills') {
    return path.join(path.dirname(skillsDir), 'skills.disabled');
  }
  return `${skillsDir}.disabled`;
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

function readCustomSkillDirectories(filePath = customConfigPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(parsed.directories)) return [];
    return parsed.directories.filter((entry) => entry && entry.label && entry.skillsDir);
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

function customSource(entry, index, baseHomeDir = homeDir) {
  const skillsDir = expandHome(entry.skillsDir, baseHomeDir);
  const disabledDir = entry.disabledDir ? expandHome(entry.disabledDir, baseHomeDir) : defaultDisabledDirFor(skillsDir);
  return {
    id: safeId(entry.id || entry.label || `custom-${index + 1}`),
    label: entry.label,
    skillsDir,
    disabledDir
  };
}

function defaultCustomDirectories(baseHomeDir = homeDir) {
  return [
    { id: 'continue', label: 'Continue', skillsDir: path.join(baseHomeDir, '.continue', 'skills') },
    { id: 'claude', label: 'Claude', skillsDir: path.join(baseHomeDir, '.claude', 'skills') },
    { id: 'tme-claude', label: 'TME Claude', skillsDir: path.join(baseHomeDir, '.tme-claude', 'skills') }
  ];
}

function buildCustomSources({ baseHomeDir = homeDir, customSkillDirectories = [], includeDefaults = true } = {}) {
  const directories = [
    ...(includeDefaults ? defaultCustomDirectories(baseHomeDir) : []),
    ...customSkillDirectories
  ];
  const byId = new Map();

  directories.forEach((entry, index) => {
    const source = customSource(entry, index, baseHomeDir);
    byId.set(source.id, source);
  });

  return [...byId.values()];
}

function buildCategories({
  homeDir: baseHomeDir = homeDir,
  customSkillDirectories = readCustomSkillDirectories(),
  pluginSources = discoverPluginSources(path.join(baseHomeDir, '.codex', 'plugins', 'cache'))
} = {}) {
  const baseCodexDir = path.join(baseHomeDir, '.codex');
  const baseAgentsDir = path.join(baseHomeDir, '.agents');
  const personalSkillsDir = path.join(baseCodexDir, 'skills');
  const customSources = buildCustomSources({ baseHomeDir, customSkillDirectories });

  return [
    {
      id: 'personal',
      label: 'Personal',
      description: 'Your user-level Codex skills.',
      sources: [{
        id: 'personal',
        label: 'Personal',
        skillsDir: personalSkillsDir,
        disabledDir: path.join(baseCodexDir, 'skills.disabled'),
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
        disabledDir: path.join(baseCodexDir, 'skills', '.system.disabled')
      }]
    },
    {
      id: 'agent',
      label: 'Agent',
      description: 'Agent skills under ~/.agents/skills.',
      sources: [{
        id: 'agent',
        label: 'Agent',
        skillsDir: path.join(baseAgentsDir, 'skills'),
        disabledDir: path.join(baseAgentsDir, 'skills.disabled')
      }]
    },
    {
      id: 'custom',
      label: 'Custom',
      description: 'Configured skill directories such as ~/.continue, ~/.claude, and ~/.tme-claude.',
      warning: 'Custom directories are managed by their own tools; updates may recreate disabled skills.',
      sources: customSources
    },
    {
      id: 'plugins',
      label: 'Plugins',
      description: 'Skills provided by installed plugin caches.',
      warning: 'Plugin updates may restore or overwrite plugin skill changes.',
      sources: pluginSources
    }
  ];
}

const categories = buildCategories();
const personalSkillsDir = path.join(codexDir, 'skills');

module.exports = {
  host: process.env.SKILL_SWITCHBOARD_HOST || '127.0.0.1',
  port: Number.parseInt(process.env.SKILL_SWITCHBOARD_PORT || '8787', 10),
  categories,
  skillsDir: personalSkillsDir,
  disabledDir: path.join(codexDir, 'skills.disabled'),
  reservedNames: new Set(['skill-switchboard']),
  buildCategories,
  buildCustomSources,
  defaultDisabledDirFor,
  discoverPluginSources,
  expandHome,
  readCustomSkillDirectories,
  safeId
};
