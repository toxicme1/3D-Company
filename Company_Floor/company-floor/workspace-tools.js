'use strict';

const crypto = require('node:crypto');
const { execFile, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const MAX_FILE_BYTES = 250000;
const MAX_PATCH_BYTES = 100000;
const MAX_LISTED_FILES = 200;
const SKIP_DIRS = new Set(['.git', '.os', '.preview', 'coverage', 'dist', 'node_modules', 'vendor']);
const TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cpp', '.css', '.go', '.h', '.hpp', '.html', '.java', '.js', '.json',
  '.jsx', '.md', '.mjs', '.py', '.rs', '.scss', '.sh', '.sql', '.svg', '.toml', '.ts',
  '.tsx', '.txt', '.xml', '.yaml', '.yml'
]);
const SPECIAL_TEXT_FILES = new Set(['.editorconfig', '.gitignore', '.npmrc.example']);
const SENSITIVE_NAME = /(^|[._-])(?:\.env(?:[._-]|$)|secret|secrets|credential|credentials|private[-_]?key|id_rsa|setting\.json)(?:$|[._-])/i;

function hash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function isTextPath(relative) {
  const name = path.basename(relative);
  return (TEXT_EXTENSIONS.has(path.extname(name).toLowerCase()) || SPECIAL_TEXT_FILES.has(name)) &&
    !SENSITIVE_NAME.test(name) && !/^\.env(?:\.|$)/i.test(name);
}

class WorkspaceTools {
  constructor(root) {
    const resolved = path.resolve(root);
    if (!fs.statSync(resolved).isDirectory()) throw new Error('Workspace root must be a directory.');
    this.root = fs.realpathSync(resolved);
  }

  resolveFile(relative, requireExisting) {
    if (typeof relative !== 'string' || !relative.trim() || relative.includes('\0') || path.isAbsolute(relative)) {
      throw new Error('Use a relative workspace file path.');
    }
    const parts = relative.split(/[\\/]+/).filter(part => part && part !== '.');
    if (!parts.length || parts.some(part => part === '..')) throw new Error('Workspace path escapes are not allowed.');
    if (parts.some(part => SKIP_DIRS.has(part) || SENSITIVE_NAME.test(part) || /^\.env(?:\.|$)/i.test(part))) {
      throw new Error('That workspace path is excluded from agent access.');
    }
    const absolute = path.resolve(this.root, ...parts);
    if (absolute !== this.root && !absolute.startsWith(this.root + path.sep)) {
      throw new Error('Workspace path escapes are not allowed.');
    }
    let current = this.root;
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      try {
        const stat = fs.lstatSync(current);
        if (stat.isSymbolicLink()) throw new Error('Symbolic links are not available to workspace tools.');
        if (i < parts.length - 1 && !stat.isDirectory()) throw new Error('A workspace path component is not a directory.');
        if (i === parts.length - 1 && requireExisting && !stat.isFile()) throw new Error('Workspace path must be a regular file.');
      } catch (error) {
        if (error.code === 'ENOENT' && !requireExisting && i === parts.length - 1) continue;
        throw error;
      }
    }
    return { relative: parts.join(path.sep), absolute };
  }

  listFiles(relative) {
    const start = relative && relative !== '.'
      ? this.resolveDirectory(relative).absolute
      : this.root;
    if (!fs.statSync(start).isDirectory()) throw new Error('Choose a workspace directory to list.');
    const found = [];
    const walk = (directory, depth) => {
      if (depth > 8 || found.length >= MAX_LISTED_FILES) return;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name) || SENSITIVE_NAME.test(entry.name) || /^\.env(?:\.|$)/i.test(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(absolute, depth + 1);
        else if (entry.isFile()) {
          const rel = path.relative(this.root, absolute);
          if (isTextPath(rel)) found.push(rel);
          if (found.length >= MAX_LISTED_FILES) break;
        }
      }
    };
    walk(start, 0);
    return found.sort();
  }

  resolveDirectory(relative) {
    const directory = this.resolveFile(relative, false);
    if (!fs.lstatSync(directory.absolute).isDirectory()) throw new Error('Choose a workspace directory to list.');
    return directory;
  }

  readFile(relative, startLine, lineCount) {
    const file = this.resolveFile(relative, true);
    if (!isTextPath(file.relative)) throw new Error('That file type is not available to agent tools.');
    const stat = fs.statSync(file.absolute);
    if (stat.size > MAX_FILE_BYTES) throw new Error('File is too large to provide to an agent.');
    const content = fs.readFileSync(file.absolute);
    if (content.includes(0)) throw new Error('Binary files are not available to agent tools.');
    const lines = content.toString('utf8').split(/\r?\n/);
    const from = Number.isInteger(startLine) && startLine > 0 ? startLine : 1;
    const count = Number.isInteger(lineCount) && lineCount > 0 && lineCount <= 300 ? lineCount : 200;
    const selected = lines.slice(from - 1, from - 1 + count);
    const selectedText = selected.join('\n');
    return {
      path: file.relative,
      startLine: from,
      totalLines: lines.length,
      content: selectedText.slice(0, 20000),
      truncated: selectedText.length > 20000,
      sha256: hash(content)
    };
  }

  preparePatch(patch) {
    if (typeof patch !== 'string' || !patch.trim() || Buffer.byteLength(patch) > MAX_PATCH_BYTES) {
      throw new Error('Patch must be non-empty and no larger than 100 KB.');
    }
    if (/^(?:rename from|rename to|new file mode|deleted file mode|GIT binary patch|Binary files )/m.test(patch)) {
      throw new Error('Only text edits to existing files are supported.');
    }
    const headers = Array.from(patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm));
    if (headers.length !== 1 || headers[0][1] !== headers[0][2]) {
      throw new Error('A proposed patch must change exactly one existing file.');
    }
    if ((patch.match(/^--- /gm) || []).length !== 1 || (patch.match(/^\+\+\+ /gm) || []).length !== 1) {
      throw new Error('Patch must contain exactly one old-file and one new-file header.');
    }
    const relative = headers[0][1];
    const oldHeader = patch.match(/^--- a\/([^\t\n]+)(?:\t.*)?$/m);
    const newHeader = patch.match(/^\+\+\+ b\/([^\t\n]+)(?:\t.*)?$/m);
    if (!oldHeader || !newHeader || oldHeader[1] !== relative || newHeader[1] !== relative) {
      throw new Error('Patch file headers must match the single changed workspace path.');
    }
    const file = this.resolveFile(relative, true);
    if (!isTextPath(file.relative)) throw new Error('That file type is not available to agent tools.');
    const before = fs.readFileSync(file.absolute);
    if (before.length > MAX_FILE_BYTES || before.includes(0)) throw new Error('The target must be a text file no larger than 250 KB.');
    execFileSync('git', ['-C', this.root, 'apply', '--check', '--whitespace=nowarn', '-'], {
      input: patch,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
    return {
      path: file.relative,
      patch,
      beforeHash: hash(before),
      patchHash: hash(patch)
    };
  }

  applyPatch(prepared) {
    const file = this.resolveFile(prepared.path, true);
    const before = fs.readFileSync(file.absolute);
    if (hash(before) !== prepared.beforeHash || hash(prepared.patch) !== prepared.patchHash) {
      throw new Error('The file or approved patch changed while approval was pending. Review a new patch.');
    }
    this.preparePatch(prepared.patch);
    execFileSync('git', ['-C', this.root, 'apply', '--whitespace=nowarn', '-'], {
      input: prepared.patch,
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024
    });
    const after = fs.readFileSync(file.absolute);
    return { path: file.relative, beforeHash: prepared.beforeHash, afterHash: hash(after), patchHash: prepared.patchHash };
  }

  checkCommand(check) {
    if (check === 'build') {
      const candidates = [
        'Company_Floor/company-floor/build.js',
        'company-floor/build.js',
        'build.js'
      ];
      let script;
      for (const rel of candidates) {
        try {
          script = this.resolveFile(rel, true);
          break;
        } catch (_) {}
      }
      if (!script) {
        script = this.resolveFile('Company_Floor/company-floor/build.js', true);
      }
      return {
        check,
        command: 'node ' + script.relative,
        executable: process.execPath,
        args: [script.absolute]
      };
    }
    if (check !== 'tests') throw new Error('Choose one of the allowlisted checks: tests or build.');
    const files = [];
    const findTests = (directory, depth) => {
      if (depth > 16) throw new Error('Test discovery reached the workspace depth limit.');
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name) || SENSITIVE_NAME.test(entry.name) || /^\.env(?:\.|$)/i.test(entry.name)) continue;
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) findTests(absolute, depth + 1);
        else if (entry.isFile() && /\.test\.js$/.test(entry.name)) {
          files.push(absolute);
          if (files.length > MAX_LISTED_FILES) throw new Error('Test discovery found more than 200 files; narrow the workspace before running the approved check.');
        }
      }
    };
    findTests(this.root, 0);
    if (!files.length) throw new Error('No JavaScript test files were found in the workspace.');
    files.sort();
    return {
      check,
      command: 'node --test (' + files.length + ' discovered test files)',
      executable: process.execPath,
      args: ['--test', ...files]
    };
  }

  async runCheck(check) {
    const command = this.checkCommand(check);
    const allowedEnv = {};
    ['PATH', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'LC_ALL'].forEach(key => {
      if (process.env[key]) allowedEnv[key] = process.env[key];
    });
    allowedEnv.CI = '1';
    const result = await new Promise(resolve => {
      execFile(command.executable, command.args, {
        cwd: this.root,
        env: allowedEnv,
        shell: false,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
        windowsHide: true
      }, (error, stdout, stderr) => {
        resolve({
          check: command.check,
          command: command.command,
          ok: !error,
          exitCode: error && Number.isInteger(error.code) ? error.code : (error ? 1 : 0),
          timedOut: !!(error && error.killed),
          output: (String(stdout || '') + (stderr ? '\n' + String(stderr) : '')).slice(0, 12000)
        });
      });
    });
    return result;
  }
}

module.exports = { WorkspaceTools, isTextPath };
