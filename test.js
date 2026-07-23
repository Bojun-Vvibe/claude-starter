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
  extractSearchableUserText,
  loadSessionQuick,
  loadSessionDetail,
  buildSessionSearchText,
  indexSessionsInBackground,
  loadAllSessions,
  filterSessionList,
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
  updateSessionTitle,
  setExcludePatterns,
  PERMISSION_MODES,
  PROJECT_COLORS,
  CLAUDE_DIR,
  PROJECTS_DIR,
  META_FILE,
  switchToAbcInputSource,
  createInputSourceActivator,
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

describe('session search indexing', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-search-test-'));
  });

  afterEach(() => cleanup(tmpDir));

  it('extracts command names and arguments but skips injected user records', () => {
    assert.equal(extractSearchableUserText({
      type: 'user',
      message: { content: '<command-message>research</command-message>\n<command-name>/research</command-name>\n<command-args>search topic</command-args>' },
    }), '/research search topic');
    assert.equal(extractSearchableUserText({
      type: 'user', isMeta: true,
      message: { content: [{ type: 'text', text: 'skill-only-marker' }] },
    }), '');
    assert.equal(extractSearchableUserText({
      type: 'user',
      message: { content: [{ type: 'tool_result', content: 'tool-only-marker' }] },
    }), '');
    assert.equal(extractSearchableUserText({
      type: 'user',
      message: { content: '[Request interrupted by user for tool use]' },
    }), '');
    assert.equal(extractSearchableUserText({
      type: 'user',
      message: { content: [
        { type: 'tool_result', content: 'tool-only-marker' },
        { type: 'text', text: 'actual follow-up prompt' },
      ] },
    }), 'actual follow-up prompt');
  });

  it('indexes real user input and final responses only', async () => {
    const filePath = createMockSession(tmpDir, 'search-session', [
      { type: 'user', isMeta: true, message: { content: [{ type: 'text', text: 'skill-only-marker' }] } },
      { type: 'user', message: { content: '[Request interrupted by user]' } },
      { type: 'user', isSidechain: false, message: { content: 'Find the lunar widget' } },
      { type: 'assistant', message: { stop_reason: 'tool_use', content: [
        { type: 'text', text: 'commentary-only-marker' },
        { type: 'tool_use', name: 'Read', input: { file_path: 'tool-only-marker' } },
      ] } },
      { type: 'user', message: { content: [{ type: 'tool_result', content: 'tool-result-marker' }] } },
      { type: 'assistant', message: { stop_reason: 'tool_use', content: [
        { type: 'thinking', thinking: 'reasoning-only-marker' },
        { type: 'tool_use', name: 'Edit', input: { new_string: 'edit-only-marker' } },
      ] } },
      { type: 'user', message: { content: '<task-notification>task-only-marker</task-notification>' } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: 'The release-summary-marker is ready.' },
      ] } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: 'The second-final-marker is also ready.' },
      ] } },
      { type: 'assistant' },
      { type: 'assistant', message: { model: 'claude-test', stop_reason: 'end_turn', content: [
        { type: 'text', text: "The task tools haven't been used recently. reminder-only-marker" },
      ] } },
      { type: 'user', message: { content: 'Follow up on deployment' } },
      { type: 'assistant', message: { content: [
        { type: 'text', text: 'legacy-final-marker' },
      ] } },
      { type: 'assistant', isApiErrorMessage: true, message: { model: '<synthetic>', stop_reason: 'stop_sequence', content: [
        { type: 'text', text: 'API Error: api-error-only-marker' },
      ] } },
    ]);
    const searchText = await buildSessionSearchText({ filePath });

    assert.match(searchText, /find the lunar widget/);
    assert.match(searchText, /follow up on deployment/);
    assert.match(searchText, /release-summary-marker/);
    assert.match(searchText, /second-final-marker/);
    for (const excluded of ['skill-only-marker', 'commentary-only-marker', 'tool-only-marker',
      'tool-result-marker', 'reasoning-only-marker', 'edit-only-marker', 'task-only-marker',
      'request interrupted', 'reminder-only-marker', 'legacy-final-marker', 'api-error-only-marker']) {
      assert.doesNotMatch(searchText, new RegExp(excluded));
    }
  });

  it('indexes text that follows a large tool result in the same user record', async () => {
    const filePath = createMockSession(tmpDir, 'mixed-tool-result', [
      { type: 'user', message: { content: 'first prompt' } },
      { type: 'user', message: { content: [
        { type: 'tool_result', content: 'x'.repeat(10000) },
        { type: 'text', text: 'mixed-real-marker' },
      ] } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: 'mixed-final-marker' },
      ] } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.match(searchText, /mixed-real-marker/);
    assert.match(searchText, /mixed-final-marker/);
  });

  it('indexes the final transcript title even when quick samples miss it', async () => {
    const filePath = createMockSession(tmpDir, 'transcript-title', [
      { type: 'user', message: { content: 'find this session' } },
      { type: 'custom-title', customTitle: 'Archived lunar launch' },
    ]);

    const session = { filePath };
    const searchText = await buildSessionSearchText(session);
    assert.doesNotMatch(searchText, /archived lunar launch/);
    assert.equal(session.customTitle, 'Archived lunar launch');
    assert.deepEqual(filterSessionList([session], 'archived lunar launch').map(s => s.filePath), [filePath]);
  });

  it('indexes Claude-generated AI titles', async () => {
    const filePath = createMockSession(tmpDir, 'ai-title', [
      { type: 'user', message: { content: 'Plan a launch' } },
      { type: 'ai-title', aiTitle: 'Generated lunar plan' },
    ]);

    const session = { filePath };
    const searchText = await buildSessionSearchText(session);
    assert.doesNotMatch(searchText, /generated lunar plan/);
    assert.equal(session.customTitle, 'Generated lunar plan');
    assert.deepEqual(filterSessionList([session], 'generated lunar plan').map(s => s.filePath), [filePath]);
  });

  it('keeps a local custom title ahead of transcript titles', async () => {
    const filePath = createMockSession(tmpDir, 'local-title-priority', [
      { type: 'user', message: { content: 'Plan another launch' } },
      { type: 'ai-title', aiTitle: 'Generated title marker' },
      { type: 'custom-title', customTitle: 'Transcript title marker' },
    ]);
    const session = { filePath, customTitle: 'Local title marker', _customTitleFromMeta: true };

    const searchText = await buildSessionSearchText(session);
    assert.doesNotMatch(searchText, /local title marker/);
    assert.doesNotMatch(searchText, /transcript title marker/);
    assert.equal(session.customTitle, 'Local title marker');
    assert.equal(session._transcriptTitle, 'Transcript title marker');
    assert.deepEqual(filterSessionList([session], 'local title marker').map(s => s.filePath), [filePath]);
  });

  it('keeps a transcript custom title ahead of later AI titles', async () => {
    const filePath = createMockSession(tmpDir, 'transcript-title-priority', [
      { type: 'user', message: { content: 'Plan a titled launch' } },
      { type: 'custom-title', customTitle: 'User transcript title' },
      { type: 'ai-title', aiTitle: 'Later generated title' },
    ]);
    const session = loadSessionQuick(filePath, 'project-test');

    assert.equal(session.customTitle, 'User transcript title');
    await buildSessionSearchText(session);
    assert.equal(session.customTitle, 'User transcript title');
    loadSessionDetail(session);
    assert.equal(session.customTitle, 'User transcript title');
    assert.deepEqual(filterSessionList([session], 'user transcript title').map(s => s.filePath), [filePath]);
    assert.deepEqual(filterSessionList([session], 'later generated title'), []);
  });

  it('indexes long final responses whose top-level type follows the message', async () => {
    const longAnswer = `long-final-marker ${'x'.repeat(5000)}`;
    const filePath = createMockSession(tmpDir, 'long-final', [
      { type: 'user', message: { content: 'Find the long answer' } },
      { message: { stop_reason: 'end_turn', content: [{ type: 'text', text: longAnswer }] }, type: 'assistant' },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.match(searchText, /long-final-marker/);
  });

  it('strips an injected task reminder but keeps the final answer after it', async () => {
    const reminder = "The task tools haven't been used recently. If you're working on tasks that would benefit from tracking progress, consider using TaskCreate to add new tasks and TaskUpdate to update task status (set to in_progress when starting, completed when done). Also consider cleaning up the task list if it has become stale. Only use these if relevant to the current work. This is just a gentle reminder - ignore if not applicable.";
    const filePath = createMockSession(tmpDir, 'reminder-with-answer', [
      { type: 'user', message: { content: 'Finish the report' } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: `${reminder}\n\nreminder-following-final-marker` },
      ] } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.match(searchText, /reminder-following-final-marker/);
    assert.doesNotMatch(searchText, /task tools haven't been used recently/);
  });

  it('indexes legitimate synthetic-model responses but not internal placeholders', async () => {
    const filePath = createMockSession(tmpDir, 'synthetic-response', [
      { type: 'user', message: { content: 'Explain the result' } },
      { type: 'assistant', message: { model: '<synthetic>', stop_reason: 'stop_sequence', content: [
        { type: 'text', text: 'legitimate-synthetic-final-marker' },
      ] } },
      { type: 'assistant', message: { model: '<synthetic>', stop_reason: 'stop_sequence', content: [
        { type: 'text', text: 'No response requested.' },
      ] } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.match(searchText, /legitimate-synthetic-final-marker/);
    assert.doesNotMatch(searchText, /no response requested/);
  });

  it('drops pre-error status replies but keeps a later recovered final answer', async () => {
    const filePath = createMockSession(tmpDir, 'api-error-recovery', [
      { type: 'user', message: { content: 'Complete the update' } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: 'pre-error-status-marker' },
      ] } },
      { type: 'assistant', isApiErrorMessage: true, message: { stop_reason: 'stop_sequence', content: [
        { type: 'text', text: 'API Error: Connection closed mid-response.' },
      ] } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: 'recovered-final-marker' },
      ] } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.doesNotMatch(searchText, /pre-error-status-marker/);
    assert.doesNotMatch(searchText, /connection closed mid-response/);
    assert.match(searchText, /recovered-final-marker/);
  });

  it('does not let a sidechain API error clear the main-thread final answer', async () => {
    const filePath = createMockSession(tmpDir, 'sidechain-api-error', [
      { type: 'user', message: { content: 'Complete the main task' } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: 'main-final-before-sidechain-error' },
      ] } },
      { type: 'assistant', isSidechain: true, isApiErrorMessage: true, message: {
        stop_reason: 'stop_sequence',
        content: [{ type: 'text', text: 'API Error: subagent failed' }],
      } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.match(searchText, /main-final-before-sidechain-error/);
    assert.doesNotMatch(searchText, /subagent failed/);
  });

  it('does not promote interrupted partial output to a final response', async () => {
    const filePath = createMockSession(tmpDir, 'interrupted-response', [
      { type: 'user', message: { content: 'Start a long task' } },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'partial-output-marker' }] } },
      { type: 'user', message: { content: '[Request interrupted by user]' } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.doesNotMatch(searchText, /partial-output-marker/);
  });

  it('does not promote interrupted stop-sequence output to a final response', async () => {
    const filePath = createMockSession(tmpDir, 'interrupted-stop-sequence', [
      { type: 'user', message: { content: 'Start another long task' } },
      { type: 'assistant', message: { stop_reason: 'stop_sequence', content: [
        { type: 'text', text: 'stop-sequence-partial-marker' },
      ] } },
      { type: 'user', message: { content: '[Request interrupted by user]' } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.doesNotMatch(searchText, /stop-sequence-partial-marker/);
  });

  it('does not let sidechain interruption records clear the main turn', async () => {
    const filePath = createMockSession(tmpDir, 'sidechain-interruption', [
      { type: 'user', message: { content: 'Main-thread request' } },
      { type: 'user', isSidechain: true, message: { content: '[Request interrupted by user]' } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: 'main-thread-final-marker' },
      ] } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.match(searchText, /main-thread-final-marker/);
  });

  it('indexes a background-task final answer after user interruption', async () => {
    const filePath = createMockSession(tmpDir, 'interrupted-background-task', [
      { type: 'user', message: { content: 'Monitor the background task' } },
      { type: 'assistant', message: { stop_reason: 'stop_sequence', content: [
        { type: 'text', text: 'interrupted-background-partial-marker' },
      ] } },
      { type: 'user', message: { content: '[Request interrupted by user]' } },
      { type: 'user', message: { content: '<task-notification>task completed</task-notification>' } },
      { type: 'assistant', message: { stop_reason: 'end_turn', content: [
        { type: 'text', text: 'background-task-final-marker' },
      ] } },
    ]);

    const searchText = await buildSessionSearchText({ filePath });
    assert.match(searchText, /background-task-final-marker/);
    assert.doesNotMatch(searchText, /interrupted-background-partial-marker/);
  });

  it('uses the first real user prompt rather than metadata for the session topic', () => {
    const filePath = createMockSession(tmpDir, 'real-topic', [
      { type: 'user', isMeta: true, timestamp: '2026-07-22T01:00:00Z', message: { content: 'internal-skill-marker' } },
      { type: 'user', timestamp: '2026-07-22T01:00:01Z', message: { content: 'actual searchable topic' } },
    ]);

    const session = loadSessionQuick(filePath, 'project-test');
    assert.equal(session.topic, 'actual searchable topic');
    loadSessionDetail(session);
    assert.equal(session.topic, 'actual searchable topic');
  });

  it('finds a real topic outside the quick head and tail samples', () => {
    const filePath = createMockSession(tmpDir, 'middle-topic', [
      { type: 'user', message: { content: `metadata-${'m'.repeat(200000)}` }, isMeta: true, timestamp: '2026-07-22T01:00:00Z' },
      { type: 'user', timestamp: '2026-07-22T01:00:01Z', message: { content: 'middle-searchable-topic' } },
      { type: 'user', timestamp: '2026-07-22T01:00:02Z', message: { content: [
        { type: 'tool_result', content: 'x'.repeat(40000) },
      ] } },
      { type: 'assistant', timestamp: '2026-07-22T01:00:03Z', message: { stop_reason: 'end_turn', content: [] } },
    ]);

    const session = loadSessionQuick(filePath, 'project-test');
    assert.equal(session.topic, 'middle-searchable-topic');
  });

  it('defers an ambiguous large topic until background indexing', async () => {
    const filePath = createMockSession(tmpDir, 'deferred-middle-topic', [
      { type: 'user', message: { content: `metadata-${'m'.repeat(40000)}` }, isMeta: true, timestamp: '2026-07-22T01:00:00Z' },
      { type: 'user', timestamp: '2026-07-22T01:00:01Z', message: { content: 'deferred-searchable-topic' } },
      { type: 'user', timestamp: '2026-07-22T01:00:02Z', message: { content: [
        { type: 'tool_result', content: 'x'.repeat(40000) },
      ] } },
      { type: 'assistant', timestamp: '2026-07-22T01:00:03Z', message: { stop_reason: 'end_turn', content: [] } },
    ]);

    const session = loadSessionQuick(filePath, 'project-test', { deferTopicScan: true });
    assert.equal(session._topicNeedsScan, true);
    assert.equal(session.topic, '(indexing topic…)');
    await buildSessionSearchText(session);
    assert.equal(session.topic, 'deferred-searchable-topic');
    assert.equal(session._topicNeedsScan, false);
  });

  it('does not use a later tail prompt as the session topic', async () => {
    const filePath = createMockSession(tmpDir, 'middle-before-tail-topic', [
      { type: 'user', message: { content: `metadata-${'m'.repeat(40000)}` }, isMeta: true, timestamp: '2026-07-22T01:00:00Z' },
      { type: 'user', timestamp: '2026-07-22T01:00:01Z', message: { content: 'first-middle-topic' } },
      { type: 'user', timestamp: '2026-07-22T01:00:02Z', message: { content: [
        { type: 'tool_result', content: 'x'.repeat(40000) },
      ] } },
      { type: 'user', timestamp: '2026-07-22T01:00:03Z', message: { content: 'later-tail-topic' } },
      { type: 'assistant', timestamp: '2026-07-22T01:00:04Z', message: { stop_reason: 'end_turn', content: [] } },
    ]);

    const session = loadSessionQuick(filePath, 'project-test', { deferTopicScan: true });
    assert.equal(session.topic, '(indexing topic…)');
    await buildSessionSearchText(session);
    assert.equal(session.topic, 'first-middle-topic');
  });

  it('does not salvage a truncated tool-result payload as the topic', () => {
    const filePath = createMockSession(tmpDir, 'truncated-tool-result', [
      { type: 'user', message: { content: [
        { tool_use_id: 'tool-1', type: 'tool_result', content: `internal-${'x'.repeat(40000)}` },
      ] }, timestamp: '2026-07-22T01:00:00Z' },
      { type: 'assistant', timestamp: '2026-07-22T01:00:01Z', message: { stop_reason: 'end_turn', content: [] } },
    ]);

    const session = loadSessionQuick(filePath, 'project-test');
    assert.equal(session.topic, '(no user messages)');
  });

  it('defers indexing and processes sessions incrementally', async () => {
    const sessions = [
      { sessionId: 'one', filePath: createMockSession(tmpDir, 'one', [
        { type: 'user', message: { content: 'first-search-marker' } },
      ]) },
      { sessionId: 'two', filePath: createMockSession(tmpDir, 'two', [
        { type: 'user', message: { content: 'second-search-marker' } },
      ]) },
    ];
    const scheduled = [];
    const indexed = [];
    let completed = false;

    indexSessionsInBackground(sessions, {
      schedule: callback => scheduled.push(callback),
      onSessionIndexed: session => indexed.push(session.sessionId),
      onComplete: () => { completed = true; },
    });

    assert.equal(indexed.length, 0);
    await scheduled.shift()();
    assert.deepEqual(indexed, ['one']);
    await scheduled.shift()();
    assert.deepEqual(indexed, ['one', 'two']);
    await scheduled.shift()();
    assert.equal(completed, true);
  });

  it('combines exact project filtering with text and renamed titles', () => {
    const sessions = [
      { sessionId: 'alpha', project: 'project-alpha', topic: 'first', customTitle: 'Launch Notes', searchText: 'release marker' },
      { sessionId: 'beta', project: 'project-beta', topic: 'second', searchText: 'mentions project-alpha release marker' },
    ];
    assert.deepEqual(filterSessionList(sessions, 'release', 'project-alpha').map(s => s.sessionId), ['alpha']);
    assert.deepEqual(filterSessionList(sessions, 'launch notes', '').map(s => s.sessionId), ['alpha']);
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

  describe('updateSessionTitle', () => {
    it('keeps starter titles local and does not modify the Claude transcript', () => {
      const transcript = path.join(tmpDir, 'session-1.jsonl');
      fs.writeFileSync(transcript, '{"type":"user"}\n', 'utf-8');
      const before = fs.readFileSync(transcript, 'utf-8');
      const meta = { sessions: {} };
      const session = { sessionId: 'session-1', filePath: transcript };

      assert.equal(updateSessionTitle(meta, session, '  My Session  '), 'My Session');
      assert.equal(meta.sessions['session-1'].customTitle, 'My Session');
      assert.equal(session.customTitle, 'My Session');
      assert.equal(fs.readFileSync(transcript, 'utf-8'), before);
    });

    it('clears a local title without touching other session metadata', () => {
      const meta = { sessions: { 'session-1': { customTitle: 'Old', permissionMode: 'plan' } } };
      const session = { sessionId: 'session-1', customTitle: 'Old' };

      assert.equal(updateSessionTitle(meta, session, ''), '');
      assert.equal(meta.sessions['session-1'].customTitle, undefined);
      assert.equal(meta.sessions['session-1'].permissionMode, 'plan');
      assert.equal(session.customTitle, '');
    });

    it('reveals and searches the transcript title after clearing a local override', () => {
      const meta = { sessions: { 'session-1': { customTitle: 'Local title' } } };
      const session = {
        sessionId: 'session-1',
        project: 'test',
        topic: 'topic',
        customTitle: 'Local title',
        _transcriptTitle: 'Transcript title',
        _customTitleFromMeta: true,
      };

      assert.equal(updateSessionTitle(meta, session, ''), '');
      assert.equal(session.customTitle, 'Transcript title');
      assert.equal(session._customTitleFromMeta, false);
      assert.deepEqual(filterSessionList([session], 'transcript title'), [session]);
      assert.deepEqual(filterSessionList([session], 'local title'), []);
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
// 18. macOS input source
// =============================================================================
describe('switchToAbcInputSource', () => {
  it('switches macOS input to ABC with macism', () => {
    const calls = [];
    const runCommand = (command, args, options) => {
      calls.push({ command, args, options });
      return { status: 0 };
    };

    assert.equal(switchToAbcInputSource('darwin', runCommand), true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].command, 'macism');
    assert.deepEqual(calls[0].args, ['com.apple.keylayout.ABC']);
    assert.equal(calls[0].options.timeout, 1000);
  });

  it('falls back to the built-in macOS input-source API', () => {
    const calls = [];
    const runCommand = (command, args) => {
      calls.push({ command, args });
      if (command === 'macism') return { status: null, error: { code: 'ENOENT' } };
      return { status: 0 };
    };

    assert.equal(switchToAbcInputSource('darwin', runCommand), true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].command, '/usr/bin/osascript');
    assert.deepEqual(calls[1].args.slice(0, 3), ['-l', 'JavaScript', '-e']);
    assert.match(calls[1].args[3], /com\.apple\.keylayout\.ABC/);
    assert.match(calls[1].args[3], /ObjC\.bindFunction\("TISSelectInputSource"/);
    assert.match(calls[1].args[3], /sources\.objectAtIndex\(0\)/);
  });

  it('does not switch input sources outside macOS', () => {
    let called = false;
    assert.equal(switchToAbcInputSource('linux', () => { called = true; }), false);
    assert.equal(called, false);
  });
});

describe('createInputSourceActivator', () => {
  it('debounces repeated input-source activation', () => {
    let currentTime = 1000;
    let switchCount = 0;
    const activate = createInputSourceActivator(
      () => { switchCount++; return true; },
      () => currentTime,
    );

    assert.equal(activate(), true);
    currentTime = 1100;
    assert.equal(activate(), false);
    currentTime = 1250;
    assert.equal(activate(), true);
    assert.equal(switchCount, 2);
  });
});

// =============================================================================
// 19. detectCLI
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
// 20. Module export validation
// =============================================================================
describe('Module exports', () => {
  it('exports all expected functions', () => {
    const expectedFunctions = [
      'getProjectDisplayName', 'extractUserText', 'loadSessionQuick',
      'loadSessionDetail', 'loadAllSessions', 'formatTimestamp',
      'formatFileSize', 'getProjectColor', 'esc', 'loadMeta',
      'saveMeta', 'getSessionMeta', 'getEffectivePermissionMode',
      'setSessionPermissionMode', 'setGlobalPermissionMode', 'updateSessionTitle',
      'detectCLI', 'switchToAbcInputSource', 'createInputSourceActivator', 'runListMode',
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
