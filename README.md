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
  <code>git clone</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>npm link</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>start-claude</code>
</p>

<p align="center">
  <a href="#-中文说明">中文</a> · <a href="#the-problem">English</a>
</p>

---

## 🇨🇳 中文说明

### 痛点

用过 Claude Code 的 `/resume` 吗？它给你的是这样一坨东西：

```
? Select a conversation
  3ee0f33a-b882-424f-9ba4-260342e4dd5b - 4/3/2026, 10:53:41 AM
  87570bab-ee92-4681-9591-54abf2fcb486 - 4/3/2026, 10:18:55 AM
  ...200 个 UUID...
```

一堆 UUID，没有上下文，无法搜索。**想找到上周帮你调过 bug 的那个 session？祝你好运。**

### Claude Starter 是什么

**Claude Starter** 是一个精美的终端可视化工具，让你能像浏览网页一样浏览所有 Claude 历史会话。它是你的 **Claude 主页** —— 每次打开终端，`start-claude` 一敲，所有 session 一目了然。

### 核心能力

🎨 **精美的分屏 UI** — Tokyo Night 配色，左侧列表 + 右侧详情预览，像一个真正的 App

✨ **一键启动** — 列表第一项就是「新建 Session」，Enter 直接开始

🔍 **强大的搜索** — 按 `/` 即搜，**实时过滤**，跨项目名、Git 分支、对话内容、话题全文搜索。输完直接 `↑↓` 导航结果，无需确认。搜「merge queue」？0.1 秒找到那个帮你修 CI 的 session。搜「bazel」？所有构建相关的对话立刻浮出。

📂 **项目过滤** — 按 `p` 弹出项目选择器，只看某个项目的 session

⚡ **秒级加载** — 200 个 session 在 10ms 内加载完毕

🔒 **完全本地** — 读取 `~/.claude/` 目录，不联网，不上传，不追踪

### 安装

```bash
git clone https://github.com/Bojun-Vvibe/claude-starter.git
cd claude-starter
npm install
npm link
```

然后运行 `start-claude`，就这么简单。

### 快捷键

| 按键 | 功能 |
|:---:|------|
| `↑` `↓` | 上下导航 |
| `Enter` | 启动新 / 恢复选中的 session |
| `n` | 直接启动新 session |
| `/` | 搜索 — 输入即过滤，`↑↓` 退出搜索直接导航 |
| `Backspace` | 逐字删除搜索词，删空自动退出搜索 |
| `Esc` | 清空搜索，重置视图 |
| `p` | 按项目过滤 |
| `s` | 切换排序：时间 / 大小 / 消息数 / 项目 |
| `c` | 复制 Session ID 到剪贴板 |
| `q` | 退出 |

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
│ 🚀 Claude Starter │ 142/142 sessions │ 5 projects │ ↕time                  │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ ✨ New Conversation                 │                                       │
│ web-app        Today 10:52  384m .. │ █ my-saas-api                         │
│ web-app        Today 10:51  200m .. │ ─────────────────────────────────     │
│ my-saas-api    Today 10:01   72m .. │                                       │
│ dotfiles       Yesterday     89m .. │ Session  87570bab-ee92...             │
│ web-app        2d ago        31m .. │ Started  4/3/2026, 10:18 AM          │
│ ▸ my-saas-api  3d ago       165m .. │ Duration 41m                          │
│                                      │ Branch   feat/auth-refactor          │
│                                      │ Tools    [Bash] [Read] [Edit]        │
│                                      │                                       │
│                                      │ 💬 Conversation                      │
│                                      │ You ❯ 帮我实现一个 LRU Cache         │
│                                      │ Claude ❯ I'll implement an           │
│                                      │   LRU cache with O(1) get/put...     │
├──────────────────────────────────────┴───────────────────────────────────────┤
│ ↵ Start/Resume │ n New │ / Search │ ↑/↓ Nav │ p Project │ s Sort │ q Quit  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Every session, at a glance.** Project-colored labels, relative timestamps, message counts, and the actual conversation topic — not a UUID.

## 🔍 Search — The Killer Feature

Press `/` and start typing. **That's it.** No Enter needed.

The search is instant and searches across **everything** — project names, Git branches, conversation content, topics. Results update as you type.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🚀 Claude Starter │ 3/142 sessions │ / auth refactor▌                      │
├──────────────────────────────────────┬───────────────────────────────────────┤
│ my-saas-api    2d ago   31m  重构.. │ ...                                   │
│ my-saas-api    3d ago   54m  JWT .. │                                       │
│ ▸ web-app      5d ago  117m  登录.. │                                       │
```

- Type `auth` → find every authentication-related session
- Type `refactor` → find that code cleanup from last week
- Type `web-app` → all sessions in your web project
- Type `web-app fix` → narrow down to bug fixes in the web app

When you're done, just press `↑` or `↓` to exit search and navigate the results. Press `Backspace` to edit — when the search is empty, you're back to the full list. Press `Esc` to clear everything.

**No modes to manage. No Enter to confirm. Just type and go.**

## Features

| | Feature | Description |
|---|---|---|
| 🎨 | **Beautiful TUI** | Tokyo Night color scheme, split-pane layout, feels native in your terminal |
| ✨ | **New Session** | Launch a fresh Claude session in one keystroke |
| 🔍 | **Instant Search** | Type `/` and fuzzy-filter across projects, branches, topics, messages — no Enter needed |
| 📂 | **Project Grouping** | Press `p` to filter by project — see only what matters |
| ⚡ | **One-Key Resume** | Arrow to a session, hit Enter, you're back in the conversation |
| 📋 | **Session Preview** | Right panel shows full metadata, tools used, and conversation history |
| 🔀 | **Sort Modes** | Sort by time, size, message count, or project name |
| 📎 | **Copy Session ID** | Press `c` to copy — paste it anywhere |
| 🧠 | **Smart CLI** | Auto-detects `mai-claude` vs `claude` — just works |
| 🔒 | **100% Local** | Reads `~/.claude/` directly. No network. No telemetry. |

## Install

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
| `/` | Search — type to filter, `↑/↓` to exit and navigate results |
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
