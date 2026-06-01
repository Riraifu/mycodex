# Skill Switchboard

Local web panel for enabling and disabling personal Codex skills.

## Safety Model

The app does not delete or edit skill files. It toggles a skill by moving its directory between:

- Enabled: `/Users/liyizhu/.codex/skills/<skill-name>`
- Disabled: `/Users/liyizhu/.codex/skills.disabled/<skill-name>`

Reserved entries such as `.system` and hidden directories cannot be toggled.

## Usage

```bash
npm test
npm start
```

Open:

```text
http://127.0.0.1:8787
```

## Double-Click Launcher

There is also a macOS launcher:

```text
/Users/liyizhu/Desktop/Skill Switchboard.command
```

Double-click it to start the local server if needed and open the web panel automatically.

## Environment Overrides

```bash
SKILL_SWITCHBOARD_PORT=8788 npm start
SKILL_SWITCHBOARD_SKILLS_DIR=/tmp/skills SKILL_SWITCHBOARD_DISABLED_DIR=/tmp/skills.disabled npm test
```
