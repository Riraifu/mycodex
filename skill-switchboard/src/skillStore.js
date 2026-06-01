'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const VALID_NAME = /^[A-Za-z0-9._-]+$/;
const VALID_ID = /^[A-Za-z0-9._:-]+$/;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertValidName(name) {
  if (!name || typeof name !== 'string' || !VALID_NAME.test(name) || name.includes('..') || name.includes('/')) {
    throw createHttpError(400, 'Invalid skill name');
  }
}

function assertValidId(id, label = 'Invalid id') {
  if (!id || typeof id !== 'string' || !VALID_ID.test(id) || id.includes('..') || id.includes('/')) {
    throw createHttpError(400, label);
  }
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

function normalizeSources({ skillsDir, disabledDir, reservedNames = new Set(), sources }) {
  if (sources && sources.length > 0) {
    return sources.map((source, index) => ({
      id: source.id || `source-${index + 1}`,
      label: source.label || source.id || `Source ${index + 1}`,
      skillsDir: source.skillsDir,
      disabledDir: source.disabledDir,
      reservedNames: source.reservedNames || reservedNames
    }));
  }

  return [{
    id: 'default',
    label: 'Default',
    skillsDir,
    disabledDir,
    reservedNames
  }];
}

function createSkillStore(options) {
  const sources = normalizeSources(options);
  const hasMultipleSources = sources.length > 1;

  function isReserved(name, source = sources[0]) {
    return name.startsWith('.') || source.reservedNames.has(name);
  }

  function skillPath(source, enabled, name) {
    return path.join(enabled ? source.skillsDir : source.disabledDir, name);
  }

  function skillId(source, name) {
    return hasMultipleSources ? `${source.id}:${name}` : name;
  }

  async function readSkillEntries(source, parent, enabled) {
    await fs.mkdir(parent, { recursive: true });
    const entries = await fs.readdir(parent, { withFileTypes: true });
    const skills = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(parent, entry.name);
      if (!(await hasSkillFile(dir))) continue;
      skills.push({
        id: skillId(source, entry.name),
        name: entry.name,
        enabled,
        reserved: isReserved(entry.name, source),
        path: dir,
        sourceId: source.id,
        sourceLabel: source.label
      });
    }

    return skills;
  }

  async function listSkills() {
    const all = [];

    for (const source of sources) {
      const enabled = await readSkillEntries(source, source.skillsDir, true);
      const disabled = await readSkillEntries(source, source.disabledDir, false);
      const byId = new Map();

      for (const skill of [...enabled, ...disabled]) {
        const existing = byId.get(skill.id);
        if (!existing || skill.enabled) {
          byId.set(skill.id, skill);
        }
      }

      all.push(...byId.values());
    }

    return all.sort((a, b) => a.name.localeCompare(b.name) || a.sourceLabel.localeCompare(b.sourceLabel));
  }

  async function findSkill(inputId) {
    assertValidId(inputId, 'Invalid skill name');
    const skills = await listSkills();
    const skill = skills.find((candidate) => candidate.id === inputId || (!hasMultipleSources && candidate.name === inputId));
    if (!skill) {
      throw createHttpError(404, 'Skill not found');
    }
    const source = sources.find((candidate) => candidate.id === skill.sourceId);
    return { skill, source };
  }

  async function toggleSkill(inputId, enabled) {
    const { skill, source } = await findSkill(inputId);
    assertValidName(skill.name);
    if (isReserved(skill.name, source)) {
      throw createHttpError(403, 'This skill is reserved and cannot be toggled');
    }

    if (skill.enabled === enabled) {
      return skill;
    }

    const from = skillPath(source, !enabled, skill.name);
    const to = skillPath(source, enabled, skill.name);

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
      ...skill,
      enabled,
      reserved: false,
      path: to
    };
  }

  async function setAllSkills(enabled) {
    const skills = await listSkills();
    const changed = [];
    const skipped = [];

    for (const skill of skills) {
      if (skill.reserved) {
        skipped.push({ ...skill, reason: 'reserved' });
        continue;
      }

      if (skill.enabled === enabled) {
        skipped.push({ ...skill, reason: 'already-set' });
        continue;
      }

      try {
        changed.push(await toggleSkill(skill.id, enabled));
      } catch (error) {
        skipped.push({ ...skill, reason: error.message || 'failed' });
      }
    }

    return {
      enabled,
      changed,
      skipped
    };
  }

  return {
    listSkills,
    toggleSkill,
    setAllSkills,
    isReserved
  };
}

function createSwitchboardStore({ categories }) {
  const stores = new Map(categories.map((category) => [category.id, {
    ...category,
    store: createSkillStore({ sources: category.sources, reservedNames: category.reservedNames || new Set() })
  }]));

  function getCategory(categoryId) {
    assertValidId(categoryId, 'Invalid category id');
    const category = stores.get(categoryId);
    if (!category) {
      throw createHttpError(404, 'Category not found');
    }
    return category;
  }

  async function listCategories() {
    const result = [];
    for (const category of stores.values()) {
      const skills = await category.store.listSkills();
      const editable = skills.filter((skill) => !skill.reserved);
      result.push({
        id: category.id,
        label: category.label,
        description: category.description || '',
        warning: category.warning || '',
        total: skills.length,
        enabled: editable.filter((skill) => skill.enabled).length,
        disabled: editable.filter((skill) => !skill.enabled).length
      });
    }
    return result;
  }

  async function listSkills(categoryId = 'personal') {
    return getCategory(categoryId).store.listSkills();
  }

  async function toggleSkill(categoryId, skillId, enabled) {
    return getCategory(categoryId).store.toggleSkill(skillId, enabled);
  }

  async function setAllSkills(categoryId, enabled) {
    return getCategory(categoryId).store.setAllSkills(enabled);
  }

  return {
    listCategories,
    listSkills,
    toggleSkill,
    setAllSkills
  };
}

module.exports = {
  createSkillStore,
  createSwitchboardStore,
  createHttpError
};
