const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const gitOps = require('./git-ops');

const app = express();

// Path configurations
const PRIMARY_REPO_ROOT = path.resolve(__dirname, '../../');
const REPOS_REGISTRY_FILE = path.resolve(__dirname, '../repos.json');
const CONFIG_FILE = path.resolve(__dirname, '../config.json');
const WEB_DIR = path.resolve(__dirname, '../web');

// Repository Registry Handlers
function loadReposRegistry() {
  const defaultRegistry = {
    activeRepoId: 'default',
    repositories: [
      {
        id: 'default',
        name: path.basename(PRIMARY_REPO_ROOT),
        path: PRIMARY_REPO_ROOT,
        isPrimary: true
      }
    ]
  };

  if (!fs.existsSync(REPOS_REGISTRY_FILE)) {
    try {
      fs.writeFileSync(REPOS_REGISTRY_FILE, JSON.stringify(defaultRegistry, null, 2), 'utf8');
    } catch (_) {}
    return defaultRegistry;
  }

  try {
    const raw = fs.readFileSync(REPOS_REGISTRY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.repositories || !Array.isArray(parsed.repositories)) {
      return defaultRegistry;
    }
    if (!parsed.repositories.find(r => r.id === 'default' || path.resolve(r.path) === PRIMARY_REPO_ROOT)) {
      parsed.repositories.unshift(defaultRegistry.repositories[0]);
    }
    return parsed;
  } catch (_) {
    return defaultRegistry;
  }
}

function saveReposRegistry(registry) {
  try {
    fs.writeFileSync(REPOS_REGISTRY_FILE, JSON.stringify(registry, null, 2), 'utf8');
  } catch (err) {
    console.error('[Registry] Failed to save repos.json:', err.message);
  }
}

function getActiveRepo(req) {
  const registry = loadReposRegistry();
  const reqRepoId = req ? (req.headers['x-gitmobile-repo'] || req.query.repoId) : null;
  if (reqRepoId) {
    const found = registry.repositories.find(r => r.id === reqRepoId);
    if (found && fs.existsSync(found.path)) return found;
  }

  const active = registry.repositories.find(r => r.id === registry.activeRepoId);
  if (active && fs.existsSync(active.path)) {
    return active;
  }

  return {
    id: 'default',
    name: path.basename(PRIMARY_REPO_ROOT),
    path: PRIMARY_REPO_ROOT,
    isPrimary: true
  };
}

// Read config if present
let config = {
  port: 3000,
  pin: '', // blank or unspecified will generate a secure PIN
  host: '0.0.0.0'
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...loaded };
  } catch (err) {
    console.warn('[Config] Failed to parse config.json, using defaults:', err.message);
  }
}

// Auto-generate friendly 4-digit PIN if not explicitly disabled or set
if (config.pin === 'none' || config.pin === 'disabled') {
  config.pin = '';
} else if (!config.pin) {
  config.pin = Math.floor(1000 + Math.random() * 9000).toString();
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}
}

const PORT = parseInt(process.env.PORT || config.port || 3000, 10);
const HOST = process.env.HOST || config.host || '0.0.0.0';

// Setup file upload handling with multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const activeRepo = getActiveRepo(req);
    const targetFolder = req.query.folder || 'papers';
    const safeDest = path.resolve(activeRepo.path, targetFolder);

    // Security check: ensure within repo
    if (!safeDest.startsWith(activeRepo.path)) {
      return cb(new Error('Invalid destination folder'));
    }

    if (!fs.existsSync(safeDest)) {
      fs.mkdirSync(safeDest, { recursive: true });
    }
    cb(null, safeDest);
  },
  filename: function (req, file, cb) {
    // Sanitize filename
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safeName);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PIN Authentication Middleware
const authMiddleware = (req, res, next) => {
  if (!config.pin) {
    return next(); // No PIN configured
  }

  const clientPin = req.headers['x-gitmobile-pin'] || req.query.pin;
  if (clientPin === config.pin) {
    return next();
  }

  return res.status(401).json({ error: 'Unauthorized: Invalid or missing PIN' });
};

// API: Config Info (Public)
app.get('/api/config-info', (req, res) => {
  const activeRepo = getActiveRepo(req);
  res.json({
    repoName: activeRepo.name,
    repoId: activeRepo.id,
    pinRequired: Boolean(config.pin),
    host: HOST,
    port: PORT
  });
});

// API: Verify PIN
app.post('/api/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (!config.pin || pin === config.pin) {
    return res.json({ success: true, message: 'Authentication successful' });
  }
  return res.status(401).json({ success: false, error: 'Invalid PIN' });
});

// Apply auth to all subsequent /api routes
app.use('/api', authMiddleware);

// ==============================================================================
// Repository Management Routes
// ==============================================================================

// API: List Registered Repositories
app.get('/api/repos', async (req, res) => {
  try {
    const registry = loadReposRegistry();
    const reposWithStatus = await Promise.all(
      registry.repositories.map(async (r) => {
        let isClean = true;
        let branch = 'unknown';
        const exists = fs.existsSync(r.path);
        if (exists) {
          try {
            const st = await gitOps.getRepoStatus(r.path);
            isClean = st.isClean;
            branch = st.branch;
          } catch (_) {}
        }
        return {
          id: r.id,
          name: r.name,
          path: r.path,
          isPrimary: Boolean(r.isPrimary),
          exists,
          isClean,
          branch,
          isActive: r.id === registry.activeRepoId
        };
      })
    );

    res.json({
      success: true,
      activeRepoId: registry.activeRepoId,
      repositories: reposWithStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Select Active Repository
app.post('/api/repos/select', (req, res) => {
  try {
    const { repoId } = req.body;
    const registry = loadReposRegistry();
    const found = registry.repositories.find(r => r.id === repoId);
    if (!found) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }
    registry.activeRepoId = repoId;
    saveReposRegistry(registry);
    res.json({ success: true, activeRepo: found });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Clone New Repository from Remote URL
app.post('/api/repos/clone', async (req, res) => {
  try {
    const { url, name, customPath } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, error: 'Repository URL is required' });
    }

    const cleanUrl = url.trim();
    const repoName = (name && name.trim()) || cleanUrl.replace(/\.git$/, '').split('/').pop() || 'cloned-repo';
    const targetDir = customPath && customPath.trim()
      ? path.resolve(customPath.trim())
      : path.resolve(PRIMARY_REPO_ROOT, '..', repoName);

    if (fs.existsSync(targetDir)) {
      return res.status(400).json({ success: false, error: `Directory already exists: ${targetDir}` });
    }

    await gitOps.cloneRepository(targetDir, cleanUrl);

    const registry = loadReposRegistry();
    const newId = 'repo_' + Date.now();
    const newEntry = {
      id: newId,
      name: repoName,
      path: targetDir,
      remoteUrl: cleanUrl,
      isPrimary: false
    };

    registry.repositories.push(newEntry);
    registry.activeRepoId = newId;
    saveReposRegistry(registry);

    res.json({ success: true, repository: newEntry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message });
  }
});

// API: Add Existing Local Repository
app.post('/api/repos/add-local', (req, res) => {
  try {
    const { localPath, name } = req.body;
    if (!localPath || !localPath.trim()) {
      return res.status(400).json({ success: false, error: 'Local path is required' });
    }

    const resolved = path.resolve(localPath.trim());
    if (!fs.existsSync(resolved)) {
      return res.status(400).json({ success: false, error: 'Directory does not exist' });
    }

    const gitFolder = path.join(resolved, '.git');
    if (!fs.existsSync(gitFolder)) {
      return res.status(400).json({ success: false, error: 'Not a Git repository (no .git directory found)' });
    }

    const repoName = (name && name.trim()) || path.basename(resolved);
    const registry = loadReposRegistry();

    const existing = registry.repositories.find(r => path.resolve(r.path) === resolved);
    if (existing) {
      registry.activeRepoId = existing.id;
      saveReposRegistry(registry);
      return res.json({ success: true, repository: existing, alreadyExisted: true });
    }

    const newId = 'repo_' + Date.now();
    const newEntry = {
      id: newId,
      name: repoName,
      path: resolved,
      isPrimary: false
    };

    registry.repositories.push(newEntry);
    registry.activeRepoId = newId;
    saveReposRegistry(registry);

    res.json({ success: true, repository: newEntry });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Remove Repository from Registry
app.delete('/api/repos/:id', (req, res) => {
  try {
    const { id } = req.params;
    const registry = loadReposRegistry();
    const target = registry.repositories.find(r => r.id === id);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }
    if (target.isPrimary) {
      return res.status(400).json({ success: false, error: 'Cannot remove the primary host repository' });
    }

    registry.repositories = registry.repositories.filter(r => r.id !== id);
    if (registry.activeRepoId === id) {
      registry.activeRepoId = 'default';
    }
    saveReposRegistry(registry);
    res.json({ success: true, activeRepoId: registry.activeRepoId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================================================================
// Active Repository Git Operations
// ==============================================================================

// API: Repository Status
app.get('/api/status', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const status = await gitOps.getRepoStatus(activeRepo.path);
    res.json({ success: true, repoName: activeRepo.name, repoId: activeRepo.id, status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Pull Latest
app.post('/api/pull', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const result = await gitOps.pullRepo(activeRepo.path);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message || err });
  }
});

// API: Push Latest
app.post('/api/push', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const result = await gitOps.pushRepo(activeRepo.path);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message || err });
  }
});

// API: Commit Changes
app.post('/api/commit', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const { message, files } = req.body;
    const result = await gitOps.commitRepo(activeRepo.path, message, files);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message || err });
  }
});

// API: Quick Sync (Pull -> Commit -> Push)
app.post('/api/sync', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const { message } = req.body;
    const result = await gitOps.syncWorkflow(activeRepo.path, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Get or Set Remote
app.get('/api/remote', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const url = await gitOps.getRemoteUrl(activeRepo.path);
    res.json({ success: true, remoteUrl: url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/remote', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const { url } = req.body;
    await gitOps.setRemoteUrl(activeRepo.path, url);
    res.json({ success: true, remoteUrl: url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get or Set Git User (Author Name & Email)
app.get('/api/git-user', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const user = await gitOps.getGitUser(activeRepo.path);
    res.json({ success: true, ...user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/git-user', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const { name, email } = req.body;
    const result = await gitOps.setGitUser(activeRepo.path, name, email);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Execute Custom Git Command
app.post('/api/exec', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const { command } = req.body;
    const result = await gitOps.executeCustomGit(activeRepo.path, command);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message || err });
  }
});

// API: Commit History
app.get('/api/history', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const count = parseInt(req.query.count, 10) || 20;
    const history = await gitOps.getHistory(activeRepo.path, count);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: File or Repo Diff
app.get('/api/diff', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const filePath = req.query.file || '';
    const diff = await gitOps.getFileDiff(activeRepo.path, filePath);
    res.json({ success: true, file: filePath, diff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Check Upstream Engine Updates (always checks engine in PRIMARY_REPO_ROOT)
app.get('/api/engine/status', async (req, res) => {
  try {
    const status = await gitOps.checkEngineUpdates(PRIMARY_REPO_ROOT);
    res.json(status);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Apply Upstream Engine Update (always updates engine in PRIMARY_REPO_ROOT)
app.post('/api/engine/update', async (req, res) => {
  try {
    const result = await gitOps.applyEngineUpdate(PRIMARY_REPO_ROOT);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Browse Files
app.get('/api/files', (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const folder = req.query.folder || '';
    const files = gitOps.listRepositoryFiles(activeRepo.path, folder);
    res.json({ success: true, files, currentFolder: folder });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// API: Read Text File
app.get('/api/file', (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    const content = gitOps.readSafeFile(activeRepo.path, filePath);
    res.json({ success: true, path: filePath, content });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// API: Save or Update Markdown Note / Text File
app.post('/api/note', async (req, res) => {
  try {
    const activeRepo = getActiveRepo(req);
    const { filePath, content, autoCommit, commitMessage } = req.body;
    if (!filePath || typeof content !== 'string') {
      return res.status(400).json({ error: 'filePath and content are required' });
    }

    gitOps.writeSafeFile(activeRepo.path, filePath, content);

    let gitResult = null;
    if (autoCommit) {
      const msg = commitMessage || `docs: update note ${path.basename(filePath)}`;
      gitResult = await gitOps.commitRepo(activeRepo.path, msg, [filePath]);
    }

    res.json({ success: true, path: filePath, gitResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Upload Paper or File
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const activeRepo = getActiveRepo(req);
    const relPath = path.relative(activeRepo.path, req.file.path).replace(/\\/g, '/');
    let gitResult = null;

    if (req.body.autoCommit === 'true') {
      const msg = req.body.commitMessage || `feat: add document ${req.file.filename}`;
      gitResult = await gitOps.commitRepo(activeRepo.path, msg, [relPath]);
    }

    res.json({
      success: true,
      filename: req.file.filename,
      path: relPath,
      size: req.file.size,
      gitResult
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// Serve static frontend
app.use(express.static(WEB_DIR));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(WEB_DIR, 'index.html'));
});

// Helper to get local network IP
function getLanIp() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!iface.address.startsWith('169.254.') && !iface.address.startsWith('192.168.56.')) {
          return iface.address;
        }
      }
    }
  }
  return '127.0.0.1';
}

// Start listening with automatic port failover
function startServer(targetPort, attemptsLeft = 10) {
  const currentPort = targetPort;
  const srv = app.listen(currentPort, HOST, () => {
    const lanIp = getLanIp();
    const pinQuery = config.pin ? `?pin=${config.pin}` : '';
    const mobileUrl = `http://${lanIp}:${currentPort}/${pinQuery}`;
    const localUrl = `http://localhost:${currentPort}/${pinQuery}`;

    console.log('\n  gitmobile');
    console.log('  ---------');
    console.log(`  Repository: ${PRIMARY_REPO_ROOT}`);
    console.log(`  PIN Auth:   ${config.pin ? 'Enabled (' + config.pin + ')' : 'Disabled'}`);
    if (currentPort !== PORT) {
      console.log(`  Port:       ${currentPort} (initial port ${PORT} was busy)`);
    }

    // Ensure upstream repository remote is registered in the background
    gitOps.ensureUpstreamRemote(PRIMARY_REPO_ROOT).catch(() => {});

    // Print Terminal ASCII QR Code
    try {
      const qrcode = require('qrcode-terminal');
      console.log('\n  Scan with phone camera:\n');
      qrcode.generate(mobileUrl, { small: true }, (qr) => {
        console.log(qr.split('\n').map(line => '  ' + line).join('\n'));
      });
    } catch (_) {}

    console.log('\n  Mobile URL: ' + mobileUrl);
    console.log('  Local URL:  ' + localUrl + '\n');

    // Termux auto-launch check
    if (process.env.TERMUX_VERSION || fs.existsSync('/data/data/com.termux')) {
      console.log('  [Termux] Launching mobile browser...');
      const { exec } = require('child_process');
      exec(`termux-open-url ${localUrl}`, () => {});
    }
  });

  srv.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (attemptsLeft > 0) {
        startServer(currentPort + 1, attemptsLeft - 1);
      } else {
        console.error(`\n  [Error] Port ${PORT} and subsequent fallback ports are all in use.\n`);
        process.exit(1);
      }
    } else {
      console.error('\n  [Server Error]', err.message);
      process.exit(1);
    }
  });
}

startServer(PORT);
