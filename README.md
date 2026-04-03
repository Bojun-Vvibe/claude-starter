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
  <strong>Claude Code 的主页。</strong>你的所有会话，一目了然。<br/>
  <strong>Your homepage for Claude Code.</strong> All your sessions, at a glance.
</p>

<p align="center">
  <code>git clone</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>npm link</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>start-claude</code>
</p>

<p align="center">
  <img src="./screenshot.svg" alt="Claude Starter Screenshot" width="800" />
</p>

---

## 痛点 / The Problem

Claude Code 的 `/resume` 给你的是一堆 UUID：

Claude Code's `/resume` gives you a wall of UUIDs:

```
? Select a conversation
  3ee0f33a-b882-424f-9ba4-260342e4dd5b - 4/3/2026, 10:53:41 AM
  87570bab-ee92-4681-9591-54abf2fcb486 - 4/3/2026, 10:18:55 AM
  716f7cd7-27fd-41dd-94eb-a169b6058f8a - 4/3/2026, 10:50:10 AM
  ...200 more UUIDs...
```

想找到上周帮你调 bug 的那个 session？祝你好运。

Good luck finding that session where Claude fixed your auth bug last Tuesday.

## 解决方案 / The Solution

```bash
start-claude
```

精美的分屏 UI，Tokyo Night 配色。左侧列表一目了然，右侧实时预览对话详情。不是 UUID，是你**真正说过的话**。

Beautiful split-pane UI with Tokyo Night colors. The left panel shows every session with project, time, and topic. The right panel previews the full conversation. Not UUIDs — your **actual words**.

## 🔍 搜索 — 杀手级功能 / Search — The Killer Feature

按 `/` 开始输入，**就这么简单**。无需按回车。

Press `/` and start typing. **That's it.** No Enter needed.

跨项目名、Git 分支、对话内容**全文实时搜索**。输入即过滤，`↑↓` 直接导航结果。

Searches across **everything** — project names, Git branches, conversation content. Results update as you type, `↑↓` to navigate instantly.

- `auth` → 所有认证相关的对话 / all auth-related sessions
- `refactor` → 上周的代码重构 / that cleanup from last week
- `web-app fix` → 某个项目的 bug 修复 / bug fixes in a specific project

**不需要管理模式，不需要确认。输入即搜，方向键即走。**

**No modes. No confirmation. Just type and go.**

## 功能一览 / Features

| | 功能 Feature | 说明 Description |
|---|---|---|
| 🎨 | **精美 TUI** Beautiful TUI | Tokyo Night 配色，分屏布局，终端里的 App / Split-pane layout that feels native |
| ✨ | **一键新建** New Session | 列表顶部直接新建对话 / Launch a fresh conversation in one keystroke |
| 🔍 | **即时搜索** Instant Search | `/` 全文搜索，无需回车 / Fuzzy search across everything, no Enter needed |
| 📂 | **项目过滤** Project Filter | `p` 按项目筛选 / Press `p` to filter by project |
| ⚡ | **秒级恢复** One-Key Resume | 选中 → Enter → 回到对话 / Arrow, Enter, you're back |
| 📋 | **对话预览** Session Preview | 右侧面板展示完整元数据和对话历史 / Full metadata + conversation history |
| 🔀 | **多种排序** Sort Modes | 时间 / 大小 / 消息数 / 项目 / time / size / messages / project |
| 📎 | **复制 ID** Copy ID | `c` 一键复制到剪贴板 / Press `c` to copy session ID |
| 🧠 | **智能 CLI** Smart CLI | 自动检测 `mai-claude` / `claude` / Auto-detects your CLI |
| 🔒 | **完全本地** 100% Local | 不联网，不上传，不追踪 / No network, no telemetry |

## 安装 / Install

```bash
git clone https://github.com/Bojun-Vvibe/claude-starter.git
cd claude-starter
npm install
npm link
```

然后运行 / Then run:

```bash
start-claude
```

## 用法 / Usage

```bash
# 交互式 TUI — 主要体验 / Interactive TUI — the main experience
start-claude

# 快速列表（无 TUI，可管道）/ Quick table view (pipe-friendly)
start-claude --list
start-claude --list 50

# 帮助 / Help
start-claude --help
```

## 快捷键 / Keyboard Shortcuts

| 按键 Key | 功能 Action |
|:---:|--------|
| `↑` `↓` | 上下导航 / Navigate |
| `Enter` | 新建 / 恢复对话 / Start new or resume |
| `n` | 直接新建 / New session |
| `/` | 搜索 / Search |
| `Backspace` | 删除搜索字符，删空自动退出 / Edit search, auto-exit when empty |
| `Esc` | 清空搜索 / Clear filter |
| `p` | 按项目过滤 / Filter by project |
| `s` | 切换排序 / Cycle sort mode |
| `c` | 复制 Session ID / Copy session ID |
| `Home` / `End` | 跳到顶 / 底 / Jump to first / last |
| `Ctrl-D` / `Ctrl-U` | 翻页 / Page down / up |
| `q` / `Ctrl-C` | 退出 / Quit |

## 原理 / How It Works

读取 Claude Code 写入 `~/.claude/projects/` 的 JSONL 会话文件，解析元数据（时间、Git 分支、工作目录）和对话内容。

Reads the JSONL session files from `~/.claude/projects/`, parses metadata (timestamps, git branch, working directory) and conversation content.

200 个 session 加载耗时 ~10ms。两段式策略：列表用快速头尾读取，详情按需完整解析。

200 sessions load in ~10ms. Two-pass strategy: quick head/tail reads for the list, full parse only for the selected session.

**所有数据留在本地。不联网，不调 API，不追踪。**

**Everything stays local. No API calls, no telemetry, no network.**

## 环境要求 / Requirements

- **Node.js** >= 18
- **Claude Code** ([`claude`](https://docs.anthropic.com/en/docs/claude-code) in PATH)

## License

MIT

---

<p align="center">
  <sub>Built with 💜 by <a href="https://github.com/Bojun-Vvibe">Bojun</a> — powered by Claude Code itself</sub>
</p>
