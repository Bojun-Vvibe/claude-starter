<p align="center">
  <img src="https://img.shields.io/badge/%F0%9F%9A%80-Claude_Starter-7aa2f7?style=for-the-badge&labelColor=1a1b26" alt="Claude Starter" />
  <br/>
  <img src="https://img.shields.io/badge/node-%3E%3D18-9ece6a?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/license-MIT-bb9af7?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/github/v/release/Bojun-Vvibe/claude-starter?style=flat-square&color=7dcfff" alt="Release" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-e0af68?style=flat-square" alt="Platform" />
</p>

<h1 align="center">🚀 Claude Starter</h1>

<p align="center">
  <strong>Your homepage for Claude Code.</strong><br/>
  A gorgeous terminal UI that turns your cluttered session history<br/>
  into a clean, searchable, one-click launchpad.
</p>

<p align="center">
  <code>npm install -g claude-starter</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>start-claude</code>
</p>

---

## The Problem

Claude Code's `/resume` gives you this:

```
? Select a conversation
  3ee0f33a-b882-424f-9ba4-260342e4dd5b - 4/3/2026, 10:53:41 AM
  87570bab-ee92-4681-9591-54abf2fcb486 - 4/3/2026, 10:18:55 AM
  716f7cd7-27fd-41dd-94eb-a169b6058f8a - 4/3/2026, 10:50:10 AM
  ...200 more UUIDs...
```

Good luck finding anything.

## The Solution

```bash
start-claude
```

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🚀 Claude Starter │ 189/189 sessions │ 8 projects │ ↕time                  │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ ✨ New Session                      │                                       │
│ app-ios        Today 10:52  384m .. │ █ app-ios                             │
│ app-ios        Today 10:51  200m .. │ ─────────────────────────────────     │
│ app-android    Today 10:01   72m .. │                                       │
│ MSProject      Yesterday     89m .. │ Session  87570bab-ee92...             │
│ app-ios        2d ago        31m .. │ Started  4/3/2026, 10:18 AM          │
│ ▸ Azure-Pipe.. 3d ago       165m .. │ Duration 41m                          │
│                                      │ Branch   main                        │
│                                      │ Tools    [Bash] [Read] [Edit]        │
│                                      │                                       │
│                                      │ 💬 Conversation                      │
│                                      │ You ❯ 分析一下这个pipeline...         │
│                                      │ Claude ❯ Let me look at...           │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ ↵ Start/Resume │ n New │ / Search │ ↑/↓ Nav │ p Project │ s Sort │ q Quit  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Every session, at a glance.** Project-colored labels, relative timestamps, message counts, and the actual conversation topic — not a UUID.

## Features

| | Feature | Description |
|---|---|---|
| 🎨 | **Beautiful TUI** | Tokyo Night color scheme, split-pane layout, feels native in your terminal |
| ✨ | **New Session** | Launch a fresh Claude session in one keystroke |
| 🔍 | **Instant Search** | Type `/` and fuzzy-filter across projects, branches, topics, messages |
| 📂 | **Project Grouping** | Press `p` to filter by project — see only what matters |
| ⚡ | **One-Key Resume** | Arrow to a session, hit Enter, you're back in the conversation |
| 📋 | **Session Preview** | Right panel shows full metadata, tools used, and conversation history |
| 🔀 | **Sort Modes** | Sort by time, size, message count, or project name |
| 📎 | **Copy Session ID** | Press `c` to copy — paste it anywhere |
| 🧠 | **Smart CLI** | Auto-detects `mai-claude` vs `claude` — just works |
| 🔒 | **100% Local** | Reads `~/.claude/` directly. No network. No telemetry. |

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

Then just run:

```bash
start-claude
```

## Usage

```bash
# Interactive TUI — the main experience
start-claude

# Quick table view (no TUI, pipe-friendly)
start-claude --list
start-claude --list 50

# Help
start-claude --help
```

## Keyboard Shortcuts

| Key | Action |
|:---:|--------|
| `↑` `↓` | Navigate sessions |
| `Enter` | Start new / resume selected session |
| `n` | Start new session immediately |
| `/` | Search — type to filter, `↑/↓` to exit search and navigate |
| `Backspace` | Delete search chars (auto-exits when empty) |
| `Esc` | Clear filter, reset view |
| `p` | Filter by project (popup picker) |
| `s` | Cycle sort: time → size → messages → project |
| `c` | Copy session ID to clipboard |
| `Home` / `End` | Jump to first / last |
| `Ctrl-D` / `Ctrl-U` | Page down / up |
| `q` / `Ctrl-C` | Quit |

## How It Works

Claude Starter reads the JSONL session files that Claude Code writes to `~/.claude/projects/`. For each session it extracts:

- **Metadata** — timestamps, git branch, working directory, Claude version
- **User messages** — your actual prompts, used as the session topic
- **Assistant responses** — previewed in the detail panel
- **Tools used** — Bash, Read, Edit, etc.

Loading is fast (~10ms for 200 sessions) thanks to a two-pass strategy: quick head/tail reads for the list, full parse only for the selected session's detail view.

**Nothing leaves your machine.** No API calls, no telemetry, no network access.

## Requirements

- **Node.js** >= 18
- **Claude Code** installed ([`claude`](https://docs.anthropic.com/en/docs/claude-code) in your PATH)

## License

MIT

---

<p align="center">
  <sub>Built with 💜 by <a href="https://github.com/Bojun-Vvibe">Bojun</a> — powered by Claude Code itself</sub>
</p>
