# 🚀 Claude Starter

A beautiful terminal UI for managing Claude Code sessions — start new ones or resume past conversations with ease.

![Claude Starter](https://img.shields.io/badge/Claude-Starter-blue?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyTDEgMTJoM3Y5aDZ2LTZoNHY2aDZWMTJoM0wxMiAyeiIvPjwvc3ZnPg==)

## Why?

Claude Code's built-in `/resume` command dumps a plain text list of session IDs — hard to scan, no context, no search. **Claude Starter** gives you:

- **Visual session browser** — project name, time, message count, and conversation topic at a glance
- **Instant search** — type `/` and filter by project, branch, topic, or any keyword
- **One-key resume** — hit Enter to jump back into any past session
- **New session launcher** — start a fresh Claude session without leaving the TUI
- **Project filter** — press `p` to filter sessions by project
- **Smart CLI detection** — automatically uses `mai-claude` if available, falls back to `claude`

## Install

### npm (recommended)

```bash
npm install -g claude-starter
```

### From source

```bash
git clone https://github.com/Bojun-Vvibe/claude-starter.git
cd claude-starter
npm install
npm link
```

## Usage

```bash
# Launch the interactive TUI
start-claude

# Quick list of recent sessions (no TUI)
start-claude --list
start-claude --list 50
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate sessions |
| `Enter` | Start new / resume selected session |
| `n` | Start new session |
| `/` | Search (fuzzy filter across projects, topics, branches) |
| `Backspace` | Delete search characters (auto-exits when empty) |
| `Esc` | Clear filter |
| `p` | Filter by project |
| `s` | Cycle sort mode (time / size / messages / project) |
| `c` | Copy session ID to clipboard |
| `Home` / `End` | Jump to top / bottom |
| `Ctrl-D` / `Ctrl-U` | Page down / up |
| `q` / `Ctrl-C` | Quit |

## How it works

Claude Starter reads session data from `~/.claude/projects/` — the same JSONL files that Claude Code writes. It parses metadata (timestamps, git branch, working directory) and the first few user messages to show a meaningful topic for each session.

No data is sent anywhere. Everything runs locally.

## Requirements

- **Node.js** >= 18
- **Claude Code** installed (`claude` or `mai-claude` in your PATH)

## License

MIT
