'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('desktop launcher command starts the server in the background and opens the page', async () => {
  const launcherPath = path.join(__dirname, '..', 'Skill Switchboard.command');
  const content = await fs.readFile(launcherPath, 'utf8');

  assert.match(content, /^#!\/bin\/zsh/);
  assert.match(content, /APP_DIR="\/Users\/liyizhu\/mycodex\/skill-switchboard"/);
  assert.match(content, /launchctl bootstrap/);
  assert.match(content, /com\.codex\.skill-switchboard/);
  assert.match(content, /ProgramArguments/);
  assert.match(content, /open "\$URL"/);
  assert.match(content, /curl -fsS "\$URL\/api\/health"/);
  assert.match(content, /source-filtering/);
  assert.match(content, /lsof -tiTCP:8787 -sTCP:LISTEN/);
  assert.match(content, /kill "\$existing_pid"/);
});
