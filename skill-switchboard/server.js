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
