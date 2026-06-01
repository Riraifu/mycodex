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
