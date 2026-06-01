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
