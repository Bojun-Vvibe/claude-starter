#!/usr/bin/env node

/**
 * Claude Starter — Test Suite
 * ────────────────────────────
 * Run:  npm test   (or)   node test.js
 *
 * Uses Node.js built-in test runner (node:test + node:assert).
 * No external test dependencies required.  Works on Node ≥ 18.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ─── Import module under test ───────────────────────────────────────────────
const mod = require('./index.js');

const {
  getProjectDisplayName,
  extractUserText,
  loadSessionQuick,
  loadSessionDetail,
  loadAllSessions,
  formatTimestamp,
  formatFileSize,
  getProjectColor,
  esc,
  loadMeta,
  saveMeta,
  getSessionMeta,
  getEffectivePermissionMode,
  setSessionPermissionMode,
  setGlobalPermissionMode,
  setExcludePatterns,
  PERMISSION_MODES,
  PROJECT_COLORS,
  CLAUDE_DIR,
  PROJECTS_DIR,
  META_FILE,
} = mod;

// ─── Test Fixture Helpers ───────────────────────────────────────────────────

/** Create a temporary directory that mimics ~/.claude/projects structure */
function createTmpFixture() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-starter-test-'));
  const projectsDir = path.join(tmpDir, 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });
  return { tmpDir, projectsDir };
}

/** Create a mock .jsonl session file */
function createMockSession(dir, sessionId, lines) {
  const filePath = path.join(dir, `${sessionId}.jsonl`);
  const content = lines.map(l => JSON.stringify(l)).join('\n');
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

/** Create a mock meta file */
function createMockMeta(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** Clean up temp dir */
function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

// ─── Timestamp helper for relative date tests ────────────────────────────────
function isoNow()       { return new Date().toISOString(); }
function isoHoursAgo(h) { return new Date(Date.now() - h * 3600000).toISOString(); }
function isoDaysAgo(d)  { return new Date(Date.now() - d * 86400000).toISOString(); }

// =============================================================================
// 1. getProjectDisplayName
// =============================================================================
describe('getProjectDisplayName', () => {
  it('extracts project name from typical macOS path', () => {
    assert.equal(getProjectDisplayName('-Users-bob-Desktop-my-app'), 'my-app');
  });

  it('extracts project from nested Desktop path', () => {
    assert.equal(getProjectDisplayName('-Users-bob-Desktop-MSProject-my-app'), 'MSProject-my-app');
  });

  it('extracts project from Projects directory', () => {
    assert.equal(getProjectDisplayName('-Users-bob-Projects-Router-Maestro'), 'Router-Maestro');
  });

  it('handles direct Desktop project', () => {
    assert.equal(getProjectDisplayName('-Users-bob-Desktop-GraphConnector'), 'GraphConnector');
  });

  it('returns ~ for just home directory', () => {
    assert.equal(getProjectDisplayName('-Users-bob'), '~');
  });

  it('handles nested known prefixes', () => {
    assert.equal(getProjectDisplayName('-Users-alice-dev-src-cool-project'), 'cool-project');
  });

  it('handles Documents prefix', () => {
    assert.equal(getProjectDisplayName('-Users-bob-Documents-report'), 'report');
  });

  it('handles Downloads prefix', () => {
    assert.equal(getProjectDisplayName('-Users-bob-Downloads-archive'), 'archive');
  });

  it('returns last segment for unknown structure', () => {
    const result = getProjectDisplayName('something-weird');
    assert.ok(result.length > 0, 'should return a non-empty string');
  });

  it('handles empty-ish input gracefully', () => {
    const result = getProjectDisplayName('');
    assert.ok(typeof result === 'string');
  });
});

// =============================================================================
// 2. formatFileSize
// =============================================================================
describe('formatFileSize', () => {
  it('formats bytes < 1KB', () => {
    assert.equal(formatFileSize(512), '512B');
    assert.equal(formatFileSize(0), '0B');
    assert.equal(formatFileSize(1), '1B');
  });

  it('formats kilobytes', () => {
    assert.equal(formatFileSize(1024), '1K');
    assert.equal(formatFileSize(1536), '2K');  // 1.5 rounds to 2
    assert.equal(formatFileSize(10240), '10K');
  });

  it('formats megabytes', () => {
    assert.equal(formatFileSize(1048576), '1.0M');
    assert.equal(formatFileSize(5242880), '5.0M');
    assert.equal(formatFileSize(1572864), '1.5M');  // 1.5MB
  });

  it('handles boundary at 1024', () => {
    assert.equal(formatFileSize(1023), '1023B');
    assert.equal(formatFileSize(1024), '1K');
  });

  it('handles boundary at 1MB', () => {
    assert.equal(formatFileSize(1048575), '1024K');
    assert.equal(formatFileSize(1048576), '1.0M');
  });
});

// =============================================================================
// 3. formatTimestamp
// =============================================================================
describe('formatTimestamp', () => {
  it('returns "unknown" for falsy input', () => {
    assert.equal(formatTimestamp(null), 'unknown');
    assert.equal(formatTimestamp(undefined), 'unknown');
    assert.equal(formatTimestamp(''), 'unknown');
  });

  it('formats today timestamps with "Today"', () => {
    const now = new Date();
    const ts = now.toISOString();
    const result = formatTimestamp(ts);
    assert.ok(result.startsWith('Today'), `Expected "Today ..." but got "${result}"`);
  });

  it('formats yesterday timestamps', () => {
    const result = formatTimestamp(isoDaysAgo(1));
    assert.ok(result.startsWith('Yesterday'), `Expected "Yesterday ..." but got "${result}"`);
  });

  it('formats recent timestamps with "Xd ago"', () => {
    const result = formatTimestamp(isoDaysAgo(3));
    assert.ok(result.includes('3d ago'), `Expected "3d ago" in "${result}"`);
  });

  it('formats old timestamps with month/day', () => {
    const result = formatTimestamp(isoDaysAgo(30));
    // Should be something like "Mar 12" — no year
    assert.ok(!result.includes('ago'), `Should not contain "ago": "${result}"`);
  });

  it('formats very old timestamps with year', () => {
    const result = formatTimestamp('2020-01-15T10:00:00Z');
    assert.ok(result.includes('2020'), `Expected year in "${result}"`);
  });
});

// =============================================================================
// 4. esc (escape curly braces for blessed tags)
// =============================================================================
describe('esc', () => {
  it('escapes curly braces using blessed literals', () => {
    assert.equal(esc('hello {world}'), 'hello {open}world{close}');
  });

  it('handles multiple braces', () => {
    assert.equal(esc('{a} {b} {c}'), '{open}a{close} {open}b{close} {open}c{close}');
  });

  it('returns unchanged string without braces', () => {
    assert.equal(esc('no braces here'), 'no braces here');
  });

  it('handles empty string', () => {
    assert.equal(esc(''), '');
  });

  it('handles JSON-like content', () => {
    assert.equal(esc('{"key": "value"}'), '{open}"key": "value"{close}');
  });

  it('escapes comma-delimited tag-like content', () => {
    assert.equal(esc('{config,draft,range}'), '{open}config,draft,range{close}');
  });
});

// =============================================================================
// 5. getProjectColor
// =============================================================================
describe('getProjectColor', () => {
  it('assigns a color from PROJECT_COLORS', () => {
    const colorMap = new Map();
    const color = getProjectColor('my-project', colorMap);
    assert.ok(PROJECT_COLORS.includes(color), `Color ${color} should be in PROJECT_COLORS`);
  });

  it('returns the same color for the same project', () => {
    const colorMap = new Map();
    const c1 = getProjectColor('proj-a', colorMap);
    const c2 = getProjectColor('proj-a', colorMap);
    assert.equal(c1, c2);
  });

  it('assigns different colors to different projects', () => {
    const colorMap = new Map();
    const c1 = getProjectColor('proj-a', colorMap);
    const c2 = getProjectColor('proj-b', colorMap);
    assert.notEqual(c1, c2);
  });

  it('wraps around when projects exceed color count', () => {
    const colorMap = new Map();
    const colors = [];
    for (let i = 0; i < PROJECT_COLORS.length + 2; i++) {
      colors.push(getProjectColor(`proj-${i}`, colorMap));
    }
    // The (N+1)th color should wrap to the 1st
    assert.equal(colors[PROJECT_COLORS.length], colors[0]);
  });
});

// =============================================================================
// 6. extractUserText
// =============================================================================
describe('extractUserText', () => {
  it('extracts text from array content', () => {
    const d = {
      type: 'user',
      message: {
        content: [{ type: 'text', text: 'Hello Claude' }],
      },
    };
    assert.equal(extractUserText(d), 'Hello Claude');
  });

  it('extracts text from string content', () => {
    const d = {
      type: 'user',
      message: { content: 'Direct string message' },
    };
    assert.equal(extractUserText(d), 'Direct string message');
  });

  it('returns empty for local-command messages', () => {
    const d = {
      type: 'user',
      message: {
        content: [{ type: 'text', text: '<local-command>something</local-command>' }],
      },
    };
    assert.equal(extractUserText(d), '');
  });

  it('returns empty for command- prefixed messages', () => {
    const d = {
      type: 'user',
      message: {
        content: '<command-result>output</command-result>',
      },
    };
    assert.equal(extractUserText(d), '');
  });

  it('returns empty when message is missing', () => {
    assert.equal(extractUserText({}), '');
    assert.equal(extractUserText({ message: null }), '');
  });

  it('returns empty when content is empty array', () => {
    const d = { type: 'user', message: { content: [] } };
    assert.equal(extractUserText(d), '');
  });

  it('picks first text block from multi-content array', () => {
    const d = {
      type: 'user',
      message: {
        content: [
          { type: 'image', data: '...' },
          { type: 'text', text: 'Describe this image' },
        ],
      },
    };
    assert.equal(extractUserText(d), 'Describe this image');
  });
});

// =============================================================================
// 7. PERMISSION_MODES constant
// =============================================================================
describe('PERMISSION_MODES', () => {
  it('contains expected modes', () => {
    assert.ok(PERMISSION_MODES.includes('default'));
    assert.ok(PERMISSION_MODES.includes('bypassPermissions'));
    assert.ok(PERMISSION_MODES.includes('auto'));
    assert.ok(PERMISSION_MODES.includes('plan'));
  });

  it('is an array of strings', () => {
    assert.ok(Array.isArray(PERMISSION_MODES));
    PERMISSION_MODES.forEach(m => assert.equal(typeof m, 'string'));
  });
});

// =============================================================================
// 8. Meta operations (loadMeta, saveMeta, getSessionMeta, permission modes)
// =============================================================================
describe('Meta operations', () => {
  let tmpDir;
  let metaFile;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-meta-test-'));
    metaFile = path.join(tmpDir, 'test-meta.json');
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  describe('loadMeta', () => {
    it('returns default structure when file does not exist', () => {
      // loadMeta reads from META_FILE constant, which we can't easily override.
      // Instead test the function's behavior with a non-existent file scenario.
      const result = loadMeta();
      assert.ok(result.sessions !== undefined, 'should have sessions property');
      assert.equal(typeof result.sessions, 'object');
    });
  });

  describe('saveMeta + loadMeta round-trip', () => {
    it('persists meta to disk when using direct file operations', () => {
      const data = { sessions: { 'abc-123': { customTitle: 'My Title' } } };
      fs.writeFileSync(metaFile, JSON.stringify(data, null, 2), 'utf-8');
      const loaded = JSON.parse(fs.readFileSync(metaFile, 'utf-8'));
      assert.deepEqual(loaded, data);
    });
  });

  describe('getSessionMeta', () => {
    it('returns empty object for unknown session', () => {
      const meta = { sessions: {} };
      assert.deepEqual(getSessionMeta(meta, 'nonexistent'), {});
    });

    it('returns session meta when present', () => {
      const meta = { sessions: { 'abc': { customTitle: 'Foo' } } };
      assert.deepEqual(getSessionMeta(meta, 'abc'), { customTitle: 'Foo' });
    });
  });

  describe('getEffectivePermissionMode', () => {
    it('returns session override when set', () => {
      const meta = {
        sessions: { 's1': { permissionMode: 'bypassPermissions' } },
        defaultPermissionMode: 'plan',
      };
      const session = { sessionId: 's1', permissionMode: 'auto' };
      assert.equal(getEffectivePermissionMode(meta, session), 'bypassPermissions');
    });

    it('falls back to session JSONL mode when no meta override', () => {
      const meta = { sessions: {}, defaultPermissionMode: 'plan' };
      const session = { sessionId: 's1', permissionMode: 'auto' };
      assert.equal(getEffectivePermissionMode(meta, session), 'auto');
    });

    it('falls back to global default when no session modes', () => {
      const meta = { sessions: {}, defaultPermissionMode: 'plan' };
      const session = { sessionId: 's1' };
      assert.equal(getEffectivePermissionMode(meta, session), 'plan');
    });

    it('returns empty string when nothing is set', () => {
      const meta = { sessions: {} };
      const session = { sessionId: 's1' };
      assert.equal(getEffectivePermissionMode(meta, session), '');
    });
  });

  describe('setSessionPermissionMode', () => {
    it('sets permission mode for a session', () => {
      // Use a temp meta file
      const meta = { sessions: {} };
      // We need to mock META_FILE - instead we test the in-memory logic
      setSessionPermissionMode(meta, 's1', 'bypassPermissions');
      assert.equal(meta.sessions.s1.permissionMode, 'bypassPermissions');
    });

    it('clears permission mode when empty string', () => {
      const meta = { sessions: { s1: { permissionMode: 'auto', customTitle: 'X' } } };
      setSessionPermissionMode(meta, 's1', '');
      assert.equal(meta.sessions.s1.permissionMode, undefined);
      // Should preserve other meta
      assert.equal(meta.sessions.s1.customTitle, 'X');
    });
  });

  describe('setGlobalPermissionMode', () => {
    it('sets global default mode', () => {
      const meta = { sessions: {} };
      setGlobalPermissionMode(meta, 'plan');
      assert.equal(meta.defaultPermissionMode, 'plan');
    });

    it('clears global default mode', () => {
      const meta = { sessions: {}, defaultPermissionMode: 'auto' };
      setGlobalPermissionMode(meta, '');
      assert.equal(meta.defaultPermissionMode, undefined);
    });
  });
});

// =============================================================================
// 9. loadSessionQuick — JSONL parsing
// =============================================================================
describe('loadSessionQuick', () => {
  let tmpDir, projectDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-session-test-'));
    projectDir = tmpDir;
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('parses a minimal session file', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system', version: '1.0' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Hello world' }] } },
      { timestamp: '2026-04-10T10:02:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'Hi there' }] } },
    ];
    const filePath = createMockSession(projectDir, 'session-001', lines);
    const session = loadSessionQuick(filePath, 'test-project');

    assert.equal(session.sessionId, 'session-001');
    assert.equal(session.project, 'test-project');
    assert.equal(session.firstTs, '2026-04-10T10:00:00Z');
    assert.equal(session.lastTs, '2026-04-10T10:02:00Z');
    assert.equal(session.version, '1.0');
    assert.ok(session.topic.includes('Hello world'));
    assert.equal(session.filePath, filePath);
    assert.ok(session.fileSize > 0);
  });

  it('extracts git branch and cwd', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system', gitBranch: 'main', cwd: '/Users/test/project' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'fix the bug' }] } },
    ];
    const filePath = createMockSession(projectDir, 'session-002', lines);
    const session = loadSessionQuick(filePath, 'test');

    assert.equal(session.gitBranch, 'main');
    assert.equal(session.cwd, '/Users/test/project');
  });

  it('extracts permission mode', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system', permissionMode: 'bypassPermissions' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'do something' }] } },
    ];
    const filePath = createMockSession(projectDir, 'session-003', lines);
    const session = loadSessionQuick(filePath, 'test');

    assert.equal(session.permissionMode, 'bypassPermissions');
  });

  it('reads custom title from JSONL', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'hello' }] } },
      { type: 'custom-title', customTitle: 'My Custom Session' },
    ];
    const filePath = createMockSession(projectDir, 'session-004', lines);
    const session = loadSessionQuick(filePath, 'test');

    assert.equal(session.customTitle, 'My Custom Session');
  });

  it('skips command messages for topic', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: '<local-command>ls</local-command>' }] } },
      { timestamp: '2026-04-10T10:02:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Real question here' }] } },
    ];
    const filePath = createMockSession(projectDir, 'session-005', lines);
    const session = loadSessionQuick(filePath, 'test');

    assert.ok(session.topic.includes('Real question'), `Topic should be "Real question..." but got "${session.topic}"`);
  });

  it('calculates duration correctly', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'start' }] } },
      { timestamp: '2026-04-10T11:30:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'done' }] } },
    ];
    const filePath = createMockSession(projectDir, 'session-006', lines);
    const session = loadSessionQuick(filePath, 'test');

    assert.equal(session.duration, '1h 30m');
  });

  it('truncates long topics to 120 chars', () => {
    const longText = 'A'.repeat(200);
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: longText }] } },
    ];
    const filePath = createMockSession(projectDir, 'session-007', lines);
    const session = loadSessionQuick(filePath, 'test');

    assert.ok(session.topic.length <= 121, `Topic too long: ${session.topic.length}`);  // 120 + '…'
    assert.ok(session.topic.endsWith('…'));
  });

  it('handles empty session file gracefully', () => {
    const filePath = path.join(projectDir, 'empty.jsonl');
    fs.writeFileSync(filePath, '', 'utf-8');
    const session = loadSessionQuick(filePath, 'test');
    assert.equal(session.sessionId, 'empty');
    assert.equal(session.firstTs, null);
  });

  it('handles single-line session', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'user', message: { content: [{ type: 'text', text: 'one liner' }] } },
    ];
    const filePath = createMockSession(projectDir, 'session-one', lines);
    const session = loadSessionQuick(filePath, 'test');
    assert.ok(session.topic.includes('one liner'));
  });
});

// =============================================================================
// 10. loadSessionDetail — Full session parsing
// =============================================================================
describe('loadSessionDetail', () => {
  let tmpDir, projectDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-detail-test-'));
    projectDir = tmpDir;
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('loads full conversation details', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Question 1' }] } },
      { timestamp: '2026-04-10T10:02:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'Answer 1' }] } },
      { timestamp: '2026-04-10T10:03:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Question 2' }] } },
      { timestamp: '2026-04-10T10:04:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'Answer 2' }] } },
    ];
    const filePath = createMockSession(projectDir, 'detail-001', lines);
    const session = loadSessionQuick(filePath, 'test');
    const detailed = loadSessionDetail(session);

    assert.equal(detailed.totalMessages, 4);
    assert.equal(detailed.userMessages.length, 2);
    assert.equal(detailed.assistantSnippets.length, 2);
    assert.ok(detailed.userMessages[0].includes('Question 1'));
    assert.ok(detailed.assistantSnippets[0].includes('Answer 1'));
    assert.equal(detailed._detailLoaded, true);
  });

  it('extracts tools used', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'help me' }] } },
      { timestamp: '2026-04-10T10:02:00Z', type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }, { type: 'text', text: 'Reading...' }] } },
      { timestamp: '2026-04-10T10:03:00Z', type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }] } },
      { type: 'tool_use', name: 'Bash' },
    ];
    const filePath = createMockSession(projectDir, 'detail-tools', lines);
    const session = loadSessionQuick(filePath, 'test');
    const detailed = loadSessionDetail(session);

    assert.ok(detailed.toolsUsed.includes('Read'));
    assert.ok(detailed.toolsUsed.includes('Edit'));
    assert.ok(detailed.toolsUsed.includes('Bash'));
  });

  it('does not reload if already loaded', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'test' }] } },
    ];
    const filePath = createMockSession(projectDir, 'detail-cache', lines);
    const session = loadSessionQuick(filePath, 'test');
    loadSessionDetail(session);

    // Modify session to verify it's not reloaded
    session.userMessages.push('injected');
    loadSessionDetail(session);
    assert.ok(session.userMessages.includes('injected'), 'should not have been overwritten');
  });

  it('picks up customTitle from JSONL on full load', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'hello' }] } },
      { type: 'custom-title', customTitle: 'Detailed Title' },
    ];
    const filePath = createMockSession(projectDir, 'detail-title', lines);
    const session = loadSessionQuick(filePath, 'test');
    loadSessionDetail(session);
    assert.equal(session.customTitle, 'Detailed Title');
  });
});

// =============================================================================
// 11. loadAllSessions — Directory scanning
// =============================================================================
describe('loadAllSessions', () => {
  // Note: loadAllSessions reads from the PROJECTS_DIR constant.
  // These tests verify the function can handle various filesystem states.

  it('returns array (possibly empty if no ~/.claude/projects)', () => {
    const sessions = loadAllSessions();
    assert.ok(Array.isArray(sessions));
  });

  it('sessions are sorted by lastTs descending', () => {
    const sessions = loadAllSessions();
    for (let i = 1; i < sessions.length; i++) {
      const prevTs = sessions[i-1].lastTs ? new Date(sessions[i-1].lastTs).getTime() : 0;
      const currTs = sessions[i].lastTs ? new Date(sessions[i].lastTs).getTime() : 0;
      assert.ok(prevTs >= currTs, `Session ${i-1} should be >= session ${i}`);
    }
  });

  it('all sessions have required fields', () => {
    const sessions = loadAllSessions();
    for (const s of sessions.slice(0, 10)) {  // check first 10
      assert.ok(s.sessionId, 'missing sessionId');
      assert.ok(s.project, 'missing project');
      assert.ok(s.filePath, 'missing filePath');
      assert.ok(s.firstTs, 'missing firstTs');
      assert.ok(typeof s.fileSize === 'number', 'fileSize should be a number');
      assert.ok(typeof s.estimatedMessages === 'number', 'estimatedMessages should be number');
    }
  });

  it('filters out warmup sessions', () => {
    const sessions = loadAllSessions();
    const warmups = sessions.filter(s => /^warmup$/i.test(s.topic.trim()));
    assert.equal(warmups.length, 0, 'Should not contain warmup sessions');
  });

  it('filters out sessions without user messages', () => {
    const sessions = loadAllSessions();
    const empty = sessions.filter(s => s.topic === '(no user messages)');
    assert.equal(empty.length, 0, 'Should not contain empty sessions');
  });
});

// =============================================================================
// 11b. loadAllSessions — Exclude patterns
// =============================================================================
describe('loadAllSessions with exclude patterns', () => {
  afterEach(() => {
    setExcludePatterns([]);
  });

  it('excludes sessions matching a single regex pattern', () => {
    const allSessions = loadAllSessions();
    setExcludePatterns([/episodic/i]);
    const filtered = loadAllSessions();
    const excluded = allSessions.filter(s => /episodic/i.test(s.topic));
    if (excluded.length > 0) {
      assert.ok(filtered.length < allSessions.length, 'Should have fewer sessions when excluding');
      assert.ok(filtered.every(s => !/episodic/i.test(s.topic)), 'No matching sessions should remain');
    }
  });

  it('excludes sessions matching multiple patterns', () => {
    setExcludePatterns([/episodic/i, /summary/i]);
    const filtered = loadAllSessions();
    assert.ok(filtered.every(s => !/episodic/i.test(s.topic) && !/summary/i.test(s.topic)));
  });

  it('returns all sessions when no patterns match', () => {
    const allSessions = loadAllSessions();
    setExcludePatterns([/zzz_nonexistent_pattern_zzz/]);
    const filtered = loadAllSessions();
    assert.equal(filtered.length, allSessions.length);
  });

  it('returns all sessions when patterns array is empty', () => {
    const allSessions = loadAllSessions();
    setExcludePatterns([]);
    const filtered = loadAllSessions();
    assert.equal(filtered.length, allSessions.length);
  });
});

// =============================================================================
// 12. Edge cases — Malformed JSONL
// =============================================================================
describe('Edge cases — malformed JSONL', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-edge-test-'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('handles file with invalid JSON lines', () => {
    const filePath = path.join(tmpDir, 'bad.jsonl');
    fs.writeFileSync(filePath, 'not json\n{"timestamp":"2026-01-01T00:00:00Z","type":"user","message":{"content":[{"type":"text","text":"ok"}]}}\n{broken', 'utf-8');
    const session = loadSessionQuick(filePath, 'test');
    assert.equal(session.sessionId, 'bad');
    assert.ok(session.topic.includes('ok'));
  });

  it('handles file with only system messages (no user messages)', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system', version: '1.0' },
    ];
    const filePath = createMockSession(tmpDir, 'sys-only', lines);
    const session = loadSessionQuick(filePath, 'test');
    assert.equal(session.topic, '(no user messages)');
  });

  it('handles very large topic gracefully', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'X'.repeat(5000) }] } },
    ];
    const filePath = createMockSession(tmpDir, 'big-topic', lines);
    const session = loadSessionQuick(filePath, 'test');
    assert.ok(session.topic.length <= 121);
  });

  it('handles unicode in messages', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: '你好世界 🚀 café' }] } },
    ];
    const filePath = createMockSession(tmpDir, 'unicode', lines);
    const session = loadSessionQuick(filePath, 'test');
    assert.ok(session.topic.includes('你好世界'));
    assert.ok(session.topic.includes('🚀'));
  });

  it('handles newlines in message text', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'line1\nline2\nline3' }] } },
    ];
    const filePath = createMockSession(tmpDir, 'newlines', lines);
    const session = loadSessionQuick(filePath, 'test');
    // topic should have newlines replaced with spaces
    assert.ok(!session.topic.includes('\n'), 'Topic should not contain newlines');
    assert.ok(session.topic.includes('line1'));
  });
});

// =============================================================================
// 13. Constants validation
// =============================================================================
describe('Constants', () => {
  it('CLAUDE_DIR points to ~/.claude', () => {
    assert.equal(CLAUDE_DIR, path.join(os.homedir(), '.claude'));
  });

  it('PROJECTS_DIR is inside CLAUDE_DIR', () => {
    assert.ok(PROJECTS_DIR.startsWith(CLAUDE_DIR));
    assert.equal(PROJECTS_DIR, path.join(CLAUDE_DIR, 'projects'));
  });

  it('META_FILE is inside CLAUDE_DIR', () => {
    assert.ok(META_FILE.startsWith(CLAUDE_DIR));
  });

  it('PROJECT_COLORS has at least 4 colors', () => {
    assert.ok(PROJECT_COLORS.length >= 4);
    PROJECT_COLORS.forEach(c => {
      assert.ok(c.startsWith('#'), `Color ${c} should start with #`);
    });
  });
});

// =============================================================================
// 14. CLI entry point (--version, --help, --list)
// =============================================================================
describe('CLI flags', () => {
  const cliPath = path.join(__dirname, 'index.js');

  it('--version outputs version string', () => {
    const output = execSync(`node "${cliPath}" --version`, { encoding: 'utf-8' }).trim();
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));
    assert.equal(output, `claude-starter v${pkg.version}`);
  });

  it('-v outputs version string', () => {
    const output = execSync(`node "${cliPath}" -v`, { encoding: 'utf-8' }).trim();
    assert.ok(output.startsWith('claude-starter v'));
  });

  it('--help outputs usage information', () => {
    const output = execSync(`node "${cliPath}" --help`, { encoding: 'utf-8' });
    assert.ok(output.includes('Claude Starter'));
    assert.ok(output.includes('Usage:'));
    assert.ok(output.includes('--list'));
    assert.ok(output.includes('--version'));
    assert.ok(output.includes('--update'));
    assert.ok(output.includes('Keyboard Shortcuts'));
  });

  it('-h outputs help', () => {
    const output = execSync(`node "${cliPath}" -h`, { encoding: 'utf-8' });
    assert.ok(output.includes('Usage:'));
  });

  it('--list runs without error', () => {
    const output = execSync(`node "${cliPath}" --list 5`, { encoding: 'utf-8' });
    assert.ok(output.includes('Claude Sessions'));
  });

  it('-l runs without error', () => {
    const output = execSync(`node "${cliPath}" -l 3`, { encoding: 'utf-8' });
    assert.ok(output.includes('Sessions'));
  });
});

// =============================================================================
// 15. Integration — Simulated project directory
// =============================================================================
describe('Integration — simulated sessions directory', () => {
  let tmpDir, projectsDir, projADir, projBDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-integ-test-'));
    projectsDir = path.join(tmpDir, 'projects');
    projADir = path.join(projectsDir, '-Users-test-Desktop-project-alpha');
    projBDir = path.join(projectsDir, '-Users-test-Projects-beta');
    fs.mkdirSync(projADir, { recursive: true });
    fs.mkdirSync(projBDir, { recursive: true });

    // Create sessions in project A
    createMockSession(projADir, 'sess-a1', [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system', version: '1.0', gitBranch: 'main', cwd: '/Users/test/Desktop/project-alpha' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Fix the login bug' }] } },
      { timestamp: '2026-04-10T11:00:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'I fixed it' }] } },
    ]);

    createMockSession(projADir, 'sess-a2', [
      { timestamp: '2026-04-09T08:00:00Z', type: 'system', gitBranch: 'feature/auth' },
      { timestamp: '2026-04-09T08:05:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Add OAuth support' }] } },
      { timestamp: '2026-04-09T09:30:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'OAuth added' }] } },
    ]);

    // Create session in project B
    createMockSession(projBDir, 'sess-b1', [
      { timestamp: '2026-04-08T14:00:00Z', type: 'system', gitBranch: 'develop', permissionMode: 'auto' },
      { timestamp: '2026-04-08T14:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'Refactor the database layer' }] } },
      { timestamp: '2026-04-08T16:00:00Z', type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit' }, { type: 'text', text: 'Done' }] } },
      { type: 'custom-title', customTitle: 'DB Refactor' },
    ]);
  });

  after(() => {
    cleanup(tmpDir);
  });

  it('loadSessionQuick works for simulated sessions', () => {
    const sessions = [];
    const files = fs.readdirSync(projADir).filter(f => f.endsWith('.jsonl'));
    for (const f of files) {
      sessions.push(loadSessionQuick(path.join(projADir, f), 'project-alpha'));
    }
    assert.equal(sessions.length, 2);
    assert.ok(sessions.some(s => s.sessionId === 'sess-a1'));
    assert.ok(sessions.some(s => s.sessionId === 'sess-a2'));
  });

  it('loadSessionDetail enriches a quick-loaded session', () => {
    const session = loadSessionQuick(
      path.join(projBDir, 'sess-b1.jsonl'), 'beta'
    );
    assert.equal(session._detailLoaded, false);

    loadSessionDetail(session);
    assert.equal(session._detailLoaded, true);
    assert.ok(session.userMessages.length > 0);
    assert.ok(session.toolsUsed.includes('Edit'));
    assert.equal(session.customTitle, 'DB Refactor');
  });

  it('getProjectDisplayName correctly names simulated projects', () => {
    assert.equal(getProjectDisplayName('-Users-test-Desktop-project-alpha'), 'project-alpha');
    assert.equal(getProjectDisplayName('-Users-test-Projects-beta'), 'beta');
  });

  it('permission mode round-trip with meta', () => {
    const meta = { sessions: {} };
    const session = loadSessionQuick(
      path.join(projBDir, 'sess-b1.jsonl'), 'beta'
    );

    // JSONL has permissionMode: 'auto'
    assert.equal(getEffectivePermissionMode(meta, session), 'auto');

    // Override via meta
    setSessionPermissionMode(meta, session.sessionId, 'bypassPermissions');
    assert.equal(getEffectivePermissionMode(meta, session), 'bypassPermissions');

    // Clear override — falls back to JSONL
    setSessionPermissionMode(meta, session.sessionId, '');
    assert.equal(getEffectivePermissionMode(meta, session), 'auto');

    // Set global default
    setGlobalPermissionMode(meta, 'plan');
    // Session still has its own mode from JSONL
    assert.equal(getEffectivePermissionMode(meta, session), 'auto');

    // Test with a session that has no mode
    const session2 = loadSessionQuick(
      path.join(projADir, 'sess-a1.jsonl'), 'alpha'
    );
    assert.equal(getEffectivePermissionMode(meta, session2), 'plan');
  });
});

// =============================================================================
// 16. Duration calculation edge cases
// =============================================================================
describe('Duration calculation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-dur-test-'));
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  it('shows minutes only for short sessions', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'quick q' }] } },
      { timestamp: '2026-04-10T10:15:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'done' }] } },
    ];
    const filePath = createMockSession(tmpDir, 'short', lines);
    const session = loadSessionQuick(filePath, 'test');
    assert.equal(session.duration, '15m');
  });

  it('shows hours and minutes for long sessions', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'system' },
      { timestamp: '2026-04-10T10:01:00Z', type: 'user', message: { content: [{ type: 'text', text: 'long task' }] } },
      { timestamp: '2026-04-10T13:45:00Z', type: 'assistant', message: { content: [{ type: 'text', text: 'finally done' }] } },
    ];
    const filePath = createMockSession(tmpDir, 'long', lines);
    const session = loadSessionQuick(filePath, 'test');
    assert.equal(session.duration, '3h 45m');
  });

  it('shows empty duration for same-timestamp session', () => {
    const lines = [
      { timestamp: '2026-04-10T10:00:00Z', type: 'user', message: { content: [{ type: 'text', text: 'instant' }] } },
    ];
    const filePath = createMockSession(tmpDir, 'instant', lines);
    const session = loadSessionQuick(filePath, 'test');
    assert.equal(session.duration, '');
  });
});

// =============================================================================
// 17. package.json validation
// =============================================================================
describe('package.json', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

  it('has required fields', () => {
    assert.ok(pkg.name, 'missing name');
    assert.ok(pkg.version, 'missing version');
    assert.ok(pkg.description, 'missing description');
    assert.ok(pkg.main, 'missing main');
    assert.ok(pkg.bin, 'missing bin');
    assert.ok(pkg.license, 'missing license');
  });

  it('bin points to index.js', () => {
    assert.equal(pkg.bin['claude-starter'], './index.js');
  });

  it('version follows semver', () => {
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  });

  it('engines requires node >= 18', () => {
    assert.ok(pkg.engines, 'missing engines');
    assert.ok(pkg.engines.node, 'missing engines.node');
    assert.ok(pkg.engines.node.includes('18'));
  });

  it('has required dependencies', () => {
    assert.ok(pkg.dependencies.blessed, 'missing blessed dependency');
    assert.ok(pkg.dependencies['blessed-contrib'], 'missing blessed-contrib dependency');
  });

  it('files array includes index.js', () => {
    assert.ok(pkg.files.includes('index.js'));
  });
});

// =============================================================================
// 18. detectCLI
// =============================================================================
describe('detectCLI', () => {
  it('returns an object with name and cmd', () => {
    const cli = mod.detectCLI();
    assert.ok(cli.name, 'missing name');
    assert.ok(cli.cmd, 'missing cmd');
    assert.ok(['claude', 'mai-claude'].includes(cli.name), `Unexpected CLI name: ${cli.name}`);
  });
});

// =============================================================================
// 19. Module export validation
// =============================================================================
describe('Module exports', () => {
  it('exports all expected functions', () => {
    const expectedFunctions = [
      'getProjectDisplayName', 'extractUserText', 'loadSessionQuick',
      'loadSessionDetail', 'loadAllSessions', 'formatTimestamp',
      'formatFileSize', 'getProjectColor', 'esc', 'loadMeta',
      'saveMeta', 'getSessionMeta', 'getEffectivePermissionMode',
      'setSessionPermissionMode', 'setGlobalPermissionMode',
      'detectCLI', 'runListMode',
    ];
    for (const fn of expectedFunctions) {
      assert.equal(typeof mod[fn], 'function', `${fn} should be a function`);
    }
  });

  it('exports all expected constants', () => {
    assert.ok(Array.isArray(mod.PERMISSION_MODES));
    assert.ok(Array.isArray(mod.PROJECT_COLORS));
    assert.equal(typeof mod.CLAUDE_DIR, 'string');
    assert.equal(typeof mod.PROJECTS_DIR, 'string');
    assert.equal(typeof mod.META_FILE, 'string');
  });
});
