const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const gitOps = require('./git-ops');

const app = express();

// Path configurations
const REPO_ROOT = path.resolve(__dirname, '../../');
const CONFIG_FILE = path.resolve(__dirname, '../config.json');
const WEB_DIR = path.resolve(__dirname, '../web');

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
}

const PORT = parseInt(process.env.PORT || config.port || 3000, 10);
const HOST = process.env.HOST || config.host || '0.0.0.0';

// Setup file upload handling with multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const targetFolder = req.query.folder || 'papers';
    const safeDest = path.resolve(REPO_ROOT, targetFolder);
    
    // Security check: ensure within repo
    if (!safeDest.startsWith(REPO_ROOT)) {
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
  res.json({
    repoName: path.basename(REPO_ROOT),
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

// API: Repository Status
app.get('/api/status', async (req, res) => {
  try {
    const status = await gitOps.getRepoStatus(REPO_ROOT);
    res.json({ success: true, repoName: path.basename(REPO_ROOT), status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Pull Latest
app.post('/api/pull', async (req, res) => {
  try {
    const result = await gitOps.pullRepo(REPO_ROOT);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message || err });
  }
});

// API: Push Latest
app.post('/api/push', async (req, res) => {
  try {
    const result = await gitOps.pushRepo(REPO_ROOT);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message || err });
  }
});

// API: Commit Changes
app.post('/api/commit', async (req, res) => {
  try {
    const { message, files } = req.body;
    const result = await gitOps.commitRepo(REPO_ROOT, message, files);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message || err });
  }
});

// API: Quick Sync (Pull -> Commit -> Push)
app.post('/api/sync', async (req, res) => {
  try {
    const { message } = req.body;
    const result = await gitOps.syncWorkflow(REPO_ROOT, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Get or Set Remote
app.get('/api/remote', async (req, res) => {
  try {
    const url = await gitOps.getRemoteUrl(REPO_ROOT);
    res.json({ success: true, remoteUrl: url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/remote', async (req, res) => {
  try {
    const { url } = req.body;
    await gitOps.setRemoteUrl(REPO_ROOT, url);
    res.json({ success: true, remoteUrl: url });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Execute Custom Git Command
app.post('/api/exec', async (req, res) => {
  try {
    const { command } = req.body;
    const result = await gitOps.executeCustomGit(REPO_ROOT, command);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.stderr || err.message || err });
  }
});

// API: Commit History
app.get('/api/history', async (req, res) => {
  try {
    const count = parseInt(req.query.count, 10) || 20;
    const history = await gitOps.getHistory(REPO_ROOT, count);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: File or Repo Diff
app.get('/api/diff', async (req, res) => {
  try {
    const filePath = req.query.file || '';
    const diff = await gitOps.getFileDiff(REPO_ROOT, filePath);
    res.json({ success: true, file: filePath, diff });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Check Upstream Engine Updates
app.get('/api/engine/status', async (req, res) => {
  try {
    const status = await gitOps.checkEngineUpdates(REPO_ROOT);
    res.json(status);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Apply Upstream Engine Update
app.post('/api/engine/update', async (req, res) => {
  try {
    const result = await gitOps.applyEngineUpdate(REPO_ROOT);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || err });
  }
});

// API: Browse Files
app.get('/api/files', (req, res) => {
  try {
    const folder = req.query.folder || '';
    const files = gitOps.listRepositoryFiles(REPO_ROOT, folder);
    res.json({ success: true, files, currentFolder: folder });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// API: Read Text File
app.get('/api/file', (req, res) => {
  try {
    const filePath = req.query.path;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    const content = gitOps.readSafeFile(REPO_ROOT, filePath);
    res.json({ success: true, path: filePath, content });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// API: Save or Update Markdown Note / Text File
app.post('/api/note', async (req, res) => {
  try {
    const { filePath, content, autoCommit, commitMessage } = req.body;
    if (!filePath || typeof content !== 'string') {
      return res.status(400).json({ error: 'filePath and content are required' });
    }

    gitOps.writeSafeFile(REPO_ROOT, filePath, content);

    let gitResult = null;
    if (autoCommit) {
      const msg = commitMessage || `docs: update note ${path.basename(filePath)}`;
      gitResult = await gitOps.commitRepo(REPO_ROOT, msg, [filePath]);
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

    const relPath = path.relative(REPO_ROOT, req.file.path).replace(/\\/g, '/');
    let gitResult = null;

    if (req.body.autoCommit === 'true') {
      const msg = req.body.commitMessage || `feat: add document ${req.file.filename}`;
      gitResult = await gitOps.commitRepo(REPO_ROOT, msg, [relPath]);
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
    console.log(`  Repository: ${REPO_ROOT}`);
    console.log(`  PIN Auth:   ${config.pin ? 'Enabled (' + config.pin + ')' : 'Disabled'}`);
    if (currentPort !== PORT) {
      console.log(`  Port:       ${currentPort} (initial port ${PORT} was busy)`);
    }

    // Ensure upstream repository remote is registered in the background
    gitOps.ensureUpstreamRemote(REPO_ROOT).catch(() => {});

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
