<p align="center">
  <img src="https://img.shields.io/badge/%F0%9F%9A%80-Claude_Starter-7aa2f7?style=for-the-badge&labelColor=1a1b26" alt="Claude Starter" />
  <br/>
  <img src="https://img.shields.io/npm/v/claude-starter?style=flat-square&color=f7768e&logo=npm" alt="npm" />
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
  <code>npm install -g claude-starter</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>claude-starter</code>
</p>

<p align="center">
  <img src="./screenshot.svg" alt="Claude Starter Screenshot" width="800" />
</p>

---

# 🇨🇳 中文

## 痛点

用过 Claude Code 的 `/resume` 吗？它给你的是这样一坨东西：

```
? Select a conversation
  3ee0f33a-b882-424f-9ba4-260342e4dd5b - 4/3/2026, 10:53:41 AM
  87570bab-ee92-4681-9591-54abf2fcb486 - 4/3/2026, 10:18:55 AM
  ...200 个 UUID...
```

一堆 UUID，没有上下文，无法搜索。**想找到上周帮你调过 bug 的那个 session？祝你好运。**

## 解决方案

**Claude Starter** 是一个精美的终端可视化工具，让你能像浏览网页一样浏览所有 Claude 历史会话。它是你的 **Claude 主页** —— 每次打开终端，`claude-starter` 一敲，所有 session 一目了然。

```bash
claude-starter
```

精美的分屏 UI，Tokyo Night 配色。左侧列表一目了然，右侧实时预览对话详情。不是 UUID，是你**真正说过的话**。

## 🔍 搜索 — 杀手级功能

按 `/` 开始输入，**就这么简单**。无需按回车。

跨项目名、Git 分支、对话内容**全文实时搜索**。输入即过滤，`↑↓` 直接导航结果。

- `auth` → 所有认证相关的对话
- `refactor` → 上周的代码重构
- `web-app fix` → 某个项目的 bug 修复
- `#bug-fix` → 所有打了 bug-fix 标签的对话
- `fav` → 所有收藏的对话

**不需要管理模式，不需要确认。输入即搜，方向键即走。**

## ⭐ 收藏 & 🏷️ 标签 — 组织你的对话

按 `f` 收藏/取消收藏，按 `#` 打标签。

- **收藏**：重要的对话一键标星，排序切到 `favorites` 模式收藏置顶
- **标签**：预设 8 种标签（`bug-fix`、`feature`、`refactor` 等），支持自定义
- **搜索联动**：`/` 搜索支持 `#tag` 语法和 `fav` 关键字
- **持久化**：数据存在 `~/.claude/claude-starter-meta.json`，重启不丢失

## 核心能力

| | 功能 | 说明 |
|---|---|---|
| 🎨 | **精美 TUI** | Tokyo Night 配色，分屏布局，终端里的 App |
| ✨ | **一键新建** | 列表顶部直接新建对话 |
| 🔍 | **即时搜索** | `/` 全文搜索，无需回车，支持 `#tag` 和 `fav` |
| ⭐ | **收藏** | `f` 收藏重要对话，排序置顶 |
| 🏷️ | **标签** | `#` 分类管理，预设 + 自定义标签 |
| 📂 | **项目过滤** | `p` 按项目筛选 |
| ⚡ | **秒级恢复** | 选中 → Enter → 回到对话 |
| 📋 | **对话预览** | 右侧面板展示完整元数据和对话历史 |
| 🔀 | **多种排序** | 时间 / 大小 / 消息数 / 项目 / 收藏 |
| 📎 | **复制 ID** | `c` 一键复制到剪贴板 |
| 🧠 | **智能 CLI** | 自动检测 `mai-claude` / `claude` |
| 🔒 | **完全本地** | 不联网，不上传，不追踪 |

## 安装

```bash
npm install -g claude-starter
```

或者从源码安装：

```bash
git clone https://github.com/Bojun-Vvibe/claude-starter.git
cd claude-starter
npm install
npm link
```

然后运行 `claude-starter`，就这么简单。

## 快捷键

| 按键 | 功能 |
|:---:|------|
| `↑` `↓` | 上下导航 |
| `Enter` | 新建 / 恢复对话 |
| `n` | 直接新建 |
| `/` | 搜索（支持 `#tag` 和 `fav`） |
| `f` | 收藏 / 取消收藏 ⭐ |
| `#` | 添加 / 管理标签 🏷️ |
| `Backspace` | 删除搜索字符，删空自动退出 |
| `Esc` | 清空搜索 |
| `p` | 按项目过滤 |
| `s` | 切换排序（时间/大小/消息数/项目/收藏） |
| `c` | 复制 Session ID |
| `Home` / `End` | 跳到顶 / 底 |
| `Ctrl-D` / `Ctrl-U` | 翻页 |
| `q` / `Ctrl-C` | 退出 |

## 原理

读取 `~/.claude/projects/` 下的 JSONL 会话文件，解析元数据和对话内容。200 个 session 加载耗时 ~10ms。**所有数据留在本地，不联网。**

---

# 🇬🇧 English

## The Problem

Claude Code's `/resume` gives you a wall of UUIDs:

```
? Select a conversation
  3ee0f33a-b882-424f-9ba4-260342e4dd5b - 4/3/2026, 10:53:41 AM
  87570bab-ee92-4681-9591-54abf2fcb486 - 4/3/2026, 10:18:55 AM
  ...200 more UUIDs...
```

Good luck finding that session where Claude fixed your auth bug last Tuesday.

## The Solution

```bash
claude-starter
```

Beautiful split-pane UI with Tokyo Night colors. The left panel shows every session with project, time, and topic. The right panel previews the full conversation. Not UUIDs — your **actual words**.

## 🔍 Search — The Killer Feature

Press `/` and start typing. **That's it.** No Enter needed.

Searches across **everything** — project names, Git branches, conversation content. Results update as you type, `↑↓` to navigate instantly.

- `auth` → all auth-related sessions
- `refactor` → that cleanup from last week
- `web-app fix` → bug fixes in a specific project
- `#bug-fix` → all sessions tagged with bug-fix
- `fav` → all favorited sessions

**No modes. No confirmation. Just type and go.**

## ⭐ Favorites & 🏷️ Tags

Press `f` to favorite/unfavorite, `#` to add tags.

- **Favorites**: Star important sessions, sort by favorites to pin them at top
- **Tags**: 8 built-in tags (`bug-fix`, `feature`, `refactor`, etc.) + custom tags
- **Search integration**: Use `#tag` syntax or `fav` keyword in search
- **Persistent**: Stored in `~/.claude/claude-starter-meta.json`, survives restarts

## Features

| | Feature | Description |
|---|---|---|
| 🎨 | **Beautiful TUI** | Tokyo Night color scheme, split-pane layout, feels native in your terminal |
| ✨ | **New Session** | Launch a fresh conversation in one keystroke |
| 🔍 | **Instant Search** | Fuzzy search across everything, supports `#tag` and `fav` |
| ⭐ | **Favorites** | Press `f` to star important sessions |
| 🏷️ | **Tags** | Press `#` to categorize with built-in + custom tags |
| 📂 | **Project Filter** | Press `p` to filter by project |
| ⚡ | **One-Key Resume** | Arrow, Enter, you're back in the conversation |
| 📋 | **Session Preview** | Full metadata + conversation history in the right panel |
| 🔀 | **Sort Modes** | Sort by time, size, messages, project, or favorites |
| 📎 | **Copy ID** | Press `c` to copy session ID |
| 🧠 | **Smart CLI** | Auto-detects `mai-claude` vs `claude` |
| 🔒 | **100% Local** | No network, no telemetry, no data leaves your machine |

## Install

```bash
npm install -g claude-starter
```

Or install from source:

```bash
git clone https://github.com/Bojun-Vvibe/claude-starter.git
cd claude-starter
npm install
npm link
```

Then run:

```bash
claude-starter
```

## Keyboard Shortcuts

| Key | Action |
|:---:|--------|
| `↑` `↓` | Navigate sessions |
| `Enter` | Start new / resume selected session |
| `n` | New session |
| `/` | Search (supports `#tag` and `fav`) |
| `f` | Toggle favorite ⭐ |
| `#` | Add/manage tags 🏷️ |
| `Backspace` | Edit search, auto-exit when empty |
| `Esc` | Clear filter |
| `p` | Filter by project |
| `s` | Cycle sort mode (time/size/messages/project/favorites) |
| `c` | Copy session ID |
| `Home` / `End` | Jump to first / last |
| `Ctrl-D` / `Ctrl-U` | Page down / up |
| `q` / `Ctrl-C` | Quit |

## How It Works

Reads the JSONL session files from `~/.claude/projects/`, parses metadata and conversation content. 200 sessions load in ~10ms. **Everything stays local. No API calls, no telemetry.**

## Requirements

- **Node.js** >= 18
- **Claude Code** ([`claude`](https://docs.anthropic.com/en/docs/claude-code) in PATH)

## License

MIT

---

<p align="center">
  <sub>Built with 💜 by <a href="https://github.com/Bojun-Vvibe">Bojun</a> — powered by Claude Code itself</sub>
</p>
