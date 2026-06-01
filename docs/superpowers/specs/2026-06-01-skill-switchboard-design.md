# Skill Switchboard Design

## Goal

Create a local web panel that lets the user enable or disable personal Codex skills under `/Users/liyizhu/.codex/skills` with a one-click switch.

## Scope

The tool is a standalone local utility created under `/Users/liyizhu/mycodex/skill-switchboard`. It does not modify Codex itself, installed plugin skills, system skills, or skill contents.

In scope:

- List personal skills found in `/Users/liyizhu/.codex/skills`.
- List disabled skills found in `/Users/liyizhu/.codex/skills.disabled`.
- Toggle a skill by moving its whole directory between those two parent directories.
- Provide a browser UI with search, status labels, and on/off switches.
- Prevent unsafe filesystem operations, overwrites, and accidental management of reserved directories.

Out of scope:

- Editing `SKILL.md` contents.
- Deleting skills.
- Managing plugin-provided skills under `.codex/plugins`.
- Changing Codex runtime internals or configuration files.
- Authenticating remote users. The server is local-only.

## Architecture

The tool has a small Node.js HTTP server and static browser UI.

- `server.js` exposes JSON endpoints for listing and toggling skills.
- `public/index.html`, `public/styles.css`, and `public/app.js` provide the local web panel.
- The server binds to `127.0.0.1` only and only permits filesystem actions inside `/Users/liyizhu/.codex/skills` and `/Users/liyizhu/.codex/skills.disabled`.
- Tests exercise the filesystem model and HTTP API using temporary directories so real skills are not touched during verification.

## Filesystem Model

Enabled skills live here:

```text
/Users/liyizhu/.codex/skills/<skill-name>/SKILL.md
```

Disabled skills live here:

```text
/Users/liyizhu/.codex/skills.disabled/<skill-name>/SKILL.md
```

Disabling a skill moves the directory from `skills` to `skills.disabled`. Enabling reverses the move. If the destination already exists, the operation fails instead of overwriting anything.

Reserved entries are not toggleable:

- `.system`
- Any entry whose name starts with `.`
- `skill-switchboard`, if it ever exists as a skill

## API

`GET /api/skills`

Returns:

```json
{
  "skills": [
    { "name": "brainstorming", "enabled": true, "reserved": false, "path": "/Users/liyizhu/.codex/skills/brainstorming" }
  ]
}
```

`POST /api/skills/:name/toggle`

Request body:

```json
{ "enabled": false }
```

Behavior:

- `enabled: false` disables an enabled skill.
- `enabled: true` enables a disabled skill.
- Invalid names, missing skills, reserved skills, and destination conflicts return a non-2xx error with a JSON `error` message.

## UI Behavior

The page shows:

- Tool title and short explanation.
- Search input.
- Skill cards or rows sorted by name.
- Status badge: `Enabled`, `Disabled`, or `Reserved`.
- A switch button per non-reserved skill.
- A refresh button.
- Inline success/error messages.

After each toggle, the UI reloads the skill list from the API so it reflects the actual filesystem state.

## Error Handling

The server validates skill names with a strict pattern: letters, numbers, dots, underscores, and hyphens only. Path traversal strings such as `../x` are rejected.

Before moving a skill, the server checks:

- The source directory exists.
- The source contains `SKILL.md`.
- The destination directory does not exist.
- The skill is not reserved.

Errors are returned as JSON and displayed in the UI.

## Testing

Use Node's built-in test runner.

Tests cover:

- Listing enabled and disabled skills from temporary directories.
- Disabling moves an enabled skill to the disabled directory.
- Enabling moves a disabled skill back to the enabled directory.
- Reserved skills cannot be toggled.
- Destination conflicts fail without overwriting data.
- Invalid names are rejected.

## Usage

From `/Users/liyizhu/mycodex/skill-switchboard`:

```bash
npm test
npm start
```

Then open:

```text
http://127.0.0.1:8787
```
