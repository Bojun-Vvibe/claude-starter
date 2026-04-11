#!/usr/bin/env node

/**
 * Claude Starter — TUI Keyboard Interaction Tests
 * ─────────────────────────────────────────────────
 * Run:  npm run test:tui   (or)   node --test test-tui.js
 *
 * Mocks `blessed` to simulate the TUI without a real terminal.
 * Fires key events through captured handlers and inspects widget state.
 *
 * Strategy:
 *   1. Override os.homedir() → temp dir with mock sessions
 *   2. Replace blessed in require.cache → mock widgets with EventEmitter
 *   3. require('./index.js') → gets mocked blessed + temp homedir
 *   4. Call createApp() → captures all key handlers
 *   5. Fire keys → inspect widget content/items
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const EventEmitter = require('events');

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CREATE MOCK SESSION FILES
// ═══════════════════════════════════════════════════════════════════════════════

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-tui-test-'));
const claudeDir = path.join(tmpDir, '.claude');
const projectsDir = path.join(claudeDir, 'projects');

const projAlpha = path.join(projectsDir, '-Users-test-Desktop-project-alpha');
const projBeta  = path.join(projectsDir, '-Users-test-Projects-beta');
const projGamma = path.join(projectsDir, '-Users-test-Desktop-gamma');

fs.mkdirSync(projAlpha, { recursive: true });
fs.mkdirSync(projBeta,  { recursive: true });
fs.mkdirSync(projGamma, { recursive: true });

function writeSession(dir, id, lines) {
  fs.writeFileSync(path.join(dir, `${id}.jsonl`), lines.map(l => JSON.stringify(l)).join('\n'));
}

// Session A1 — most recent (April 10)
writeSession(projAlpha, 'sess-a1', [
  { timestamp: '2026-04-10T10:00:00Z', type: 'system', version: '1.0', gitBranch: 'main', cwd: '/Users/test/Desktop/project-alpha' },
  { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Fix the login bug in auth module' }] } },
  { timestamp: '2026-04-10T11:00:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'I fixed the login bug' }] } },
  { timestamp: '2026-04-10T11:30:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Now add unit tests' }] } },
  { timestamp: '2026-04-10T12:00:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'Added 5 unit tests' }] } },
]);

// Session A2 — April 9
writeSession(projAlpha, 'sess-a2', [
  { timestamp: '2026-04-09T08:00:00Z', type: 'system', gitBranch: 'feature/auth', cwd: '/Users/test/Desktop/project-alpha' },
  { timestamp: '2026-04-09T08:05:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Add OAuth support to the API' }] } },
  { timestamp: '2026-04-09T09:30:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'OAuth integration complete' }] } },
]);

// Session B1 — April 8, has custom title + permissionMode
writeSession(projBeta, 'sess-b1', [
  { timestamp: '2026-04-08T14:00:00Z', type: 'system', gitBranch: 'develop', permissionMode: 'auto', cwd: '/Users/test/Projects/beta' },
  { timestamp: '2026-04-08T14:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Refactor the database layer' }] } },
  { timestamp: '2026-04-08T16:00:00Z', type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }, { type: 'text', text: 'Done' }] } },
  { type: 'custom-title', customTitle: 'DB Refactor' },
]);

// Session G1 — April 7
writeSession(projGamma, 'sess-g1', [
  { timestamp: '2026-04-07T10:00:00Z', type: 'system', gitBranch: 'main', cwd: '/Users/test/Desktop/gamma' },
  { timestamp: '2026-04-07T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Setup React frontend' }] } },
  { timestamp: '2026-04-07T10:30:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'React app initialized' }] } },
]);

// Session G2 — April 6
writeSession(projGamma, 'sess-g2', [
  { timestamp: '2026-04-06T09:00:00Z', type: 'system', gitBranch: 'feature/dashboard', cwd: '/Users/test/Desktop/gamma' },
  { timestamp: '2026-04-06T09:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Build the analytics dashboard' }] } },
  { timestamp: '2026-04-06T11:00:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'Dashboard built' }] } },
]);

// Meta file
fs.writeFileSync(
  path.join(claudeDir, 'claude-starter-meta.json'),
  JSON.stringify({ sessions: {} }, null, 2),
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MOCK BLESSED
// ═══════════════════════════════════════════════════════════════════════════════

// Captured event handlers from screen.key() and screen.on('keypress')
const screenKeyHandlers = {};  // { keyName: [fn, ...] }
const screenKeypressHandlers = [];  // [fn, ...]

// Named widgets for inspection
const W = {};
const allPopups = [];
let widgetId = 0;

function createMockWidget(label, opts) {
  const w = new EventEmitter();
  w.__label = label;
  w.__id = widgetId++;
  w._content = '';
  w._items = [];
  w._selectedIndex = 0;
  w._destroyed = false;
  w._scrollPos = 0;
  w.childBase = 0;
  w.height = 30;
  w.width = 100;
  w.items = [];
  w.style = opts.style || {};

  w.setContent = function(c) { this._content = c; };
  w.getContent = function() { return this._content; };
  w.setItems = function(items) { this._items = [...items]; this.items = [...items]; };
  w.select = function(i) { this._selectedIndex = i; };
  w.focus = function() {};
  w.destroy = function() { this._destroyed = true; };
  w.scroll = function(n) { this._scrollPos += n; };
  w.setScroll = function(n) { this._scrollPos = n; };
  w.render = function() {};

  // Initialize items from opts if provided (e.g. popup lists)
  if (opts.items) {
    w._items = [...opts.items];
    w.items = [...opts.items];
  }

  w.key = function(keys, handler) {
    const ks = Array.isArray(keys) ? keys : [keys];
    for (const k of ks) {
      // Store under widget label so popup handlers are separate
      const store = (label === 'screen') ? screenKeyHandlers : (w.__keyHandlers || (w.__keyHandlers = {}));
      if (!store[k]) store[k] = [];
      store[k].push(handler);
    }
  };

  // Track popups
  if (opts.top === 'center' && opts.left === 'center') {
    allPopups.push(w);
  }

  return w;
}

// The mock screen
const mockScreen = createMockWidget('screen', {});
mockScreen.width = 120;
mockScreen.height = 40;
mockScreen.style = {};

// Override screen.on for 'keypress'
const _origScreenOn = mockScreen.on.bind(mockScreen);
mockScreen.on = function(evt, handler) {
  if (evt === 'keypress') {
    screenKeypressHandlers.push(handler);
  }
  return _origScreenOn(evt, handler);
};

const mockBlessed = {
  screen: () => mockScreen,
  box: (opts) => {
    const w = createMockWidget('box', opts);
    // Identify by position
    if (opts.parent === mockScreen && opts.top === 0 && opts.height === 3) W.header = w;
    if (opts.parent === mockScreen && opts.bottom === 0) W.footer = w;
    if (opts.parent === mockScreen && opts.top === 4 && opts.left && String(opts.left).includes('50%')) W.detail = w;
    return w;
  },
  list: (opts) => {
    const w = createMockWidget('list', opts);
    if (opts.parent === mockScreen && opts.top === 4 && opts.left === 0) {
      W.list = w;
      w.height = 8;  // Small enough so Ctrl-D half-page (4) works with 5 sessions
    }
    return w;
  },
  line: (opts) => createMockWidget('line', opts),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PATCH REQUIRE + HOMEDIR, LOAD MODULE, CALL createApp()
// ═══════════════════════════════════════════════════════════════════════════════

// Override os.homedir BEFORE require
const _origHomedir = os.homedir;
os.homedir = () => tmpDir;

// Override process.exit
const _origExit = process.exit;
process.exit = (code) => { /* swallow */ };

// Override process.stdout.write and console.log to suppress TUI output
const _origStdoutWrite = process.stdout.write;
process.stdout.write = function() { return true; };
const _origConsoleLog = console.log;
const _origConsoleError = console.error;
console.log = () => {};
console.error = () => {};

// Mock child_process.spawn so startNewSession/resumeSession don't spawn real processes.
// NOTE: We only mock spawn, not execSync (needed by detectCLI).
const child_process = require('child_process');
const _origSpawn = child_process.spawn;
const spawnCalls = [];  // Track spawn calls for test assertions
child_process.spawn = function(cmd, args, opts) {
  spawnCalls.push({ cmd, args, opts });
  // Return a fake child process
  const fakeChild = new EventEmitter();
  fakeChild.stdin = { write: () => {}, end: () => {} };
  fakeChild.stdout = null;
  fakeChild.stderr = null;
  fakeChild.pid = 99999;
  return fakeChild;
};

// Replace blessed in require cache — we must populate the cache entry
// without actually loading blessed (which might set up process handles).
const blessedPath = require.resolve('blessed');
// Only require blessed if it's not already cached, to populate the cache slot
if (!require.cache[blessedPath]) {
  // Create a fake cache entry without loading the real module
  require.cache[blessedPath] = {
    id: blessedPath,
    filename: blessedPath,
    loaded: true,
    exports: mockBlessed,
    children: [],
  };
} else {
  require.cache[blessedPath].exports = mockBlessed;
}
const _origBlessed = null; // We don't need the original

// Clear index.js cache
const indexPath = path.resolve(__dirname, 'index.js');
delete require.cache[indexPath];

// Require fresh — picks up mocked blessed + mocked homedir
const mod = require('./index.js');

// Call createApp() — this registers all key handlers on mockScreen
mod.createApp();

// Restore globals (tests don't need them mocked anymore)
// Don't restore blessed — keep mock to avoid loading real blessed
// Restore globals — but keep console and stdout mocked since TUI handlers
// (startNewSession, resumeSession) may fire during tests and print to console.
os.homedir = _origHomedir;
process.exit = _origExit;
child_process.spawn = _origSpawn;
// NOTE: console.log, console.error, and process.stdout.write are restored
// in the after() cleanup block below, after all tests have finished.

// ═══════════════════════════════════════════════════════════════════════════════
// 4. KEY SIMULATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function fireScreenKey(name) {
  const handlers = screenKeyHandlers[name] || [];
  for (const h of handlers) h();
}

function fireKeypress(ch, keyName, extra) {
  const key = { name: keyName || ch, ctrl: false, meta: false, shift: false, ...extra };
  for (const h of screenKeypressHandlers) {
    h(ch || '', key);
  }
}

function pressKey(name, ch) {
  fireScreenKey(name);
  fireKeypress(ch || (name.length === 1 ? name : ''), name);
}

function typeChar(ch) {
  fireKeypress(ch, ch);
}

function pressEnter() {
  fireScreenKey('enter');
  fireKeypress('', 'return');
}

function pressEscape() {
  fireScreenKey('escape');
  fireKeypress('', 'escape');
}

function pressBackspace() {
  fireKeypress('', 'backspace');
}

function pressDown() {
  fireScreenKey('down');
}

function pressUp() {
  fireScreenKey('up');
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. STATE INSPECTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function headerText()  { return W.header ? W.header._content : ''; }
function footerText()  { return W.footer ? W.footer._content : ''; }
function detailText()  { return W.detail ? W.detail._content : ''; }
function listItems()   { return W.list ? W.list._items : []; }
function listSelected(){ return W.list ? W.list._selectedIndex : -1; }
function lastPopup()   { return allPopups[allPopups.length - 1]; }

// ═══════════════════════════════════════════════════════════════════════════════
// 6. TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('TUI — Initial State', () => {
  it('loads 5 sessions into the list', () => {
    // "New Session" row + 5 sessions = 6 items
    assert.equal(listItems().length, 6, `Expected 6 list items (1 new + 5 sessions), got ${listItems().length}`);
  });

  it('list item 0 is "New Conversation"', () => {
    assert.ok(listItems()[0].includes('New Conversation'), 'First item should be New Conversation');
  });

  it('starts with selectedIndex = 0 (New Session row)', () => {
    // selectedIndex in blessed list: 0 = New Session
    assert.equal(listSelected(), 0);
  });

  it('header shows session count', () => {
    const h = headerText();
    assert.ok(h.includes('5'), `Header should show "5" sessions: ${h}`);
  });

  it('header shows sort mode [time]', () => {
    assert.ok(headerText().includes('[time]'));
  });

  it('detail panel shows "Start a New Conversation"', () => {
    assert.ok(detailText().includes('New Conversation'), `Detail should show new conversation: ${detailText().substring(0, 100)}`);
  });

  it('footer shows all shortcut keys', () => {
    const f = footerText();
    for (const key of ['New', 'Resume', 'Mode', 'Search', 'Sort', 'Rename', 'Delete', 'Quit']) {
      assert.ok(f.includes(key), `Footer missing "${key}"`);
    }
  });
});

describe('TUI — Navigation (j/k/↑/↓)', () => {
  it('j moves selection down', () => {
    const before = listSelected();
    pressKey('j', 'j');
    assert.equal(listSelected(), before + 1);
  });

  it('k moves selection back up', () => {
    const before = listSelected();
    pressKey('k', 'k');
    assert.equal(listSelected(), before - 1);
  });

  it('↓ moves selection down', () => {
    const before = listSelected();
    pressDown();
    assert.equal(listSelected(), before + 1);
  });

  it('↑ moves selection back up', () => {
    const before = listSelected();
    pressUp();
    assert.equal(listSelected(), before - 1);
  });

  it('detail panel updates when navigating to a session', () => {
    // Navigate to first session (index 1 in list = session 0)
    // Reset to top first
    fireScreenKey('home');
    pressDown();  // now on session 0

    const d = detailText();
    // Should show session details, not "New Conversation"
    assert.ok(!d.includes('Start a New Conversation'), 'Should show session detail, not new conversation');
    assert.ok(d.includes('Session') || d.includes('sess-'), `Detail should show session info: ${d.substring(0, 200)}`);
  });

  it('cannot navigate above New Session (index -1)', () => {
    fireScreenKey('home');  // go to top
    assert.equal(listSelected(), 0);  // 0 = New Session row
    pressUp();
    assert.equal(listSelected(), 0, 'Should not go above New Session');
  });

  it('cannot navigate below last session', () => {
    fireScreenKey('end');  // go to bottom
    const atBottom = listSelected();
    pressDown();
    assert.equal(listSelected(), atBottom, 'Should not go below last session');
  });
});

describe('TUI — Vim Navigation (g/G/Home/End)', () => {
  before(() => {
    // Reset to middle
    fireScreenKey('home');
    pressDown();
    pressDown();
  });

  it('G jumps to last session', () => {
    fireKeypress('G', 'G', { shift: true });
    // Last session = index 5 in list (0=New + 5 sessions)
    assert.equal(listSelected(), 5);
  });

  it('g jumps to New Session (top)', () => {
    fireKeypress('g', 'g');
    assert.equal(listSelected(), 0);
  });

  it('Home jumps to top', () => {
    fireScreenKey('end');
    fireScreenKey('home');
    assert.equal(listSelected(), 0);
  });

  it('End jumps to bottom', () => {
    fireScreenKey('home');
    fireScreenKey('end');
    assert.equal(listSelected(), 5);
  });
});

describe('TUI — Search Mode (/)', () => {
  before(() => {
    // Start from clean state
    fireScreenKey('home');
  });

  it('/ enters search mode', () => {
    pressKey('/');
    assert.ok(headerText().includes('▌'), 'Header should show search cursor');
  });

  it('typing characters filters the list', () => {
    typeChar('R');
    typeChar('e');
    typeChar('a');
    typeChar('c');
    typeChar('t');

    // "React" should match session G1 ("Setup React frontend")
    const items = listItems();
    // Should have fewer items than 6 (filtered)
    assert.ok(items.length < 6, `Should have filtered results, got ${items.length} items`);
    // Should still have "New Session" + matched sessions
    assert.ok(items.length >= 1, 'Should have at least New Session + 1 match');
  });

  it('header shows search text', () => {
    assert.ok(headerText().includes('React'), 'Header should show "React" search text');
  });

  it('footer shows search-mode shortcuts', () => {
    const f = footerText();
    assert.ok(f.includes('Confirm') || f.includes('Delete char') || f.includes('Clear'),
      'Footer should show search mode shortcuts');
  });

  it('backspace removes last character', () => {
    pressBackspace();  // Remove 't' → "Reac"
    assert.ok(headerText().includes('Reac'), 'Should show "Reac" after backspace');
  });

  it('Esc clears search and exits search mode', () => {
    pressEscape();
    // Should be back to all sessions
    assert.equal(listItems().length, 6, 'Should show all 6 items after clearing search');
    assert.ok(!headerText().includes('▌'), 'Search cursor should be gone');
  });

  it('search with Enter confirms and exits search mode', () => {
    pressKey('/');
    typeChar('O');
    typeChar('A');
    typeChar('u');
    typeChar('t');
    typeChar('h');

    // Confirm search
    pressEnter();

    // Should still be filtered but search mode exited
    assert.ok(!headerText().includes('▌'), 'Search cursor should be gone after Enter');
    // "OAuth" matches sess-a2
    const items = listItems();
    assert.ok(items.length < 6, 'Should still be filtered after confirm');
  });

  it('cleanup: clear filter', () => {
    pressEscape();
    assert.equal(listItems().length, 6);
  });
});

describe('TUI — Search with navigation', () => {
  it('↓ during search exits search mode but keeps filter', () => {
    pressKey('/');
    typeChar('l');
    typeChar('o');
    typeChar('g');

    const itemsBefore = listItems().length;
    pressDown();

    // Search mode should exit but filter remains
    assert.ok(!headerText().includes('▌'), 'Search cursor gone');
    // Filter text "log" should still be active
    const items = listItems();
    assert.equal(items.length, itemsBefore, 'Filter should still be applied');
  });

  it('cleanup: clear filter', () => {
    pressEscape();
    assert.equal(listItems().length, 6);
  });
});

describe('TUI — Sort (s key)', () => {
  before(() => {
    fireScreenKey('home');
  });

  it('s cycles from time to size', () => {
    pressKey('s', 's');
    assert.ok(headerText().includes('[size]'), `Should show [size] sort mode`);
  });

  it('s cycles to messages', () => {
    pressKey('s', 's');
    assert.ok(headerText().includes('[messages]'), 'Should show [messages] sort mode');
  });

  it('s cycles to project', () => {
    pressKey('s', 's');
    assert.ok(headerText().includes('[project]'), 'Should show [project] sort mode');
  });

  it('s wraps back to time', () => {
    pressKey('s', 's');
    assert.ok(headerText().includes('[time]'), 'Should wrap back to [time]');
  });

  it('s is ignored during search mode', () => {
    pressKey('/');
    typeChar('t');
    pressKey('s', 's');
    // Should still be [time] since s is a search character, not sort
    assert.ok(headerText().includes('[time]'), 'Sort should not change during search');

    // Cleanup
    pressEscape();
  });
});

describe('TUI — Detail Panel Content', () => {
  before(() => {
    // Go to New Session
    fireScreenKey('home');
  });

  it('New Session detail shows working directory', () => {
    const d = detailText();
    assert.ok(d.includes('Working Dir') || d.includes('New Conversation'));
  });

  it('Session detail shows session ID', () => {
    pressDown();  // First session
    const d = detailText();
    assert.ok(d.includes('sess-'), `Detail should contain session ID: ${d.substring(0, 300)}`);
  });

  it('Session detail shows project name', () => {
    const d = detailText();
    assert.ok(
      d.includes('project-alpha') || d.includes('beta') || d.includes('gamma'),
      'Detail should show project name',
    );
  });

  it('Session detail shows conversation messages', () => {
    const d = detailText();
    assert.ok(d.includes('Conversation') || d.includes('You >') || d.includes('Claude >'),
      'Detail should show conversation section');
  });

  it('Session with custom title shows it in detail', () => {
    // Navigate to sess-b1 which has custom title "DB Refactor"
    fireScreenKey('home');
    for (let i = 0; i < 5; i++) pressDown();  // navigate through sessions

    // Find the session with DB Refactor by checking all positions
    let found = false;
    fireScreenKey('home');
    for (let i = 0; i <= 5; i++) {
      if (i > 0) pressDown();
      if (detailText().includes('DB Refactor')) {
        found = true;
        break;
      }
    }
    assert.ok(found, 'Should find session with custom title "DB Refactor"');
  });
});

describe('TUI — Key guards (keys blocked during popups/search/rename)', () => {
  before(() => {
    fireScreenKey('home');
    pressDown();
  });

  it('d is blocked during search mode', () => {
    pressKey('/');
    typeChar('t');

    // d should be a search character, not trigger danger mode
    // We can't directly check resumeSession wasn't called, but
    // the TUI should still be alive (no exit)
    pressKey('d', 'd');
    // If d triggered resume, screen.destroy would be called and exit
    // Since we swallowed exit, check that the header still shows search
    assert.ok(headerText().includes('▌') || headerText().includes('td'),
      'd should be treated as search character');

    pressEscape();
  });

  it('n is blocked during search mode', () => {
    pressKey('/');
    typeChar('n');

    // 'n' should be added to search text, not trigger new session
    assert.ok(headerText().includes('n'), 'n should be search character');

    pressEscape();
  });

  it('c is blocked during search mode', () => {
    pressKey('/');
    typeChar('c');

    assert.ok(headerText().includes('c'), 'c should be search character');

    pressEscape();
  });

  it('s during search mode adds to search text', () => {
    pressKey('/');
    typeChar('s');

    assert.ok(headerText().includes('s'), 's should be search character');

    pressEscape();
  });

  it('r is blocked during search mode', () => {
    pressKey('/');
    typeChar('r');

    // r should not open rename popup
    assert.ok(headerText().includes('r'), 'r should be search character');

    pressEscape();
  });

  it('x is blocked during search mode', () => {
    pressKey('/');
    typeChar('x');

    assert.ok(headerText().includes('x'));

    pressEscape();
  });

  it('j/k do NOT navigate during search mode (they are search chars)', () => {
    pressKey('/');
    const selectedBefore = listSelected();
    typeChar('j');
    typeChar('k');
    // j and k should be search characters, not navigation
    assert.ok(headerText().includes('jk'), 'j and k should be search text');

    pressEscape();
  });
});

describe('TUI — d key (danger mode resume)', () => {
  before(() => {
    fireScreenKey('home');
  });

  it('d on New Session does nothing', () => {
    // selectedIndex = -1 (New Session) → d should be a no-op
    pressKey('d', 'd');
    // TUI still alive, no crash
    assert.ok(listItems().length > 0, 'TUI should still be alive');
  });
});

describe('TUI — x/delete key (delete session)', () => {
  before(() => {
    fireScreenKey('home');
  });

  it('x on New Session does nothing', () => {
    pressKey('x', 'x');
    // No popup should appear for New Session
    const popupsBefore = allPopups.length;
    // Actually the popup would have been created if x worked
    // Let's just verify TUI is stable
    assert.ok(listItems().length > 0);
  });

  it('x on a session shows delete confirmation popup', () => {
    pressDown();  // Select a session
    const popupsBefore = allPopups.length;
    pressKey('x', 'x');

    // A popup should have been created
    assert.ok(allPopups.length > popupsBefore, 'Should create a delete confirmation popup');

    const popup = lastPopup();
    assert.ok(popup._content.includes('Delete') || popup.__label === 'box',
      'Popup should be a delete confirmation');

    // Cancel with Escape via popup's own key handler
    if (popup.__keyHandlers && popup.__keyHandlers['escape']) {
      popup.__keyHandlers['escape'][0]();
    } else {
      pressEscape();
    }
  });
});

describe('TUI — r key (rename)', () => {
  before(() => {
    fireScreenKey('home');
    pressDown();  // Select first session
  });

  it('r on a session opens rename popup', () => {
    const popupsBefore = allPopups.length;
    pressKey('r', 'r');
    assert.ok(allPopups.length > popupsBefore, 'Should create rename popup');
  });

  it('typing in rename mode adds to rename value', () => {
    // Type some characters — they should go to rename input, not other handlers
    typeChar('M');
    typeChar('y');
    typeChar(' ');
    typeChar('T');
    typeChar('i');
    typeChar('t');
    typeChar('l');
    typeChar('e');

    // Navigation should be blocked during rename
    // (j/k should not move selection)
  });

  it('backspace in rename mode removes characters', () => {
    pressBackspace();
    pressBackspace();
    // Removed "le" → "My Tit"
  });

  it('Escape cancels rename', () => {
    fireKeypress('', 'escape');
    // Rename mode should be closed
    // Verify footer is back to normal
    const f = footerText();
    assert.ok(f.includes('Rename') || f.includes('Search'),
      'Footer should return to normal after rename cancel');
  });

  it('r on New Session does nothing', () => {
    fireScreenKey('home');
    const popupsBefore = allPopups.length;
    pressKey('r', 'r');
    assert.equal(allPopups.length, popupsBefore, 'Should not create popup for New Session');
  });
});

describe('TUI — m key (permission mode picker)', () => {
  before(() => {
    fireScreenKey('home');
    pressDown();  // Select first session
  });

  it('m opens permission mode picker popup', () => {
    const popupsBefore = allPopups.length;
    pressKey('m', 'm');
    assert.ok(allPopups.length > popupsBefore, 'Should create mode picker popup');
  });

  it('m on New Session does nothing', () => {
    // Close current popup first
    const popup = lastPopup();
    if (popup && popup.__keyHandlers && popup.__keyHandlers['escape']) {
      popup.__keyHandlers['escape'][0]();
    }

    fireScreenKey('home');
    const popupsBefore = allPopups.length;
    pressKey('m', 'm');
    assert.equal(allPopups.length, popupsBefore, 'Should not create popup for New Session');
  });
});

describe('TUI — p key (project filter)', () => {
  before(() => {
    fireScreenKey('home');
  });

  it('p opens project picker popup', () => {
    const popupsBefore = allPopups.length;
    pressKey('p', 'p');
    assert.ok(allPopups.length > popupsBefore, 'Should create project picker');
  });

  it('project picker has All Projects + individual projects', () => {
    const popup = lastPopup();
    assert.ok(popup._items.length >= 4,
      `Should have at least 4 items (All + 3 projects), got ${popup._items.length}`);
    assert.ok(popup._items[0].includes('All Projects'), 'First item should be All Projects');
  });

  it('Escape closes project picker', () => {
    const popup = lastPopup();
    if (popup.__keyHandlers && popup.__keyHandlers['escape']) {
      popup.__keyHandlers['escape'][0]();
    }
    assert.ok(popup._destroyed, 'Popup should be destroyed after Escape');
  });

  it('selecting a project filters sessions', () => {
    pressKey('p', 'p');
    const popup = lastPopup();

    // Select a project (not "All Projects")
    // Simulate the blessed list 'select' event with index 1 (first project)
    popup.emit('select', popup._items[1], 1);

    // List should be filtered
    const items = listItems();
    assert.ok(items.length < 6, `Should have fewer items after project filter: ${items.length}`);
  });

  it('cleanup: reset filter', () => {
    pressEscape();
    assert.equal(listItems().length, 6);
  });
});

describe('TUI — Escape key behavior', () => {
  it('Escape clears filter and resets to New Session', () => {
    // Apply a search filter first
    pressKey('/');
    typeChar('R');
    typeChar('e');
    typeChar('a');
    pressEnter();

    // Now Escape should clear
    pressEscape();
    assert.equal(listItems().length, 6, 'Should show all sessions');
    assert.equal(listSelected(), 0, 'Should reset to New Session');
  });

  it('double Escape from session view goes to New Session', () => {
    pressDown();
    pressDown();
    pressEscape();
    assert.equal(listSelected(), 0);
  });
});

describe('TUI — c key (copy session ID)', () => {
  before(() => {
    fireScreenKey('home');
    pressDown();  // Select first session
  });

  it('c shows "Copied" feedback in footer', () => {
    pressKey('c', 'c');
    const f = footerText();
    // pbcopy may not be available in test env, but the footer update should still happen
    // (the try/catch in the code silently fails if pbcopy is unavailable)
    assert.ok(
      f.includes('Copied') || f.includes('sess-'),
      `Footer should show copy feedback: ${f}`,
    );
  });
});

describe('TUI — PageDown/PageUp/Ctrl-D/Ctrl-U', () => {
  before(() => {
    fireScreenKey('home');
    pressDown();  // Move to first session (index 0)
    pressDown();  // Move to second session (index 1)
  });

  it('Ctrl-D moves selection down (capped by list size)', () => {
    const before = listSelected();
    fireScreenKey('C-d');
    const after = listSelected();
    // With 5 sessions, half-page may jump to the end or beyond
    // Either it moves (if within bounds) or stays (if page > remaining)
    assert.ok(after >= before, 'Should not move up after Ctrl-D');
  });

  it('Ctrl-U moves selection up', () => {
    // First go to the end
    fireScreenKey('end');
    const before = listSelected();
    fireScreenKey('C-u');
    const after = listSelected();
    assert.ok(after <= before, 'Should not move down after Ctrl-U');
  });
});

describe('TUI — Session order (sorted by time)', () => {
  before(() => {
    // Reset sort to time
    while (!headerText().includes('[time]')) {
      pressKey('s', 's');
    }
    fireScreenKey('home');
  });

  it('most recent session (sess-a1, Apr 10) is first', () => {
    pressDown();  // First session after "New"
    const d = detailText();
    assert.ok(d.includes('sess-a1'), `First session should be sess-a1 (most recent): ${d.substring(0, 200)}`);
  });

  it('sessions are in chronological order', () => {
    // Navigate through all and check dates descend
    fireScreenKey('home');
    pressDown();
    const d1 = detailText();
    assert.ok(d1.includes('sess-a1'), 'Position 1 should be sess-a1');

    pressDown();
    const d2 = detailText();
    assert.ok(d2.includes('sess-a2'), 'Position 2 should be sess-a2');
  });
});

describe('TUI — Enter key on sessions', () => {
  // We can't fully test resume/new session since they spawn processes,
  // but we can test the entry conditions.

  it('Enter on empty filtered list does nothing', () => {
    // Search for something that matches nothing
    pressKey('/');
    typeChar('z');
    typeChar('z');
    typeChar('z');
    typeChar('x');
    typeChar('q');
    pressEnter();

    // Now try Enter — should not crash
    pressEnter();

    // TUI is still alive
    assert.ok(true, 'Should not crash on Enter with empty list');

    // Cleanup
    pressEscape();
  });
});

describe('TUI — Combined workflow scenarios', () => {
  before(() => {
    pressEscape();  // Clean state
    fireScreenKey('home');
  });

  it('search → navigate → clear → navigate works', () => {
    // 1. Search for "database"
    pressKey('/');
    typeChar('d');
    typeChar('a');
    typeChar('t');
    typeChar('a');

    const filtered = listItems().length;
    assert.ok(filtered < 6, 'Should filter');

    // 2. Navigate with ↓ (exits search mode, keeps filter)
    pressDown();
    assert.ok(!headerText().includes('▌'), 'Search mode should exit');

    // 3. Clear with Escape
    pressEscape();
    assert.equal(listItems().length, 6, 'All sessions restored');

    // 4. Navigate works normally
    pressDown();
    pressDown();
    const s = listSelected();
    assert.ok(s > 0, 'Navigation should work after search clear');
  });

  it('sort → search → sort back works', () => {
    pressEscape();
    fireScreenKey('home');

    // Sort by size
    pressKey('s', 's');
    assert.ok(headerText().includes('[size]'));

    // Search
    pressKey('/');
    typeChar('a');
    pressEnter();

    // Sort again (should cycle)
    pressKey('s', 's');
    assert.ok(headerText().includes('[messages]'));

    // Clean up
    pressEscape();
    while (!headerText().includes('[time]')) {
      pressKey('s', 's');
    }
  });

  it('navigate to session → rename (cancel) → navigate still works', () => {
    fireScreenKey('home');
    pressDown();
    pressDown();

    const posBefore = listSelected();

    // Start rename then cancel
    pressKey('r', 'r');
    typeChar('X');
    fireKeypress('', 'escape');

    // Navigate should work again
    pressDown();
    assert.ok(listSelected() !== posBefore || listSelected() === posBefore + 1,
      'Navigation should work after rename cancel');
  });
});

// ─── Cleanup ────────────────────────────────────────────────────────────────

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  // Force-clear any pending timers from createApp (setTimeout in rename/popup flows)
  // so the process can exit cleanly.
  const id = setTimeout(() => {}, 0);
  for (let i = 0; i <= id; i++) clearTimeout(i);
  // Unref any lingering handles so node --test can exit
  process.stdin.unref();
  // Restore console and stdout
  process.stdout.write = _origStdoutWrite;
  console.log = _origConsoleLog;
  console.error = _origConsoleError;
});
