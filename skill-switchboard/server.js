'use strict';

const config = require('./src/config');
const { createServer } = require('./src/server');
const { createSwitchboardStore } = require('./src/skillStore');

const store = createSwitchboardStore({ categories: config.categories });
const server = createServer({ store });

server.listen(config.port, config.host, () => {
  console.log(`Skill Switchboard running at http://${config.host}:${config.port}`);
  for (const category of config.categories) {
    console.log(`${category.label}: ${category.sources.length} source(s)`);
  }
});
