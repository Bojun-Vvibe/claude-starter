#!/usr/bin/env node

/**
 * Claude Starter (claude-starter)
 * ──────────────────────────────
 * A beautiful TUI for starting new and resuming past Claude Code sessions.
 *
 * Usage:
 *   claude-starter            # Launch interactive TUI
 *   claude-starter --list     # Print sessions as a table (no TUI)
 *   claude-starter --list N   # Print the latest N sessions
 *
 * Keyboard shortcuts (TUI mode):
 *   ↑/↓           Navigate sessions
 *   Enter          Start new / resume selected session
 *   /              Start search (fuzzy filter)
 *   Esc            Clear search / cancel
 *   p              Filter by project (popup)
 *   s              Cycle sort: time → size → messages → project → favorites
 *   n              Start new session
 *   f              Toggle favorite on selected session
 *   #              Add/remove tags on selected session
 *   Home / End     Jump to top / bottom
 *   Ctrl-D/U       Page down / up
 *   c              Copy session ID to clipboard
 *   q / Ctrl-C     Quit
 */

const blessed = require('blessed');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const os = require('os');

// ─── CLI Detection ──────────────────────────────────────────────────────────
// Detect whether `mai-claude` is available (binary, alias, or function).
// We check inside an interactive shell so aliases defined in .bashrc/.zshrc
// are visible.  Falls back to plain `claude`.
//
// Returns { name, cmd } where:
//   name = display label ("mai-claude" or "claude")
//   cmd  = the actual command string to spawn (resolves aliases)

function detectCLI() {
  const shell = process.env.SHELL || '/bin/sh';
  try {
    const raw = execSync(`${shell} -ic "command -v mai-claude" 2>/dev/null`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 3000,
    }).toString().trim();

    // Interactive shells may print extra lines (e.g. "Restored session: …").
    // The relevant output is the last line(s) containing the alias or path.
    const lines = raw.split('\n');
    const aliasLine = lines.find(l => l.startsWith('alias ')) || lines[lines.length - 1];

    // `command -v` for an alias returns: alias mai-claude='actual command'
    // Extract the real command from inside the quotes if it's an alias.
    const aliasMatch = aliasLine.match(/^alias [^=]+=(?:'(.+)'|"(.+)")$/s);
    if (aliasMatch) {
      return { name: 'mai-claude', cmd: aliasMatch[1] || aliasMatch[2] };
    }
    // Otherwise it's a binary/function path — use the name directly
    return { name: 'mai-claude', cmd: 'mai-claude' };
  } catch {
    return { name: 'claude', cmd: 'claude' };
  }
}

const CLI = detectCLI();

// ─── Color Palette (Tokyo Night) ─────────────────────────────────────────────
const PROJECT_COLORS = [
  '#7aa2f7', '#bb9af7', '#7dcfff', '#9ece6a',
  '#e0af68', '#f7768e', '#73daca', '#ff9e64',
];

// ─── Paths ───────────────────────────────────────────────────────────────────
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const META_FILE = path.join(CLAUDE_DIR, 'claude-starter-meta.json');

// ─── Session Meta (favorites & tags) ────────────────────────────────────────
// Stores user-defined metadata for sessions in a simple JSON file.
// Schema: { "sessions": { "<sessionId>": { "favorite": bool, "tags": string[] } } }

const DEFAULT_TAGS = ['bug-fix', 'feature', 'refactor', 'debug', 'review', 'config', 'docs', 'experiment'];

function loadMeta() {
  try {
    if (fs.existsSync(META_FILE)) {
      return JSON.parse(fs.readFileSync(META_FILE, 'utf-8'));
    }
  } catch (e) { /* corrupt file, start fresh */ }
  return { sessions: {} };
}

function saveMeta(meta) {
  try {
    fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) { /* silently fail */ }
}

function getSessionMeta(meta, sessionId) {
  return meta.sessions[sessionId] || { favorite: false, tags: [] };
}

function toggleFavorite(meta, sessionId) {
  if (!meta.sessions[sessionId]) meta.sessions[sessionId] = { favorite: false, tags: [] };
  meta.sessions[sessionId].favorite = !meta.sessions[sessionId].favorite;
  saveMeta(meta);
  return meta.sessions[sessionId].favorite;
}

function setSessionTags(meta, sessionId, tags) {
  if (!meta.sessions[sessionId]) meta.sessions[sessionId] = { favorite: false, tags: [] };
  meta.sessions[sessionId].tags = tags;
  saveMeta(meta);
}

function getAllUsedTags(meta) {
  const tags = new Set();
  for (const s of Object.values(meta.sessions)) {
    if (s.tags) s.tags.forEach(t => tags.add(t));
  }
  return [...tags];
}

// ─── Data Layer ──────────────────────────────────────────────────────────────

function getProjectDisplayName(dirName) {
  return dirName
    .replace(/-Users-[^-]+-Desktop-MSProject-/, '')
    .replace(/-Users-[^-]+-Desktop-/, '')
    .replace(/-Users-[^-]+/, '~')
    .replace(/^-/, '') || '~';
}

function loadSessionQuick(filePath, projectName) {
  const sessionId = path.basename(filePath, '.jsonl');
  const stat = fs.statSync(filePath);

  const fd = fs.openSync(filePath, 'r');
  const headBuf = Buffer.alloc(Math.min(8192, stat.size));
  fs.readSync(fd, headBuf, 0, headBuf.length, 0);

  let tailBuf = Buffer.alloc(0);
  if (stat.size > 8192) {
    const tailSize = Math.min(4096, stat.size - 8192);
    tailBuf = Buffer.alloc(tailSize);
    fs.readSync(fd, tailBuf, 0, tailSize, stat.size - tailSize);
  }
  fs.closeSync(fd);

  const headStr = headBuf.toString('utf-8');
  const tailStr = tailBuf.toString('utf-8');

  let firstTs = null, lastTs = null;
  let version = '', gitBranch = '', cwd = '';
  let firstUserMsg = '';
  let userMsgCount = 0;
  let customTitle = '';

  const headLines = headStr.split('\n').filter(Boolean);
  for (const line of headLines) {
    try {
      const d = JSON.parse(line);
      const ts = d.timestamp;
      if (ts && !firstTs) firstTs = ts;
      if (ts) lastTs = ts;
      if (!version && d.version) version = d.version;
      if (!gitBranch && d.gitBranch) gitBranch = d.gitBranch;
      if (!cwd && d.cwd) cwd = d.cwd;
      if (d.type === 'custom-title' && d.customTitle) customTitle = d.customTitle;
      if (d.type === 'user') {
        userMsgCount++;
        if (!firstUserMsg) firstUserMsg = extractUserText(d);
      }
    } catch (e) { /* partial line */ }
  }

  if (tailStr) {
    const tailLines = tailStr.split('\n').filter(Boolean);
    for (const line of tailLines) {
      try {
        const d = JSON.parse(line);
        if (d.timestamp) lastTs = d.timestamp;
        if (d.type === 'user') userMsgCount++;
        if (d.type === 'custom-title' && d.customTitle) customTitle = d.customTitle;
      } catch (e) { /* partial line */ }
    }
  }

  const estimatedMessages = Math.max(userMsgCount, Math.ceil(stat.size / 500 * 0.3));

  let durationStr = '';
  if (firstTs && lastTs) {
    const diffMs = new Date(lastTs).getTime() - new Date(firstTs).getTime();
    if (diffMs > 0) {
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
  }

  let topic = firstUserMsg.replace(/\n/g, ' ').trim();
  if (topic.length > 120) topic = topic.substring(0, 120) + '…';

  return {
    sessionId, project: projectName,
    topic: topic || '(no user messages)',
    customTitle,
    firstTs, lastTs, version, gitBranch, cwd,
    fileSize: stat.size, duration: durationStr,
    estimatedMessages, filePath, _detailLoaded: false,
  };
}

function extractUserText(d) {
  const msg = d.message;
  if (!msg || typeof msg !== 'object') return '';
  const content = msg.content;
  let text = '';
  if (Array.isArray(content)) {
    for (const c of content) {
      if (c && c.type === 'text') { text = c.text || ''; break; }
    }
  } else if (typeof content === 'string') {
    text = content;
  }
  if (text.startsWith('<local-command') || text.startsWith('<command-')) return '';
  return text;
}

function loadSessionDetail(session) {
  if (session._detailLoaded) return session;
  const lines = fs.readFileSync(session.filePath, 'utf-8').split('\n').filter(Boolean);

  let userMessages = [], assistantSnippets = [], totalMessages = 0;
  let toolsUsed = new Set();

  for (const line of lines) {
    try {
      const d = JSON.parse(line);
      if (d.type === 'custom-title' && d.customTitle) session.customTitle = d.customTitle;
      if (d.type === 'user') {
        totalMessages++;
        const text = extractUserText(d);
        if (text) userMessages.push(text.substring(0, 300));
      }
      if (d.type === 'assistant') {
        totalMessages++;
        const msg = d.message;
        if (msg && typeof msg === 'object' && Array.isArray(msg.content)) {
          for (const c of msg.content) {
            if (c && c.type === 'text' && c.text) {
              assistantSnippets.push(c.text.substring(0, 400));
              break;
            }
            if (c && c.type === 'tool_use') toolsUsed.add(c.name || 'unknown');
          }
        }
      }
      if (d.type === 'tool_use') toolsUsed.add(d.name || 'unknown');
    } catch (e) { /* skip */ }
  }

  session.userMessages = userMessages;
  session.assistantSnippets = assistantSnippets;
  session.totalMessages = totalMessages;
  session.estimatedMessages = totalMessages;
  session.toolsUsed = Array.from(toolsUsed);
  session._detailLoaded = true;

  if (userMessages.length > 0) {
    let topic = userMessages[0].replace(/\n/g, ' ').trim();
    if (topic.length > 120) topic = topic.substring(0, 120) + '…';
    session.topic = topic;
  }
  return session;
}

function loadAllSessions() {
  const sessions = [];
  if (!fs.existsSync(PROJECTS_DIR)) return sessions;

  const projDirs = fs.readdirSync(PROJECTS_DIR).filter(d => {
    try { return fs.statSync(path.join(PROJECTS_DIR, d)).isDirectory() && d !== '.'; }
    catch { return false; }
  });

  for (const projDir of projDirs) {
    const projectName = getProjectDisplayName(projDir);
    const projPath = path.join(PROJECTS_DIR, projDir);
    const files = fs.readdirSync(projPath).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      try {
        const session = loadSessionQuick(path.join(projPath, file), projectName);
        // Skip sessions without timestamps, without real user messages, or warmup sessions
        if (session.firstTs
            && session.topic !== '(no user messages)'
            && !/^warmup$/i.test(session.topic.trim())
        ) sessions.push(session);
      } catch (e) { /* skip */ }
    }
  }

  sessions.sort((a, b) => {
    const ta = a.lastTs ? new Date(a.lastTs).getTime() : 0;
    const tb = b.lastTs ? new Date(b.lastTs).getTime() : 0;
    return tb - ta;
  });
  return sessions;
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatTimestamp(ts) {
  if (!ts) return 'unknown';
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) return `${diffDays}d ago ${time}`;
  if (diffDays < 365) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / 1048576).toFixed(1)}M`;
}

function getProjectColor(projectName, colorMap) {
  if (!colorMap.has(projectName)) {
    colorMap.set(projectName, PROJECT_COLORS[colorMap.size % PROJECT_COLORS.length]);
  }
  return colorMap.get(projectName);
}

function esc(text) {
  return text.replace(/\{/g, '\\{');
}

// ─── CLI Mode (--list) ───────────────────────────────────────────────────────

function runListMode(limit) {
  const sessions = loadAllSessions();
  const display = sessions.slice(0, limit || 30);
  const C = {
    reset: '\x1b[0m', dim: '\x1b[2m', bold: '\x1b[1m',
    cyan: '\x1b[36m', yellow: '\x1b[33m', green: '\x1b[32m',
    magenta: '\x1b[35m', blue: '\x1b[34m', white: '\x1b[37m',
  };
  console.log(`\n${C.cyan}${C.bold}🚀 Claude Sessions${C.reset} ${C.dim}(${sessions.length} total, showing ${display.length})${C.reset}\n`);
  console.log(`${C.dim}${'─'.repeat(100)}${C.reset}`);
  console.log(`${C.bold}${'#'.padStart(3)}  ${'Time'.padEnd(18)} ${'Project'.padEnd(18)} ${'Branch'.padEnd(22)} ${'Msgs'.padStart(5)}  ${'Size'.padStart(6)}  Topic${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(100)}${C.reset}`);
  display.forEach((s, i) => {
    console.log(`${C.dim}${`${i+1}`.padStart(3)}${C.reset}  ${C.yellow}${formatTimestamp(s.lastTs).padEnd(18)}${C.reset} ${C.magenta}${s.project.substring(0,17).padEnd(18)}${C.reset} ${C.green}${(s.gitBranch||'').substring(0,21).padEnd(22)}${C.reset} ${C.blue}${`${s.estimatedMessages}`.padStart(5)}${C.reset}  ${C.dim}${formatFileSize(s.fileSize).padStart(6)}${C.reset}  ${C.white}${s.topic.substring(0,40)}${C.reset}`);
  });
  console.log(`${C.dim}${'─'.repeat(100)}${C.reset}`);
  console.log(`\n${C.dim}Resume: ${C.cyan}${CLI.name} --resume <session-id>${C.reset}\n`);
}

// ─── TUI Application ────────────────────────────────────────────────────────

function createApp() {
  const allSessions = loadAllSessions();
  const meta = loadMeta();
  let filteredSessions = [...allSessions];
  let selectedIndex = -1;  // -1 = "New Session", 0+ = session index
  let filterText = '';
  let isSearchMode = false;
  let sortMode = 'time';

  const projectColorMap = new Map();
  const uniqueProjects = [...new Set(allSessions.map(s => s.project))];
  uniqueProjects.forEach(p => getProjectColor(p, projectColorMap));

  // ─── Screen ────────────────────────────────────────────────────────────
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Claude Starter',
    fullUnicode: true,
    autoPadding: true,
  });

  // ─── Header ────────────────────────────────────────────────────────────
  const header = blessed.box({
    parent: screen, top: 0, left: 0, width: '100%', height: 3,
    tags: true, style: { fg: 'white', bg: '#1a1b26' },
  });

  function updateHeader() {
    const title = '{bold}{#7aa2f7-fg}🚀 Claude Starter{/}';
    const count = `{#9ece6a-fg}${filteredSessions.length}{/}{#565f89-fg}/${allSessions.length} sessions{/}`;
    const proj = `{#bb9af7-fg}${uniqueProjects.length}{/}{#565f89-fg} projects{/}`;
    const favCount = allSessions.filter(s => getSessionMeta(meta, s.sessionId).favorite).length;
    const fav = favCount > 0 ? `{#e0af68-fg}⭐${favCount}{/}` : '';
    const sort = `{#73daca-fg}↕${sortMode}{/}`;
    const search = isSearchMode
      ? `{#e0af68-fg}/ ${filterText}▌{/}`
      : (filterText ? `{#e0af68-fg}/ ${filterText}{/}` : '');
    let parts = [title, count, proj];
    if (fav) parts.push(fav);
    parts.push(sort);
    if (search) parts.push(search);
    header.setContent(`\n ${parts.join(' {#414868-fg}│{/} ')}`);
  }

  blessed.line({ parent: screen, top: 3, left: 0, width: '100%', orientation: 'horizontal', style: { fg: '#414868' } });

  // ─── Left Panel: blessed.list for correct scroll tracking ──────────────
  const listPanel = blessed.list({
    parent: screen,
    top: 4, left: 0, width: '50%', height: '100%-7',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    scrollbar: { ch: '▐', style: { fg: '#565f89' } },
    style: {
      bg: '#1a1b26',
      fg: '#a9b1d6',
      selected: { bg: '#3d59a1', fg: 'white', bold: true },
    },
    keys: false,
    vi: false,
    mouse: true,
    interactive: true,
  });

  blessed.line({ parent: screen, top: 4, left: '50%', height: '100%-7', orientation: 'vertical', style: { fg: '#414868' } });

  // ─── Right Panel ───────────────────────────────────────────────────────
  const detailPanel = blessed.box({
    parent: screen,
    top: 4, left: '50%+1', width: '50%-1', height: '100%-7',
    tags: true, scrollable: true, alwaysScroll: true,
    scrollbar: { ch: '▐', style: { fg: '#565f89' } },
    style: { bg: '#1a1b26' },
    mouse: true,
  });

  blessed.line({ parent: screen, bottom: 2, left: 0, width: '100%', orientation: 'horizontal', style: { fg: '#414868' } });

  // ─── Footer ────────────────────────────────────────────────────────────
  const footer = blessed.box({
    parent: screen, bottom: 0, left: 0, width: '100%', height: 2,
    tags: true, style: { fg: '#a9b1d6', bg: '#1a1b26' },
  });

  function updateFooter() {
    const keys = [
      '{#7aa2f7-fg}{bold}↵{/} {#565f89-fg}Start/Resume{/}',
      '{#7aa2f7-fg}{bold}n{/} {#565f89-fg}New{/}',
      '{#7aa2f7-fg}{bold}/{/} {#565f89-fg}Search{/}',
      '{#7aa2f7-fg}{bold}f{/} {#565f89-fg}Fav{/}',
      '{#7aa2f7-fg}{bold}#{/} {#565f89-fg}Tag{/}',
      '{#7aa2f7-fg}{bold}p{/} {#565f89-fg}Project{/}',
      '{#7aa2f7-fg}{bold}s{/} {#565f89-fg}Sort{/}',
      '{#7aa2f7-fg}{bold}c{/} {#565f89-fg}Copy ID{/}',
      '{#7aa2f7-fg}{bold}q{/} {#565f89-fg}Quit{/}',
    ];
    footer.setContent(`\n ${keys.join(' {#414868-fg}│{/} ')}`);
  }

  // ─── Build list items from sessions ────────────────────────────────────
  function buildListItems() {
    const listW = Math.floor((screen.width || 100) / 2) - 2;

    return filteredSessions.map((session) => {
      const color = getProjectColor(session.project, projectColorMap);
      const proj = `{${color}-fg}${session.project.substring(0, 14).padEnd(14)}{/}`;
      const time = `{#e0af68-fg}${formatTimestamp(session.lastTs).padEnd(18)}{/}`;
      const msgs = `{#7aa2f7-fg}${String(session.estimatedMessages).padStart(4)}{/}{#565f89-fg}msg{/}`;
      const size = `{#565f89-fg}${formatFileSize(session.fileSize).padStart(6)}{/}`;

      const topicMaxLen = Math.max(20, listW - 2);
      let topic = session.topic;
      if (topic.length > topicMaxLen) topic = topic.substring(0, topicMaxLen) + '…';

      const branch = session.gitBranch
        ? `{#73daca-fg}${session.gitBranch.substring(0, 25)}{/}`
        : '';
      const dur = session.duration ? `{#565f89-fg}⏱${session.duration}{/}` : '';

      // Compose a multi-line string for each list item.
      // blessed.list renders each item as a single row, so we pack info densely.
      // Line: project | time | msgs | size
      // (topic + branch shown on next visual line via padding trick)
      let line1 = ` ${proj} ${time} ${msgs} ${size}`;
      let line2 = `   {#a9b1d6-fg}${esc(topic)}{/}`;
      let line3 = branch ? `   ${branch}  ${dur}` : (dur ? `   ${dur}` : '');

      // blessed.list items are single-line, but we can use \n inside them
      // if the list height per item supports it. Unfortunately blessed.list
      // doesn't natively support multi-line items well.
      //
      // So we use a compact two-line format:
      return `${line1}\n${line2}${line3 ? '\n' + line3 : ''}`;
    });
  }

  // ─── Populate list ─────────────────────────────────────────────────────
  // Index 0 = "New Session", index 1+ = sessions
  const NEW_SESSION_LABEL = ' {#9ece6a-fg}{bold}✨ New Conversation{/}';

  function refreshList() {
    const listW = Math.floor((screen.width || 100) / 2) - 2;

    const sessionItems = filteredSessions.map((session) => {
      const color = getProjectColor(session.project, projectColorMap);
      const sm = getSessionMeta(meta, session.sessionId);
      const favIcon = sm.favorite ? '{#e0af68-fg}⭐{/}' : '  ';
      const proj = `{${color}-fg}${session.project.substring(0, 12).padEnd(12)}{/}`;
      const time = `{#e0af68-fg}${formatTimestamp(session.lastTs).padEnd(16)}{/}`;
      const msgs = `{#7aa2f7-fg}${String(session.estimatedMessages).padStart(4)}{/}{#565f89-fg}m{/}`;

      const fixedLen = 2 + 12 + 1 + 16 + 1 + 5 + 2 + 3;
      const topicMaxLen = Math.max(10, listW - fixedLen);
      let topic = session.customTitle || session.topic;

      // Append tags inline after topic
      const tagStr = sm.tags.length > 0
        ? ' ' + sm.tags.map(t => `#${t}`).join(' ')
        : '';

      let display = topic + tagStr;
      if (display.length > topicMaxLen) display = display.substring(0, topicMaxLen) + '…';

      // Split display back into topic part and tag part for coloring
      const topicPart = display.substring(0, Math.min(topic.length, topicMaxLen));
      const tagPart = display.substring(topicPart.length);

      let label = `${favIcon}${proj} ${time} ${msgs} `;
      if (session.customTitle) {
        label += `{#73daca-fg}{bold}${esc(topicPart)}{/}`;
      } else {
        label += `{#a9b1d6-fg}${esc(topicPart)}{/}`;
      }
      if (tagPart) label += `{#f7768e-fg}${esc(tagPart)}{/}`;

      return label;
    });

    const items = [NEW_SESSION_LABEL, ...sessionItems];

    listPanel.setItems(items);
    listPanel.select(selectedIndex + 1);  // +1 because index 0 is "New Session"
    screen.render();
  }

  // ─── Render Detail Panel ───────────────────────────────────────────────
  function renderDetail() {
    if (selectedIndex === -1) {
      const cli = CLI.name;
      let c = '';
      c += `\n {#9ece6a-fg}{bold}✨ Start a New Conversation{/}\n`;
      c += ` {#414868-fg}${'─'.repeat(44)}{/}\n\n`;
      c += ` {#a9b1d6-fg}Open a fresh Claude session and start{/}\n`;
      c += ` {#a9b1d6-fg}coding from scratch.{/}\n\n`;
      c += ` {#565f89-fg}Working Dir{/}  {#7dcfff-fg}${process.cwd()}{/}\n`;
      c += ` {#565f89-fg}CLI{/}          {#73daca-fg}${cli}{/}\n`;
      c += ` {#565f89-fg}Command{/}      {#565f89-fg}${cli}{/}\n\n`;
      c += ` {#414868-fg}${'─'.repeat(44)}{/}\n`;
      c += ` {#9ece6a-fg}{bold}↵ Enter{/}{#9ece6a-fg} or {/}{#9ece6a-fg}{bold}n{/}{#9ece6a-fg} to launch{/}\n`;
      detailPanel.setContent(c);
      detailPanel.setScroll(0);
      return;
    }

    if (filteredSessions.length === 0 || !filteredSessions[selectedIndex]) {
      detailPanel.setContent('\n  {#565f89-fg}No session selected{/}');
      return;
    }

    const session = filteredSessions[selectedIndex];
    loadSessionDetail(session);

    const color = getProjectColor(session.project, projectColorMap);
    const sm = getSessionMeta(meta, session.sessionId);
    let c = '';
    const sep = ` {#414868-fg}${'─'.repeat(44)}{/}`;

    // Title with favorite indicator
    const favLabel = sm.favorite ? ' {#e0af68-fg}⭐{/}' : '';
    c += `\n {${color}-fg}{bold}█ ${session.project}{/}${favLabel}\n`;
    if (session.customTitle) {
      c += ` {#73daca-fg}{bold}📌 ${esc(session.customTitle)}{/}\n`;
    }
    c += sep + '\n\n';

    const fields = [
      ['Session', `{#7dcfff-fg}${session.sessionId}{/}`],
      ['Started', `{#e0af68-fg}${session.firstTs ? new Date(session.firstTs).toLocaleString() : '?'}{/}`],
      ['Last active', `{#e0af68-fg}${session.lastTs ? new Date(session.lastTs).toLocaleString() : '?'}{/}`],
      ['Duration', `{#9ece6a-fg}${session.duration || '<1m'}{/}`],
      ['Messages', `{#7aa2f7-fg}${session.totalMessages || session.estimatedMessages}{/}`],
      ['Size', `{#bb9af7-fg}${formatFileSize(session.fileSize)}{/}`],
    ];
    if (session.gitBranch) fields.push(['Branch', `{#73daca-fg} ${session.gitBranch}{/}`]);
    if (session.version) fields.push(['Claude', `{#565f89-fg}v${session.version}{/}`]);
    if (session.cwd) fields.push(['Directory', `{#565f89-fg}${session.cwd}{/}`]);

    for (const [label, value] of fields) {
      c += ` {#565f89-fg}${label.padEnd(12)}{/} ${value}\n`;
    }

    // Tags section
    if (sm.tags.length > 0) {
      const tagChips = sm.tags.map(t => `{#414868-fg}[{/}{#f7768e-fg}#${t}{/}{#414868-fg}]{/}`).join(' ');
      c += `\n {#f7768e-fg}{bold}🏷️ Tags{/}\n`;
      c += ` ${tagChips}\n`;
    }

    if (session.toolsUsed && session.toolsUsed.length > 0) {
      c += `\n {#7dcfff-fg}{bold}Tools Used{/}\n`;
      const chips = session.toolsUsed.slice(0, 10).map(t => `{#414868-fg}[{/}{#7dcfff-fg}${t}{/}{#414868-fg}]{/}`).join(' ');
      c += ` ${chips}\n`;
      if (session.toolsUsed.length > 10) c += ` {#565f89-fg}+${session.toolsUsed.length - 10} more{/}\n`;
    }

    c += `\n {#bb9af7-fg}{bold}💬 Conversation{/}\n`;
    c += sep + '\n';

    const msgs = (session.userMessages || []).slice(0, 10);
    const assists = (session.assistantSnippets || []);

    if (msgs.length === 0) {
      c += `\n  {#565f89-fg}(no readable messages){/}\n`;
    } else {
      msgs.forEach((msg, i) => {
        const clean = esc(msg.replace(/\n/g, ' ').trim());
        const trunc = clean.length > 80 ? clean.substring(0, 80) + '…' : clean;
        c += `\n {#7aa2f7-fg}{bold}You ❯{/} ${trunc}\n`;
        if (assists[i]) {
          const aClean = esc(assists[i].replace(/\n/g, ' ').trim());
          const aTrunc = aClean.length > 80 ? aClean.substring(0, 80) + '…' : aClean;
          c += ` {#9ece6a-fg}Claude ❯{/} {#565f89-fg}${aTrunc}{/}\n`;
        }
      });
    }

    c += `\n${sep}`;
    c += `\n {#9ece6a-fg}{bold}↵ Enter{/}{#9ece6a-fg} to resume this conversation{/}`;
    c += `\n {#565f89-fg}${CLI.name} --resume ${session.sessionId}{/}\n`;

    detailPanel.setContent(c);
    detailPanel.setScroll(0);
  }

  // ─── Render All ────────────────────────────────────────────────────────
  function renderAll() {
    updateHeader();
    refreshList();
    renderDetail();
    updateFooter();
    listPanel.focus();
    screen.render();
  }

  // ─── Filter ────────────────────────────────────────────────────────────
  function applyFilter() {
    if (!filterText) {
      filteredSessions = [...allSessions];
    } else {
      const terms = filterText.toLowerCase().split(/\s+/);
      filteredSessions = allSessions.filter(s => {
        const sm = getSessionMeta(meta, s.sessionId);
        const haystack = [s.project, s.topic, s.customTitle || '', s.gitBranch || '', s.sessionId, ...(s.userMessages || [])].join(' ').toLowerCase();

        return terms.every(t => {
          // #tag syntax: match against session tags
          if (t.startsWith('#') && t.length > 1) {
            const tagQuery = t.substring(1);
            return sm.tags.some(tag => tag.toLowerCase().includes(tagQuery));
          }
          // ⭐ or "fav" keyword: match only favorited sessions
          if (t === '⭐' || t === 'fav' || t === 'favorite' || t === 'favorites') {
            return sm.favorite;
          }
          return haystack.includes(t);
        });
      });
    }
    selectedIndex = Math.min(selectedIndex, Math.max(-1, filteredSessions.length - 1));
    // When filtering, select first result; when clearing, select New Session
    if (filterText && filteredSessions.length > 0) {
      selectedIndex = 0;
    }
    listPanel.childBase = 0;  // reset scroll to top
    renderAll();
  }

  // ─── Sort ──────────────────────────────────────────────────────────────
  function cycleSort() {
    const modes = ['time', 'size', 'messages', 'project', 'favorites'];
    sortMode = modes[(modes.indexOf(sortMode) + 1) % modes.length];
    const sorters = {
      time: (a, b) => (new Date(b.lastTs || 0).getTime()) - (new Date(a.lastTs || 0).getTime()),
      size: (a, b) => b.fileSize - a.fileSize,
      messages: (a, b) => b.estimatedMessages - a.estimatedMessages,
      project: (a, b) => a.project.localeCompare(b.project) || (new Date(b.lastTs || 0).getTime()) - (new Date(a.lastTs || 0).getTime()),
      favorites: (a, b) => {
        const fa = getSessionMeta(meta, a.sessionId).favorite ? 1 : 0;
        const fb = getSessionMeta(meta, b.sessionId).favorite ? 1 : 0;
        if (fb !== fa) return fb - fa;  // favorites first
        return (new Date(b.lastTs || 0).getTime()) - (new Date(a.lastTs || 0).getTime());
      },
    };
    allSessions.sort(sorters[sortMode]);
    selectedIndex = 0;
    applyFilter();
  }

  // ─── Project Picker ────────────────────────────────────────────────────
  let popupOpen = false;

  function showProjectPicker() {
    const projects = ['  All Projects', ...uniqueProjects.map(p => `  ${p}`)];
    const popup = blessed.list({
      parent: screen, top: 'center', left: 'center',
      width: Math.min(50, Math.max(...projects.map(p => p.length)) + 8),
      height: Math.min(projects.length + 4, 20),
      label: ' {bold}{#7aa2f7-fg}Filter by Project{/} ',
      tags: true, border: { type: 'line' },
      style: {
        border: { fg: '#7aa2f7' }, bg: '#24283b', fg: '#a9b1d6',
        selected: { bg: '#3d59a1', fg: 'white', bold: true },
        label: { fg: '#7aa2f7' },
      },
      items: projects, keys: true, vi: true, mouse: true,
    });
    popupOpen = true;
    popup.focus(); screen.render();
    popup.on('select', (item, index) => {
      filterText = index === 0 ? '' : uniqueProjects[index - 1];
      popup.destroy(); popupOpen = false; selectedIndex = 0; applyFilter();
    });
    popup.key(['escape', 'q'], () => { popup.destroy(); popupOpen = false; screen.render(); });
  }

  // ─── Key Bindings ──────────────────────────────────────────────────────

  // Monkey-patch listPanel.select: update selection WITHOUT scrolling.
  const _origSelect = listPanel.select.bind(listPanel);
  listPanel.select = function(index) {
    const sb = this.childBase;
    _origSelect(index);
    this.childBase = sb;
  };

  // Prevent blessed's internal select-on-click from double-firing moveSelection
  let suppressSelectEvent = false;

  listPanel.on('select item', (item, index) => {
    if (suppressSelectEvent) return;
    selectedIndex = index - 1;  // list index 0 = New Session = -1
    renderDetail(); updateHeader(); screen.render();
  });

  function moveSelection(delta) {
    const newIdx = selectedIndex + delta;
    // -1 = New Session, 0..length-1 = sessions
    if (newIdx >= -1 && newIdx < filteredSessions.length) {
      selectedIndex = newIdx;
      const listIdx = selectedIndex + 1;  // list index (0 = New Session row)
      suppressSelectEvent = true;
      listPanel.select(listIdx);
      suppressSelectEvent = false;

      // Scroll only if selection went out of viewport
      const base = listPanel.childBase;
      const visible = listPanel.height;
      if (listIdx < base) {
        listPanel.childBase = listIdx;
      } else if (listIdx >= base + visible) {
        listPanel.childBase = listIdx - visible + 1;
      }

      renderDetail();
      updateHeader();
      screen.render();
    }
  }

  screen.key(['down'], () => {
    if (popupOpen) return;
    if (isSearchMode) { isSearchMode = false; updateHeader(); screen.render(); }
    moveSelection(1);
  });
  screen.key(['up'], () => {
    if (popupOpen) return;
    if (isSearchMode) { isSearchMode = false; updateHeader(); screen.render(); }
    moveSelection(-1);
  });
  screen.key(['home'], () => {
    if (popupOpen) return;
    if (isSearchMode) { isSearchMode = false; }
    selectedIndex = -1;
    suppressSelectEvent = true; listPanel.select(0); suppressSelectEvent = false;
    listPanel.childBase = 0;
    renderDetail(); updateHeader(); screen.render();
  });
  screen.key(['end'], () => {
    if (popupOpen) return;
    if (isSearchMode) { isSearchMode = false; }
    selectedIndex = Math.max(0, filteredSessions.length - 1);
    suppressSelectEvent = true; listPanel.select(selectedIndex + 1); suppressSelectEvent = false;
    listPanel.childBase = Math.max(0, selectedIndex + 1 - listPanel.height + 1);
    renderDetail(); updateHeader(); screen.render();
  });
  screen.key(['pagedown', 'C-d'], () => {
    if (popupOpen) return;
    if (isSearchMode) { isSearchMode = false; updateHeader(); screen.render(); }
    moveSelection(Math.floor((listPanel.height || 20) / 2));
  });
  screen.key(['pageup', 'C-u'], () => {
    if (popupOpen) return;
    if (isSearchMode) { isSearchMode = false; updateHeader(); screen.render(); }
    moveSelection(-Math.floor((listPanel.height || 20) / 2));
  });

  // Search
  screen.key(['/'], () => {
    if (isSearchMode) return;
    isSearchMode = true; filterText = ''; applyFilter();
  });

  screen.on('keypress', (ch, key) => {
    // Backspace: always works when there's filter text, regardless of search mode
    if (key.name === 'backspace' && filterText) {
      filterText = filterText.slice(0, -1);
      selectedIndex = -1;
      isSearchMode = !!filterText;  // exit search when empty
      applyFilter();
      return;
    }
    if (!isSearchMode) return;
    if (key.name === 'return' || key.name === 'enter') { isSearchMode = false; renderAll(); return; }
    if (key.name === 'escape') { isSearchMode = false; filterText = ''; applyFilter(); return; }
    // Only accept printable characters (exclude control chars like \r \n \t)
    if (ch && ch.length === 1 && ch.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) { filterText += ch; selectedIndex = -1; applyFilter(); }
  });

  // ─── Resume Session ─────────────────────────────────────────────────────
  // Auto-detect: use mai-claude if available, otherwise fall back to claude

  function resumeSession(session) {
    screen.destroy();

    const label = CLI.name;

    console.log(`\n\x1b[36m⚡ Resuming conversation with ${label}\x1b[0m`);
    console.log(`\x1b[90m   Session: ${session.sessionId}\x1b[0m`);
    console.log(`\x1b[90m   Project: ${session.project}  │  Branch: ${session.gitBranch || 'N/A'}  │  Messages: ${session.estimatedMessages}\x1b[0m\n`);

    const child = spawn(
      `${CLI.cmd} --resume ${session.sessionId}`,
      { stdio: 'inherit', cwd: session.cwd || process.cwd(), shell: true },
    );
    child.on('error', (err) => {
      console.error(`\x1b[31mFailed to resume: ${err.message}\x1b[0m`);
      console.log(`\x1b[33mManual: ${label} --resume ${session.sessionId}\x1b[0m`);
      process.exit(1);
    });
    child.on('exit', (code) => process.exit(code || 0));
  }

  function startNewSession() {
    screen.destroy();

    const label = CLI.name;

    console.log(`\n\x1b[36m✨ Starting new conversation with ${label}\x1b[0m\n`);

    const child = spawn(CLI.cmd, { stdio: 'inherit', cwd: process.cwd(), shell: true });
    child.on('error', (err) => {
      console.error(`\x1b[31mFailed to start: ${err.message}\x1b[0m`);
      process.exit(1);
    });
    child.on('exit', (code) => process.exit(code || 0));
  }

  screen.key(['enter'], () => {
    if (isSearchMode) { isSearchMode = false; renderAll(); return; }
    if (popupOpen) return;
    if (selectedIndex === -1) { startNewSession(); return; }
    if (filteredSessions.length === 0) return;
    resumeSession(filteredSessions[selectedIndex]);
  });

  // Quick shortcut: n = new session
  screen.key(['n'], () => {
    if (isSearchMode) return;
    startNewSession();
  });

  // Copy session ID
  screen.key(['c'], () => {
    if (isSearchMode) return;
    if (filteredSessions.length === 0) return;
    const sid = filteredSessions[selectedIndex].sessionId;
    try {
      const proc = spawn('pbcopy', [], { stdio: ['pipe', 'ignore', 'ignore'] });
      proc.stdin.write(sid); proc.stdin.end();
      footer.setContent(`\n  {#9ece6a-fg}{bold}✓ Copied:{/} {#7dcfff-fg}${sid}{/}`);
      screen.render();
      setTimeout(() => { updateFooter(); screen.render(); }, 1500);
    } catch (e) { /* silently fail */ }
  });

  // Toggle favorite
  screen.key(['f'], () => {
    if (isSearchMode || popupOpen) return;
    if (selectedIndex < 0 || selectedIndex >= filteredSessions.length) return;
    const session = filteredSessions[selectedIndex];
    const nowFav = toggleFavorite(meta, session.sessionId);
    const icon = nowFav ? '⭐' : '☆';
    footer.setContent(`\n  {#e0af68-fg}{bold}${icon} ${nowFav ? 'Favorited' : 'Unfavorited'}{/}`);
    renderAll();
    setTimeout(() => { updateFooter(); screen.render(); }, 1200);
  });

  // Tag management — handled via keypress since '#' is a shifted character
  // that some terminal/blessed combos may not route through screen.key
  screen.on('keypress', (ch, key) => {
    if (ch === '#' && !isSearchMode && !popupOpen) {
      if (selectedIndex < 0 || selectedIndex >= filteredSessions.length) return;
      showTagPicker(filteredSessions[selectedIndex]);
    }
  });

  function showTagPicker(session) {
    const sm = getSessionMeta(meta, session.sessionId);
    const currentTags = new Set(sm.tags);

    // Build tag list: all known tags (defaults + used), with checkmarks for active ones
    const usedTags = getAllUsedTags(meta);
    const allTags = [...new Set([...DEFAULT_TAGS, ...usedTags])].sort();

    const items = [
      '  {#9ece6a-fg}{bold}+ New custom tag…{/}',
      ...allTags.map(t => {
        const checked = currentTags.has(t) ? '{#9ece6a-fg}✓{/}' : ' ';
        return `  ${checked} {#f7768e-fg}#${t}{/}`;
      }),
    ];

    const popup = blessed.list({
      parent: screen, top: 'center', left: 'center',
      width: Math.min(45, Math.max(...items.map(i => i.replace(/\{[^}]*\}/g, '').length)) + 8),
      height: Math.min(items.length + 4, 20),
      label: ' {bold}{#f7768e-fg}🏷️ Tags{/} ',
      tags: true, border: { type: 'line' },
      style: {
        border: { fg: '#f7768e' }, bg: '#24283b', fg: '#a9b1d6',
        selected: { bg: '#3d59a1', fg: 'white', bold: true },
        label: { fg: '#f7768e' },
      },
      items: items, keys: true, vi: true, mouse: true,
    });
    popupOpen = true;
    popup.focus(); screen.render();

    popup.on('select', (item, index) => {
      if (index === 0) {
        // New custom tag — show input
        popup.destroy();
        popupOpen = false;
        showTagInput(session);
        return;
      }
      // Toggle the selected tag
      const tagName = allTags[index - 1];
      if (currentTags.has(tagName)) {
        currentTags.delete(tagName);
      } else {
        currentTags.add(tagName);
      }
      setSessionTags(meta, session.sessionId, [...currentTags]);

      // Refresh the popup items to show updated checkmarks
      const refreshedItems = [
        '  {#9ece6a-fg}{bold}+ New custom tag…{/}',
        ...allTags.map(t => {
          const checked = currentTags.has(t) ? '{#9ece6a-fg}✓{/}' : ' ';
          return `  ${checked} {#f7768e-fg}#${t}{/}`;
        }),
      ];
      popup.setItems(refreshedItems);
      popup.select(index);
      screen.render();
    });

    popup.key(['escape', 'q'], () => {
      popup.destroy();
      popupOpen = false;
      renderAll();
    });
  }

  function showTagInput(session) {
    const inputBox = blessed.textbox({
      parent: screen, top: 'center', left: 'center',
      width: 40, height: 3,
      label: ' {bold}{#f7768e-fg}New Tag{/} ',
      tags: true, border: { type: 'line' },
      style: {
        border: { fg: '#f7768e' }, bg: '#24283b', fg: '#a9b1d6',
        label: { fg: '#f7768e' },
      },
      inputOnFocus: true,
    });
    popupOpen = true;
    inputBox.focus();
    screen.render();

    inputBox.on('submit', (value) => {
      inputBox.destroy();
      popupOpen = false;
      const tagName = value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (tagName) {
        const sm = getSessionMeta(meta, session.sessionId);
        const tags = new Set(sm.tags);
        tags.add(tagName);
        setSessionTags(meta, session.sessionId, [...tags]);
        footer.setContent(`\n  {#9ece6a-fg}{bold}✓ Tagged:{/} {#f7768e-fg}#${tagName}{/}`);
        renderAll();
        setTimeout(() => { updateFooter(); screen.render(); }, 1500);
      } else {
        renderAll();
      }
    });

    inputBox.on('cancel', () => {
      inputBox.destroy();
      popupOpen = false;
      renderAll();
    });
  }

  screen.key(['s'], () => { if (!isSearchMode) cycleSort(); });
  screen.key(['p'], () => { if (!isSearchMode) showProjectPicker(); });
  screen.key(['escape'], () => {
    if (isSearchMode) { isSearchMode = false; filterText = ''; applyFilter(); return; }
    filterText = ''; selectedIndex = -1; applyFilter();
  });
  screen.key(['q', 'C-c'], () => { screen.destroy(); process.exit(0); });

  // Remove blessed's built-in wheel handlers (they call select which changes selection)
  listPanel.removeAllListeners('element wheeldown');
  listPanel.removeAllListeners('element wheelup');

  // Mouse wheel on list — scroll viewport, keep selection in view
  function clampSelection() {
    const base = listPanel.childBase;
    const visible = listPanel.height;
    const listIdx = selectedIndex + 1;  // +1 for New Session row
    if (listIdx < base) {
      selectedIndex = base - 1;  // -1 to convert back
      suppressSelectEvent = true; listPanel.select(base); suppressSelectEvent = false;
      renderDetail(); updateHeader();
    } else if (listIdx >= base + visible) {
      selectedIndex = base + visible - 1 - 1;  // -1 for list→session offset
      suppressSelectEvent = true; listPanel.select(base + visible - 1); suppressSelectEvent = false;
      renderDetail(); updateHeader();
    }
  }

  listPanel.on('element wheeldown', () => {
    const maxBase = Math.max(0, listPanel.items.length - listPanel.height);
    if (listPanel.childBase < maxBase) {
      listPanel.childBase++;
      clampSelection();
      screen.render();
    }
  });
  listPanel.on('element wheelup', () => {
    if (listPanel.childBase > 0) {
      listPanel.childBase--;
      clampSelection();
      screen.render();
    }
  });

  // Mouse wheel on detail
  detailPanel.on('wheeldown', () => { detailPanel.scroll(2); screen.render(); });
  detailPanel.on('wheelup', () => { detailPanel.scroll(-2); screen.render(); });

  // ─── Go! ───────────────────────────────────────────────────────────────
  renderAll();
  listPanel.focus();
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
\x1b[36m🚀 Claude Starter\x1b[0m

Usage:
  claude-starter            Launch interactive TUI
  claude-starter --list [N] Print latest N sessions (default: 30)
  claude-starter --help     Show this help

TUI Keyboard Shortcuts:
  ↑/↓           Navigate sessions
  Enter         Start new / resume selected session
  n             Start new session
  /             Search (fuzzy filter, supports #tag and fav)
  f             Toggle favorite ⭐ on selected session
  #             Add/remove tags on selected session
  p             Filter by project
  s             Cycle sort mode (time/size/messages/project/favorites)
  c             Copy session ID
  Home / End    Jump to top / bottom
  Ctrl-D/U      Page down / up
  Esc           Clear filter
  q / Ctrl-C    Quit
`);
  process.exit(0);
}

if (args.includes('--list') || args.includes('-l')) {
  const limitIdx = args.indexOf('--list') !== -1 ? args.indexOf('--list') : args.indexOf('-l');
  const limit = parseInt(args[limitIdx + 1]) || 30;
  runListMode(limit);
  process.exit(0);
}

createApp();
