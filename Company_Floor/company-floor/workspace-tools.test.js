'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { WorkspaceTools } = require('./workspace-tools.js');

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'company-floor-tools-'));
  execFileSync('git', ['init', '-q', root]);
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src', 'sample.js'), 'const oldValue = 1;\n');
  fs.writeFileSync(path.join(root, '.env'), 'TOKEN=do-not-read\n');
  return {
    root,
    tools: new WorkspaceTools(root),
    cleanup() { fs.rmSync(root, { recursive: true, force: true }); }
  };
}

function patch(before, after) {
  return [
    'diff --git a/src/sample.js b/src/sample.js',
    '--- a/src/sample.js',
    '+++ b/src/sample.js',
    '@@ -1 +1 @@',
    '-' + before,
    '+' + after,
    ''
  ].join('\n');
}

test('workspace tools confine paths and exclude credential files', () => {
  const f = fixture();
  try {
    assert.throws(() => f.tools.readFile('../outside.js'), /escapes are not allowed/);
    assert.throws(() => f.tools.readFile('.env'), /excluded from agent access/);
    assert.deepEqual(f.tools.listFiles('.'), ['src/sample.js']);
    assert.deepEqual(f.tools.listFiles('src'), ['src/sample.js']);
    assert.equal(f.tools.readFile('src/sample.js').content, 'const oldValue = 1;\n');
  } finally {
    f.cleanup();
  }
});

test('workspace tools reject symlinks that point outside the workspace', () => {
  const f = fixture();
  const outside = path.join(path.dirname(f.root), 'company-floor-outside-' + process.pid + '.js');
  try {
    fs.writeFileSync(outside, 'const external = true;\n');
    fs.symlinkSync(outside, path.join(f.root, 'src', 'external.js'));
    assert.throws(() => f.tools.readFile('src/external.js'), /Symbolic links/);
    assert.deepEqual(f.tools.listFiles('src'), ['src/sample.js']);
  } finally {
    fs.rmSync(outside, { force: true });
    f.cleanup();
  }
});

test('workspace tools require approval externally and apply only a valid approved patch', () => {
  const f = fixture();
  try {
    const prepared = f.tools.preparePatch(patch('const oldValue = 1;', 'const newValue = 2;'));
    assert.equal(fs.readFileSync(path.join(f.root, 'src/sample.js'), 'utf8'), 'const oldValue = 1;\n');
    const result = f.tools.applyPatch(prepared);
    assert.equal(result.path, 'src/sample.js');
    assert.equal(fs.readFileSync(path.join(f.root, 'src/sample.js'), 'utf8'), 'const newValue = 2;\n');
  } finally {
    f.cleanup();
  }
});

test('workspace tools reject stale patches and multiple-file patches', () => {
  const f = fixture();
  try {
    const prepared = f.tools.preparePatch(patch('const oldValue = 1;', 'const newValue = 2;'));
    fs.writeFileSync(path.join(f.root, 'src/sample.js'), 'const changed = 3;\n');
    assert.throws(() => f.tools.applyPatch(prepared), /changed while approval was pending/);
    assert.throws(() => f.tools.preparePatch(patch('const oldValue = 1;', 'const newValue = 2;') +
      'diff --git a/other.js b/other.js\n'), /exactly one existing file/);
  } finally {
    f.cleanup();
  }
});

test('workspace tools only offer fixed project checks', () => {
  const f = fixture();
  try {
    assert.throws(() => f.tools.checkCommand('custom command'), /allowlisted checks/);
    assert.throws(() => f.tools.checkCommand('tests'), /No JavaScript test files/);
  } finally {
    f.cleanup();
  }
});

test('workspace tools run only the fixed test and build checks', async () => {
  const f = fixture();
  try {
    fs.writeFileSync(path.join(f.root, 'sample.test.js'), 'const test = require("node:test"); test("fixture", () => {});\n');
    const testResult = await f.tools.runCheck('tests');
    assert.equal(testResult.ok, true, testResult.output);
    assert.equal(testResult.check, 'tests');

    const build = path.join(f.root, 'Company_Floor', 'company-floor', 'build.js');
    fs.mkdirSync(path.dirname(build), { recursive: true });
    fs.writeFileSync(build, 'process.stdout.write("fixture build ok");\n');
    const buildResult = await f.tools.runCheck('build');
    assert.equal(buildResult.ok, true, buildResult.output);
    assert.match(buildResult.output, /fixture build ok/);
  } finally {
    f.cleanup();
  }
});
