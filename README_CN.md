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
  <strong>Claude Code 的主页。</strong>你的所有会话，一目了然。
</p>

<p align="center">
  <code>git clone</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>npm link</code>&nbsp;&nbsp;→&nbsp;&nbsp;<code>start-claude</code>
</p>

<p align="center">
  <a href="./README.md">🇬🇧 English</a>
</p>

<p align="center">
  <img src="./screenshot.svg" alt="Claude Starter 截图" width="800" />
</p>

---

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

**Claude Starter** 是一个精美的终端可视化工具，让你能像浏览网页一样浏览所有 Claude 历史会话。它是你的 **Claude 主页** —— 每次打开终端，`start-claude` 一敲，所有 session 一目了然。

```bash
start-claude
```

精美的分屏 UI，Tokyo Night 配色。左侧列表一目了然，右侧实时预览对话详情。不是 UUID，是你**真正说过的话**。

## 🔍 搜索 — 杀手级功能

按 `/` 开始输入，**就这么简单**。无需按回车。

跨项目名、Git 分支、对话内容**全文实时搜索**。输入即过滤，`↑↓` 直接导航结果。

- `auth` → 所有认证相关的对话
- `refactor` → 上周的代码重构
- `web-app fix` → 某个项目的 bug 修复

**不需要管理模式，不需要确认。输入即搜，方向键即走。**

## 核心能力

| | 功能 | 说明 |
|---|---|---|
| 🎨 | **精美 TUI** | Tokyo Night 配色，分屏布局，终端里的 App |
| ✨ | **一键新建** | 列表顶部直接新建对话 |
| 🔍 | **即时搜索** | `/` 全文搜索，无需回车 |
| 📂 | **项目过滤** | `p` 按项目筛选 |
| ⚡ | **秒级恢复** | 选中 → Enter → 回到对话 |
| 📋 | **对话预览** | 右侧面板展示完整元数据和对话历史 |
| 🔀 | **多种排序** | 时间 / 大小 / 消息数 / 项目 |
| 📎 | **复制 ID** | `c` 一键复制到剪贴板 |
| 🧠 | **智能 CLI** | 自动检测 `mai-claude` / `claude` |
| 🔒 | **完全本地** | 不联网，不上传，不追踪 |

## 安装

```bash
git clone https://github.com/Bojun-Vvibe/claude-starter.git
cd claude-starter
npm install
npm link
```

然后运行：

```bash
start-claude
```

## 用法

```bash
# 交互式 TUI — 主要体验
start-claude

# 快速列表（无 TUI，可管道）
start-claude --list
start-claude --list 50

# 帮助
start-claude --help
```

## 快捷键

| 按键 | 功能 |
|:---:|------|
| `↑` `↓` | 上下导航 |
| `Enter` | 新建 / 恢复对话 |
| `n` | 直接新建 |
| `/` | 搜索 |
| `Backspace` | 删除搜索字符，删空自动退出 |
| `Esc` | 清空搜索 |
| `p` | 按项目过滤 |
| `s` | 切换排序 |
| `c` | 复制 Session ID |
| `Home` / `End` | 跳到顶 / 底 |
| `Ctrl-D` / `Ctrl-U` | 翻页 |
| `q` / `Ctrl-C` | 退出 |

## 原理

读取 Claude Code 写入 `~/.claude/projects/` 的 JSONL 会话文件，解析元数据（时间、Git 分支、工作目录）和对话内容。

200 个 session 加载耗时 ~10ms。两段式策略：列表用快速头尾读取，详情按需完整解析。

**所有数据留在本地。不联网，不调 API，不追踪。**

## 环境要求

- **Node.js** >= 18
- **Claude Code** ([`claude`](https://docs.anthropic.com/en/docs/claude-code) in PATH)

## License

MIT

---

<p align="center">
  <sub>由 <a href="https://github.com/Bojun-Vvibe">Bojun</a> 用 💜 构建 — 由 Claude Code 驱动</sub>
</p>
