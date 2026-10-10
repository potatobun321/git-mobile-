const { exec, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Execute a git command inside the target repo directory
 */
function runGit(repoPath, args) {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new'
    };
    execFile('git', args, { cwd: repoPath, env, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        return reject({
          code: error.code,
          message: error.message,
          stdout: (stdout || '').trim(),
          stderr: (stderr || '').trim()
        });
      }
      resolve({
        stdout: (stdout || '').trim(),
        stderr: (stderr || '').trim()
      });
    });
  });
}

/**
 * Get comprehensive repository status
 */
async function getRepoStatus(repoPath) {
  // 1. Current Branch
  let branch = 'unknown';
  try {
    const branchRes = await runGit(repoPath, ['branch', '--show-current']);
    branch = branchRes.stdout || 'detached HEAD';
  } catch (e) {
    // fallback if initial commit hasn't been made
    try {
      const headRes = await runGit(repoPath, ['symbolic-ref', '--short', 'HEAD']);
      branch = headRes.stdout;
    } catch (_) {}
  }

  // 2. Remote URL
  let remoteUrl = '';
  try {
    const remoteRes = await runGit(repoPath, ['config', '--get', 'remote.origin.url']);
    remoteUrl = remoteRes.stdout;
  } catch (_) {}

  // 3. Ahead / Behind counts
  let ahead = 0;
  let behind = 0;
  let hasRemote = false;
  if (remoteUrl) {
    try {
      const countsRes = await runGit(repoPath, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']);
      const parts = countsRes.stdout.split(/\s+/);
      if (parts.length >= 2) {
        ahead = parseInt(parts[0], 10) || 0;
        behind = parseInt(parts[1], 10) || 0;
        hasRemote = true;
      }
    } catch (_) {
      // Remote branch might not be tracked yet
      hasRemote = false;
    }
  }

  // 4. File status (porcelain)
  const statusRes = await runGit(repoPath, ['status', '--porcelain=v1']);
  const statusLines = statusRes.stdout ? statusRes.stdout.split('\n') : [];
  
  const modified = [];
  const staged = [];
  const untracked = [];

  for (const line of statusLines) {
    if (!line.trim()) continue;
    const indexCode = line[0];
    const workTreeCode = line[1];
    const file = line.substring(3).trim();

    if (indexCode === '?' && workTreeCode === '?') {
      untracked.push(file);
    } else {
      if (indexCode !== ' ' && indexCode !== '?') {
        staged.push({ file, status: indexCode });
      }
      if (workTreeCode !== ' ' && workTreeCode !== '?') {
        modified.push({ file, status: workTreeCode });
      }
    }
  }

  const isClean = modified.length === 0 && staged.length === 0 && untracked.length === 0;

  return {
    branch,
    remoteUrl,
    hasRemote,
    ahead,
    behind,
    isClean,
    counts: {
      modified: modified.length,
      staged: staged.length,
      untracked: untracked.length
    },
    files: {
      modified,
      staged,
      untracked
    }
  };
}

/**
 * Pull latest changes from remote
 */
async function pullRepo(repoPath) {
  return await runGit(repoPath, ['pull']);
}

/**
 * Commit changes
 */
async function commitRepo(repoPath, message, files = []) {
  if (!message || !message.trim()) {
    throw new Error('Commit message is required');
  }

  if (files && files.length > 0) {
    await runGit(repoPath, ['add', ...files]);
  } else {
    await runGit(repoPath, ['add', '-A']);
  }

  return await runGit(repoPath, ['commit', '-m', message.trim()]);
}

/**
 * Push commits to remote (automatically sets upstream on first push)
 */
async function pushRepo(repoPath) {
  let branch = 'master';
  try {
    const b = await runGit(repoPath, ['branch', '--show-current']);
    if (b.stdout) branch = b.stdout.trim();
  } catch (_) {}

  try {
    return await runGit(repoPath, ['push']);
  } catch (err) {
    const errText = (err.stderr || err.message || '');
    if (errText.includes('no upstream branch') || errText.includes('--set-upstream') || errText.includes('has no upstream')) {
      return await runGit(repoPath, ['push', '-u', 'origin', branch]);
    }
    throw err;
  }
}

/**
 * Sync workflow: Pull -> Auto-commit changes if any -> Push
 */
async function syncWorkflow(repoPath, customMessage) {
  const logs = [];
  
  // 1. Try Pull if remote is configured
  try {
    const pullRes = await runGit(repoPath, ['pull']);
    logs.push(`[Pull] ${pullRes.stdout || 'Already up to date.'}`);
  } catch (e) {
    logs.push(`[Pull Notice] ${e.stderr || e.message || 'No remote upstream configured or pull skipped.'}`);
  }

  // 2. Check if local changes exist
  const status = await getRepoStatus(repoPath);
  if (!status.isClean) {
    const msg = customMessage && customMessage.trim() 
      ? customMessage.trim() 
      : `mobile-sync: update on ${new Date().toLocaleString()}`;
    
    await runGit(repoPath, ['add', '-A']);
    const commitRes = await runGit(repoPath, ['commit', '-m', msg]);
    logs.push(`[Commit] ${commitRes.stdout}`);
  } else {
    logs.push('[Commit] Working tree clean; nothing to commit.');
  }

  // 3. Try Push
  try {
    const pushRes = await pushRepo(repoPath);
    logs.push(`[Push] ${pushRes.stdout || pushRes.stderr || 'Pushed successfully.'}`);
  } catch (e) {
    logs.push(`[Push Notice] ${e.stderr || e.message || 'Push skipped or remote not configured.'}`);
  }

  return { success: true, logs };
}

/**
 * Get recent commit history
 */
async function getHistory(repoPath, count = 15) {
  try {
    const res = await runGit(repoPath, [
      'log',
      `-n${count}`,
      '--pretty=format:%H|%h|%an|%ar|%s'
    ]);
    if (!res.stdout) return [];
    
    return res.stdout.split('\n').map(line => {
      const [hash, shortHash, author, relativeDate, subject] = line.split('|');
      return { hash, shortHash, author, relativeDate, subject };
    });
  } catch (_) {
    return [];
  }
}

/**
 * List files inside repository safely, preventing path traversal
 */
function listRepositoryFiles(repoPath, subDir = '') {
  const safeBase = path.resolve(repoPath);
  const targetDir = path.resolve(safeBase, subDir);

  if (!targetDir.startsWith(safeBase)) {
    throw new Error('Access denied: path traversal detected');
  }

  if (!fs.existsSync(targetDir)) {
    return [];
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    
    const fullPath = path.join(targetDir, entry.name);
    const relPath = path.relative(safeBase, fullPath).replace(/\\/g, '/');
    const isDir = entry.isDirectory();
    let size = 0;
    let modifiedAt = null;

    try {
      const stats = fs.statSync(fullPath);
      size = stats.size;
      modifiedAt = stats.mtime;
    } catch (_) {}

    result.push({
      name: entry.name,
      path: relPath,
      isDirectory: isDir,
      size,
      modifiedAt
    });
  }

  // Folders first, then alphabetically
  result.sort((a, b) => {
    if (a.isDirectory === b.isDirectory) {
      return a.name.localeCompare(b.name);
    }
    return a.isDirectory ? -1 : 1;
  });

  return result;
}

/**
 * Read text/markdown file content safely
 */
function readSafeFile(repoPath, relFilePath) {
  const safeBase = path.resolve(repoPath);
  const fullPath = path.resolve(safeBase, relFilePath);

  if (!fullPath.startsWith(safeBase)) {
    throw new Error('Access denied: path traversal detected');
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error('File does not exist');
  }

  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Save text/markdown file content safely
 */
function writeSafeFile(repoPath, relFilePath, content) {
  const safeBase = path.resolve(repoPath);
  const fullPath = path.resolve(safeBase, relFilePath);

  if (!fullPath.startsWith(safeBase)) {
    throw new Error('Access denied: path traversal detected');
  }

  const parentDir = path.dirname(fullPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  return { success: true, path: relFilePath };
}

/**
 * Get or set remote origin URL
 */
async function getRemoteUrl(repoPath) {
  try {
    const res = await runGit(repoPath, ['remote', 'get-url', 'origin']);
    return res.stdout.trim();
  } catch (_) {
    return '';
  }
}

async function setRemoteUrl(repoPath, url) {
  if (!url || !url.trim()) {
    throw new Error('Remote URL is required');
  }
  const cleanUrl = url.trim();
  try {
    await runGit(repoPath, ['remote', 'get-url', 'origin']);
    // Origin exists, update it
    return await runGit(repoPath, ['remote', 'set-url', 'origin', cleanUrl]);
  } catch (_) {
    // Origin does not exist, add it
    return await runGit(repoPath, ['remote', 'add', 'origin', cleanUrl]);
  }
}

/**
 * Execute custom git command with safety boundaries
 */
async function executeCustomGit(repoPath, commandString) {
  if (!commandString || !commandString.trim()) {
    throw new Error('Command is required');
  }

  const raw = commandString.trim();
  // Strip optional leading 'git'
  const cleanCmd = raw.startsWith('git ') ? raw.substring(4).trim() : raw;
  
  // Basic safety check: block destructive system commands if any
  const forbidden = [';', '&&', '||', '|', '`', '$', '>', '<'];
  for (const char of forbidden) {
    if (cleanCmd.includes(char)) {
      throw new Error(`Command contains unsupported shell operator '${char}'`);
    }
  }

  // Parse arguments safely
  const args = cleanCmd.split(/\s+/).filter(Boolean);
  return await runGit(repoPath, args);
}

/**
 * Get unified git diff for a specific file or the entire working tree
 */
async function getFileDiff(repoPath, filePath = '') {
  try {
    const args = ['diff'];
    if (filePath) {
      args.push('HEAD', '--', filePath);
    } else {
      args.push('HEAD');
    }
    const res = await runGit(repoPath, args);
    if (res.stdout) return res.stdout;

    // Fallback checks for staged or unstaged changes
    if (filePath) {
      const cached = await runGit(repoPath, ['diff', '--cached', '--', filePath]);
      if (cached.stdout) return cached.stdout;
      const plain = await runGit(repoPath, ['diff', '--', filePath]);
      if (plain.stdout) return plain.stdout;

      // If untracked file, show full content as addition
      const fullPath = path.resolve(repoPath, filePath);
      if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          return `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n` + lines.map(l => '+' + l).join('\n');
        } catch (_) {}
      }
    }
    return res.stdout || '';
  } catch (err) {
    try {
      const fallback = await runGit(repoPath, filePath ? ['diff', '--', filePath] : ['diff']);
      return fallback.stdout || '';
    } catch (_) {
      return '';
    }
  }
}

const UPSTREAM_URL = 'https://github.com/potatobun321/git-mobile-.git';

/**
 * Ensure the official .gitmobile upstream remote is configured
 */
async function ensureUpstreamRemote(repoPath, upstreamUrl = UPSTREAM_URL) {
  try {
    const res = await runGit(repoPath, ['remote', 'get-url', 'upstream']);
    if (res.stdout !== upstreamUrl) {
      await runGit(repoPath, ['remote', 'set-url', 'upstream', upstreamUrl]);
    }
  } catch (_) {
    try {
      await runGit(repoPath, ['remote', 'add', 'upstream', upstreamUrl]);
    } catch (_) {}
  }
}

/**
 * Check if the official upstream engine has updates available
 */
async function checkEngineUpdates(repoPath) {
  await ensureUpstreamRemote(repoPath);
  try {
    await runGit(repoPath, ['fetch', 'upstream', 'master', '--depth=1']);

    const diffRes = await runGit(repoPath, [
      'diff',
      'HEAD...upstream/master',
      '--',
      '.gitmobile',
      'startup.bat',
      'startup.sh'
    ]);

    const hasUpdates = Boolean(diffRes.stdout && diffRes.stdout.trim().length > 0);

    let upstreamCommit = '';
    try {
      const commitRes = await runGit(repoPath, ['log', '-n', '1', '--pretty=format:%h - %s (%cr)', 'upstream/master']);
      upstreamCommit = commitRes.stdout.trim();
    } catch (_) {}

    return {
      success: true,
      updateAvailable: hasUpdates,
      upstreamCommit
    };
  } catch (err) {
    return {
      success: false,
      updateAvailable: false,
      error: err.stderr || err.message
    };
  }
}

/**
 * Selectively update .gitmobile engine files from upstream master without touching user content
 */
async function applyEngineUpdate(repoPath) {
  await ensureUpstreamRemote(repoPath);

  // Preserve config.json if present
  const configPath = path.join(repoPath, '.gitmobile', 'config.json');
  let configBackup = null;
  if (fs.existsSync(configPath)) {
    try {
      configBackup = fs.readFileSync(configPath, 'utf8');
    } catch (_) {}
  }

  // Fetch full upstream master
  await runGit(repoPath, ['fetch', 'upstream', 'master']);

  // Checkout only the engine files
  await runGit(repoPath, [
    'checkout',
    'upstream/master',
    '--',
    '.gitmobile',
    'startup.bat',
    'startup.sh'
  ]);

  // Restore preserved config.json
  if (configBackup) {
    try {
      fs.writeFileSync(configPath, configBackup, 'utf8');
    } catch (_) {}
  }

  return {
    success: true,
    message: 'Successfully updated .gitmobile engine to the latest upstream release.'
  };
}

/**
 * Clone a remote repository to target directory
 */
async function cloneRepository(targetDir, gitUrl) {
  const parent = path.dirname(targetDir);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  const args = ['clone', gitUrl, targetDir];
  return await runGit(parent, args);
}

module.exports = {
  runGit,
  getRepoStatus,
  pullRepo,
  commitRepo,
  pushRepo,
  syncWorkflow,
  getHistory,
  listRepositoryFiles,
  readSafeFile,
  writeSafeFile,
  getRemoteUrl,
  setRemoteUrl,
  executeCustomGit,
  getFileDiff,
  ensureUpstreamRemote,
  checkEngineUpdates,
  applyEngineUpdate,
  cloneRepository
};
