# Skill Switchboard

Local web panel for enabling and disabling personal Codex skills.

## Safety Model

The app does not delete or edit skill files. It toggles a skill by moving its directory between:

- Enabled: `/Users/liyizhu/.codex/skills/<skill-name>`
- Disabled: `/Users/liyizhu/.codex/skills.disabled/<skill-name>`

The web UI separates skills into categories so different skill sources are not mixed together:

- Personal: `/Users/liyizhu/.codex/skills`
- System: `/Users/liyizhu/.codex/skills/.system`
- Agent: `/Users/liyizhu/.agents/skills`
- Custom: configured directories such as `/Users/liyizhu/.continue/skills`, `/Users/liyizhu/.claude/skills`, and `/Users/liyizhu/.tme-claude/skills`
- Plugins: discovered under `/Users/liyizhu/.codex/plugins/cache/**/skills`

Each category has its own list, individual toggles, and enable-all/disable-all actions. Plugin skills live in plugin cache directories, so plugin updates may restore or overwrite plugin skill changes.

## Custom Skill Directories

The `Custom` category includes these default directories:

```text
/Users/liyizhu/.continue/skills
/Users/liyizhu/.claude/skills
/Users/liyizhu/.tme-claude/skills
```

To add more directories, edit:

```text
/Users/liyizhu/mycodex/skill-switchboard/custom-skill-directories.json
```

Example:

```json
{
  "directories": [
    {
      "id": "my-extra-skills",
      "label": "My Extra Skills",
      "skillsDir": "~/path/to/skills",
      "disabledDir": "~/path/to/skills.disabled"
    }
  ]
}
```

If `disabledDir` is omitted, the switchboard uses a sibling disabled directory. For example, `~/foo/skills` becomes `~/foo/skills.disabled`.

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
