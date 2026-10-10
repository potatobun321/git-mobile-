/**
 * .gitmobile - GitHub Primer Client Logic
 */

// Check for PIN or Token in URL query string (for automatic camera QR login)
const urlParams = new URLSearchParams(window.location.search);
const pinFromUrl = urlParams.get('pin') || urlParams.get('token');
if (pinFromUrl) {
  localStorage.setItem('gitmobile_pin', pinFromUrl);
  if (window.history && window.history.replaceState) {
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }
}

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

const state = {
  currentTab: 'dashboard',
  currentFolder: '',
  authPin: localStorage.getItem('gitmobile_pin') || '',
  pinRequired: false,
  status: null,
  remoteUrl: '',
  activeRepoId: 'default',
  repositories: [],
  addRepoTab: 'clone'
};

// DOM References
const elements = {
  repoNameDisplay: document.getElementById('repoNameDisplay'),
  repoOwnerDisplay: document.getElementById('repoOwnerDisplay'),
  branchName: document.getElementById('branchName'),
  syncStatusBadge: document.getElementById('syncStatusBadge'),
  refreshBtn: document.getElementById('refreshBtn'),
  remoteBanner: document.getElementById('remoteBanner'),
  remoteDot: document.getElementById('remoteDot'),
  remoteStatusText: document.getElementById('remoteStatusText'),
  openRemoteModalBtn: document.getElementById('openRemoteModalBtn'),
  behindCount: document.getElementById('behindCount'),
  aheadCount: document.getElementById('aheadCount'),
  pendingChangesCount: document.getElementById('pendingChangesCount'),
  pendingCounterLabel: document.getElementById('pendingCounterLabel'),
  changesBadge: document.getElementById('changesBadge'),
  viewAllDiffsBtn: document.getElementById('viewAllDiffsBtn'),
  statusListContainer: document.getElementById('statusListContainer'),
  quickPapersList: document.getElementById('quickPapersList'),
  papersCount: document.getElementById('papersCount'),
  fileBreadcrumbs: document.getElementById('fileBreadcrumbs'),
  fileListContainer: document.getElementById('fileListContainer'),
  commitTimelineContainer: document.getElementById('commitTimelineContainer'),
  historyCount: document.getElementById('historyCount'),
  consoleOutput: document.getElementById('consoleOutput'),
  toastContainer: document.getElementById('toastContainer'),

  // Buttons & Inputs
  quickSyncBtn: document.getElementById('quickSyncBtn'),
  pullBtn: document.getElementById('pullBtn'),
  pushBtn: document.getElementById('pushBtn'),
  openCommitModalBtn: document.getElementById('openCommitModalBtn'),
  openUploadModalBtn: document.getElementById('openUploadModalBtn'),
  confirmCommitBtn: document.getElementById('confirmCommitBtn'),
  commitMessageInput: document.getElementById('commitMessageInput'),
  saveNoteBtn: document.getElementById('saveNoteBtn'),
  notePathInput: document.getElementById('notePathInput'),
  noteContentArea: document.getElementById('noteContentArea'),
  noteAutoCommit: document.getElementById('noteAutoCommit'),
  newNoteBtn: document.getElementById('newNoteBtn'),
  clearConsoleBtn: document.getElementById('clearConsoleBtn'),

  // CLI Runner
  customGitCmdInput: document.getElementById('customGitCmdInput'),
  runCustomGitBtn: document.getElementById('runCustomGitBtn'),

  // Upload Form
  uploadForm: document.getElementById('uploadForm'),
  uploadFolderSelect: document.getElementById('uploadFolderSelect'),
  paperFileInput: document.getElementById('paperFileInput'),
  selectedFileName: document.getElementById('selectedFileName'),
  uploadAutoCommit: document.getElementById('uploadAutoCommit'),
  confirmUploadBtn: document.getElementById('confirmUploadBtn'),

  // Engine Updates
  engineUpdateBanner: document.getElementById('engineUpdateBanner'),
  engineUpdateText: document.getElementById('engineUpdateText'),
  applyEngineUpdateBtn: document.getElementById('applyEngineUpdateBtn'),
  engineStatusBadge: document.getElementById('engineStatusBadge'),
  engineStatusDesc: document.getElementById('engineStatusDesc'),
  checkEngineUpdatesBtn: document.getElementById('checkEngineUpdatesBtn'),
  updateEngineCardBtn: document.getElementById('updateEngineCardBtn'),

  // Modals
  remoteModal: document.getElementById('remoteModal'),
  remoteUrlInput: document.getElementById('remoteUrlInput'),
  saveRemoteBtn: document.getElementById('saveRemoteBtn'),
  gitUserModal: document.getElementById('gitUserModal'),
  gitUserNameInput: document.getElementById('gitUserNameInput'),
  gitUserEmailInput: document.getElementById('gitUserEmailInput'),
  openGitUserModalBtn: document.getElementById('openGitUserModalBtn'),
  saveGitUserBtn: document.getElementById('saveGitUserBtn'),
  commitModal: document.getElementById('commitModal'),
  uploadModal: document.getElementById('uploadModal'),
  diffModal: document.getElementById('diffModal'),
  diffModalTitle: document.getElementById('diffModalTitle'),
  diffContentContainer: document.getElementById('diffContentContainer'),
  fileViewerModal: document.getElementById('fileViewerModal'),
  viewerFileName: document.getElementById('viewerFileName'),
  viewerFileContent: document.getElementById('viewerFileContent'),
  openInEditorBtn: document.getElementById('openInEditorBtn'),
  pinModal: document.getElementById('pinModal'),
  pinInput: document.getElementById('pinInput'),
  submitPinBtn: document.getElementById('submitPinBtn'),
  pinErrorMsg: document.getElementById('pinErrorMsg'),

  // Multi-Repo Dropdown & Modal
  repoSelectorWrap: document.getElementById('repoSelectorWrap'),
  repoSelectorBtn: document.getElementById('repoSelectorBtn'),
  repoDropdownMenu: document.getElementById('repoDropdownMenu'),
  repoDropdownList: document.getElementById('repoDropdownList'),
  openAddRepoModalBtn: document.getElementById('openAddRepoModalBtn'),
  addRepoModal: document.getElementById('addRepoModal'),
  tabCloneRemoteBtn: document.getElementById('tabCloneRemoteBtn'),
  tabLinkLocalBtn: document.getElementById('tabLinkLocalBtn'),
  addRepoCloneSection: document.getElementById('addRepoCloneSection'),
  addRepoLocalSection: document.getElementById('addRepoLocalSection'),
  cloneRepoUrlInput: document.getElementById('cloneRepoUrlInput'),
  cloneRepoNameInput: document.getElementById('cloneRepoNameInput'),
  linkLocalPathInput: document.getElementById('linkLocalPathInput'),
  linkLocalNameInput: document.getElementById('linkLocalNameInput'),
  addRepoErrorMsg: document.getElementById('addRepoErrorMsg'),
  confirmAddRepoBtn: document.getElementById('confirmAddRepoBtn')
};

// Utilities
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2800);
}

function logToConsole(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  const time = new Date().toLocaleTimeString();
  line.textContent = `[${time}] ${message}`;
  elements.consoleOutput.appendChild(line);
  elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
}

async function apiRequest(endpoint, options = {}) {
  const headers = options.headers || {};
  if (state.authPin) {
    headers['x-gitmobile-pin'] = state.authPin;
  }
  
  try {
    const res = await fetch(endpoint, { ...options, headers });
    if (res.status === 401) {
      promptPinAuth();
      throw new Error('PIN Required');
    }
    const data = await res.json();
    if (!res.ok || data.success === false) {
      throw new Error(data.error || 'Command failed');
    }
    return data;
  } catch (err) {
    logToConsole(`Error (${endpoint}): ${err.message}`, 'error');
    throw err;
  }
}

// Tab Switching
function switchTab(tabName) {
  state.currentTab = tabName;
  document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));

  const view = document.getElementById(`view-${tabName}`);
  const nav = document.querySelector(`.nav-item[data-tab="${tabName}"]`);
  if (view) view.classList.add('active');
  if (nav) nav.classList.add('active');

  if (tabName === 'files') loadFiles(state.currentFolder);
  if (tabName === 'history') loadHistory();
  if (tabName === 'dashboard') loadRepoStatus();
}

document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.getAttribute('data-tab')));
});

function openModal(modal) { modal.classList.add('active'); }
function closeModals() {
  document.querySelectorAll('.modal').forEach(m => {
    if (m.id !== 'pinModal' || !state.pinRequired || state.authPin) m.classList.remove('active');
  });
}
function openUploadModal() {
  elements.uploadFolderSelect.value = state.currentFolder || 'papers';
  openModal(elements.uploadModal);
}

// PIN Authentication
function promptPinAuth(errorText = '') {
  if (elements.pinModal) {
    if (elements.pinErrorMsg) {
      elements.pinErrorMsg.textContent = errorText;
    }
    if (elements.pinInput) {
      elements.pinInput.value = '';
    }
    openModal(elements.pinModal);
    setTimeout(() => {
      if (elements.pinInput) elements.pinInput.focus();
    }, 200);
  }
}

async function verifyAndSavePin(pin) {
  const cleanPin = (pin || '').trim();
  if (!cleanPin) {
    if (elements.pinErrorMsg) elements.pinErrorMsg.textContent = 'Please enter your PIN';
    return false;
  }

  try {
    const res = await fetch('/api/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: cleanPin })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      state.authPin = cleanPin;
      localStorage.setItem('gitmobile_pin', cleanPin);
      elements.pinModal.classList.remove('active');
      showToast('Unlocked successfully', 'success');
      await loadRemoteInfo();
      await loadRepoStatus();
      await loadQuickPapers();
      checkEngineUpdates(true);
      return true;
    } else {
      if (elements.pinErrorMsg) {
        elements.pinErrorMsg.textContent = data.error || 'Invalid PIN. Check terminal.';
      }
      return false;
    }
  } catch (err) {
    if (elements.pinErrorMsg) elements.pinErrorMsg.textContent = err.message;
    return false;
  }
}

if (elements.submitPinBtn) {
  elements.submitPinBtn.addEventListener('click', () => {
    verifyAndSavePin(elements.pinInput ? elements.pinInput.value : '');
  });
}

if (elements.pinInput) {
  elements.pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      verifyAndSavePin(elements.pinInput.value);
    }
  });
}

// Config & Remote
async function initApp() {
  try {
    const info = await (await fetch('/api/config-info')).json();
    state.pinRequired = info.pinRequired;
    state.activeRepoId = info.repoId || 'default';
    elements.repoNameDisplay.textContent = info.repoName || 'repository';

    if (info.pinRequired && !state.authPin) {
      promptPinAuth();
    } else {
      await loadRepositories();
      await loadRemoteInfo();
      await loadRepoStatus();
      await loadQuickPapers();
      checkEngineUpdates(true);
    }
  } catch (err) {
    logToConsole('Bridge initialization failed: ' + err.message, 'error');
  }
}

// Multi-Repository Management
async function loadRepositories() {
  try {
    const res = await apiRequest('/api/repos');
    if (!res.success) return;

    state.repositories = res.repositories || [];
    state.activeRepoId = res.activeRepoId || 'default';

    const activeRepo = state.repositories.find(r => r.id === state.activeRepoId) || state.repositories[0];
    if (activeRepo) {
      elements.repoNameDisplay.textContent = activeRepo.name;
    }

    renderReposDropdown();
  } catch (_) {}
}

function renderReposDropdown() {
  if (!elements.repoDropdownList) return;
  elements.repoDropdownList.innerHTML = '';

  state.repositories.forEach(repo => {
    const item = document.createElement('div');
    item.className = `repo-dropdown-item ${repo.id === state.activeRepoId ? 'active' : ''}`;

    const info = document.createElement('div');
    info.className = 'repo-dropdown-item-info';
    info.innerHTML = `
      <span class="repo-dropdown-item-name">${repo.name}</span>
      <span class="repo-dropdown-item-path">${repo.path}</span>
    `;

    const meta = document.createElement('div');
    meta.style.display = 'flex';
    meta.style.alignItems = 'center';
    meta.style.gap = '6px';

    const badge = document.createElement('span');
    badge.className = `state-pill ${repo.isClean ? 'clean' : 'dirty'}`;
    badge.textContent = repo.isClean ? 'Clean' : 'Modified';
    meta.appendChild(badge);

    if (!repo.isPrimary) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-icon';
      delBtn.title = 'Unregister repository';
      delBtn.style.padding = '2px 4px';
      delBtn.style.fontSize = '12px';
      delBtn.innerHTML = '&times;';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeRepository(repo.id, repo.name);
      });
      meta.appendChild(delBtn);
    }

    item.appendChild(info);
    item.appendChild(meta);

    item.addEventListener('click', () => {
      if (repo.id !== state.activeRepoId) {
        switchRepository(repo.id);
      } else {
        closeRepoDropdown();
      }
    });

    elements.repoDropdownList.appendChild(item);
  });
}

function toggleRepoDropdown() {
  if (elements.repoSelectorWrap) {
    elements.repoSelectorWrap.classList.toggle('active');
  }
}

function closeRepoDropdown() {
  if (elements.repoSelectorWrap) {
    elements.repoSelectorWrap.classList.remove('active');
  }
}

document.addEventListener('click', (e) => {
  if (elements.repoSelectorWrap && !elements.repoSelectorWrap.contains(e.target)) {
    closeRepoDropdown();
  }
});

if (elements.repoSelectorBtn) {
  elements.repoSelectorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleRepoDropdown();
  });
}

if (elements.openAddRepoModalBtn) {
  elements.openAddRepoModalBtn.addEventListener('click', () => {
    closeRepoDropdown();
    switchAddRepoTab('clone');
    openModal(elements.addRepoModal);
  });
}

async function switchRepository(repoId) {
  try {
    closeRepoDropdown();
    const res = await apiRequest('/api/repos/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoId })
    });

    if (res.success) {
      state.activeRepoId = repoId;
      showToast(`Switched to ${res.activeRepo.name}`, 'info');
      logToConsole(`Switched active repository to: ${res.activeRepo.name}`, 'info');
      await loadRepositories();
      await loadRemoteInfo();
      await loadRepoStatus();
      await loadQuickPapers();
      if (state.currentTab === 'files') loadFiles('');
      if (state.currentTab === 'history') loadHistory();
    }
  } catch (err) {
    showToast('Failed to switch repository: ' + err.message, 'error');
  }
}

async function removeRepository(repoId, repoName) {
  if (!confirm(`Unregister ${repoName} from GitMobile?\n(Files on disk will NOT be deleted)`)) return;
  try {
    const res = await apiRequest(`/api/repos/${encodeURIComponent(repoId)}`, { method: 'DELETE' });
    if (res.success) {
      showToast(`Unregistered ${repoName}`, 'info');
      await loadRepositories();
      if (state.activeRepoId === repoId) {
        switchRepository(res.activeRepoId || 'default');
      }
    }
  } catch (err) {
    showToast('Failed to unregister repository: ' + err.message, 'error');
  }
}

function switchAddRepoTab(tab) {
  state.addRepoTab = tab;
  if (!elements.tabCloneRemoteBtn) return;

  if (tab === 'clone') {
    elements.tabCloneRemoteBtn.classList.add('active');
    elements.tabLinkLocalBtn.classList.remove('active');
    elements.addRepoCloneSection.style.display = 'block';
    elements.addRepoLocalSection.style.display = 'none';
    elements.confirmAddRepoBtn.textContent = 'Clone Repository';
  } else {
    elements.tabCloneRemoteBtn.classList.remove('active');
    elements.tabLinkLocalBtn.classList.add('active');
    elements.addRepoCloneSection.style.display = 'none';
    elements.addRepoLocalSection.style.display = 'block';
    elements.confirmAddRepoBtn.textContent = 'Link Repository';
  }
  if (elements.addRepoErrorMsg) elements.addRepoErrorMsg.textContent = '';
}

if (elements.tabCloneRemoteBtn) {
  elements.tabCloneRemoteBtn.addEventListener('click', () => switchAddRepoTab('clone'));
}
if (elements.tabLinkLocalBtn) {
  elements.tabLinkLocalBtn.addEventListener('click', () => switchAddRepoTab('local'));
}

if (elements.confirmAddRepoBtn) {
  elements.confirmAddRepoBtn.addEventListener('click', handleAddRepo);
}

async function handleAddRepo() {
  if (elements.addRepoErrorMsg) elements.addRepoErrorMsg.textContent = '';
  if (state.addRepoTab === 'clone') {
    const url = elements.cloneRepoUrlInput.value.trim();
    const name = elements.cloneRepoNameInput.value.trim();
    if (!url) {
      if (elements.addRepoErrorMsg) elements.addRepoErrorMsg.textContent = 'Please enter a Git repository URL';
      return;
    }

    try {
      elements.confirmAddRepoBtn.disabled = true;
      elements.confirmAddRepoBtn.textContent = 'Cloning...';
      logToConsole(`Cloning remote repository: ${url}...`, 'info');

      const res = await apiRequest('/api/repos/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name })
      });

      if (res.success) {
        showToast(`Cloned & added ${res.repository.name}`, 'success');
        logToConsole(`Repository cloned successfully to ${res.repository.path}`, 'success');
        closeModals();
        elements.cloneRepoUrlInput.value = '';
        elements.cloneRepoNameInput.value = '';
        await loadRepositories();
        await loadRemoteInfo();
        await loadRepoStatus();
        await loadQuickPapers();
      }
    } catch (err) {
      if (elements.addRepoErrorMsg) elements.addRepoErrorMsg.textContent = err.message;
    } finally {
      elements.confirmAddRepoBtn.disabled = false;
      elements.confirmAddRepoBtn.textContent = 'Clone Repository';
    }
  } else {
    const localPath = elements.linkLocalPathInput.value.trim();
    const name = elements.linkLocalNameInput.value.trim();
    if (!localPath) {
      if (elements.addRepoErrorMsg) elements.addRepoErrorMsg.textContent = 'Please enter a local directory path';
      return;
    }

    try {
      elements.confirmAddRepoBtn.disabled = true;
      elements.confirmAddRepoBtn.textContent = 'Linking...';

      const res = await apiRequest('/api/repos/add-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localPath, name })
      });

      if (res.success) {
        showToast(`Linked ${res.repository.name}`, 'success');
        closeModals();
        elements.linkLocalPathInput.value = '';
        elements.linkLocalNameInput.value = '';
        await loadRepositories();
        await loadRemoteInfo();
        await loadRepoStatus();
        await loadQuickPapers();
      }
    } catch (err) {
      if (elements.addRepoErrorMsg) elements.addRepoErrorMsg.textContent = err.message;
    } finally {
      elements.confirmAddRepoBtn.disabled = false;
      elements.confirmAddRepoBtn.textContent = 'Link Repository';
    }
  }
}

// Engine Upstream Updates
async function checkEngineUpdates(quiet = false) {
  try {
    elements.engineStatusBadge.textContent = 'Checking...';
    elements.engineStatusBadge.className = 'state-pill';
    const res = await apiRequest('/api/engine/status');
    const ver = res.currentVersion ? `v${res.currentVersion}` : 'v2.0.0';

    if (elements.engineStatusDesc) {
      elements.engineStatusDesc.textContent = `Version ${ver} • Upstream: potatobun321/git-mobile- (engine files .gitmobile, startup.bat, startup.sh)`;
    }

    if (res.updateAvailable) {
      elements.engineUpdateBanner.style.display = 'flex';
      elements.engineUpdateText.textContent = res.upstreamCommit ? `Update available: ${res.upstreamCommit}` : 'Engine update available';
      elements.engineStatusBadge.textContent = `${ver} • Update Available`;
      elements.engineStatusBadge.className = 'state-pill dirty';
      elements.updateEngineCardBtn.style.display = 'inline-block';
      if (!quiet) showToast(`New .gitmobile update available!`, 'info');
    } else {
      elements.engineUpdateBanner.style.display = 'none';
      elements.engineStatusBadge.textContent = `${ver} • Up to date`;
      elements.engineStatusBadge.className = 'state-pill clean';
      elements.updateEngineCardBtn.style.display = 'none';
      if (!quiet) showToast(`.gitmobile ${ver} is up to date with upstream.`, 'success');
    }
  } catch (err) {
    elements.engineStatusBadge.textContent = 'Check failed';
    if (!quiet) showToast('Failed to check for updates: ' + err.message, 'error');
  }
}

async function applyEngineUpdate() {
  const confirmUpdate = confirm('Update .gitmobile core engine to the latest upstream version?\\n\\nYour personal notes, papers, and repository commits will remain completely safe.');
  if (!confirmUpdate) return;

  try {
    elements.applyEngineUpdateBtn.disabled = true;
    elements.applyEngineUpdateBtn.textContent = 'Updating...';
    elements.updateEngineCardBtn.disabled = true;
    elements.updateEngineCardBtn.textContent = 'Updating...';
    logToConsole('Updating .gitmobile engine from upstream...', 'info');

    const res = await apiRequest('/api/engine/update', { method: 'POST' });
    if (res.success) {
      showToast('Engine updated! Reloading in 2s...', 'success');
      logToConsole('Engine update successful. Reloading client...', 'success');
      setTimeout(() => window.location.reload(), 2000);
    }
  } catch (err) {
    showToast('Engine update failed: ' + err.message, 'error');
    logToConsole('Engine update error: ' + err.message, 'error');
    elements.applyEngineUpdateBtn.disabled = false;
    elements.applyEngineUpdateBtn.textContent = 'Update Engine';
    elements.updateEngineCardBtn.disabled = false;
    elements.updateEngineCardBtn.textContent = 'Update to Latest';
  }
}

elements.checkEngineUpdatesBtn.addEventListener('click', () => checkEngineUpdates(false));
elements.applyEngineUpdateBtn.addEventListener('click', applyEngineUpdate);
elements.updateEngineCardBtn.addEventListener('click', applyEngineUpdate);

async function loadRemoteInfo() {
  try {
    const res = await apiRequest('/api/remote');
    state.remoteUrl = res.remoteUrl || '';
    if (state.remoteUrl) {
      elements.remoteDot.classList.add('linked');
      elements.remoteStatusText.textContent = `Remote: ${state.remoteUrl}`;
      elements.openRemoteModalBtn.textContent = 'Change';
      elements.remoteUrlInput.value = state.remoteUrl;
    } else {
      elements.remoteDot.classList.remove('linked');
      elements.remoteStatusText.textContent = 'Remote: None (Click to link)';
      elements.openRemoteModalBtn.textContent = 'Link Remote';
    }
  } catch (_) {}
}

elements.openRemoteModalBtn.addEventListener('click', () => {
  openModal(elements.remoteModal);
});

elements.saveRemoteBtn.addEventListener('click', async () => {
  const url = elements.remoteUrlInput.value.trim();
  if (!url) return;

  try {
    const res = await apiRequest('/api/remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (res.success) {
      showToast('Remote updated', 'success');
      logToConsole(`Set remote origin: ${url}`, 'success');
      closeModals();
      loadRemoteInfo();
      loadRepoStatus();
    }
  } catch (err) {
    showToast('Failed to set remote: ' + err.message, 'error');
  }
});

async function loadGitUserInfo() {
  try {
    const res = await apiRequest('/api/git-user');
    if (res.success) {
      if (elements.gitUserNameInput) elements.gitUserNameInput.value = res.name || '';
      if (elements.gitUserEmailInput) elements.gitUserEmailInput.value = res.email || '';
    }
  } catch (_) {}
}

if (elements.openGitUserModalBtn) {
  elements.openGitUserModalBtn.addEventListener('click', () => {
    loadGitUserInfo();
    openModal(elements.gitUserModal);
  });
}

if (elements.saveGitUserBtn) {
  elements.saveGitUserBtn.addEventListener('click', async () => {
    const name = elements.gitUserNameInput.value.trim();
    const email = elements.gitUserEmailInput.value.trim();
    try {
      elements.saveGitUserBtn.disabled = true;
      const res = await apiRequest('/api/git-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email })
      });
      if (res.success) {
        showToast('Git author identity saved', 'success');
        logToConsole(`Updated Git user: ${name || 'none'} <${email || 'none'}>`, 'success');
        closeModals();
      }
    } catch (err) {
      showToast('Failed to save identity: ' + err.message, 'error');
    } finally {
      elements.saveGitUserBtn.disabled = false;
    }
  });
}

// Repository Status & Dashboard
async function loadRepoStatus() {
  try {
    elements.refreshBtn.style.transform = 'rotate(180deg)';
    setTimeout(() => elements.refreshBtn.style.transform = 'none', 250);

    const data = await apiRequest('/api/status');
    if (!data.success) return;

    state.status = data.status;
    const s = data.status;

    elements.branchName.textContent = s.branch;

    if (s.isClean) {
      elements.syncStatusBadge.textContent = 'Clean';
      elements.syncStatusBadge.className = 'state-pill clean';
      elements.changesBadge.textContent = 'Clean';
      elements.changesBadge.className = 'state-pill clean';
      if (elements.viewAllDiffsBtn) elements.viewAllDiffsBtn.style.display = 'none';
    } else {
      const total = s.counts.modified + s.counts.staged + s.counts.untracked;
      elements.syncStatusBadge.textContent = `${total} Unsaved`;
      elements.syncStatusBadge.className = 'state-pill dirty';
      elements.changesBadge.textContent = `${total} changes`;
      elements.changesBadge.className = 'state-pill dirty';
      if (elements.viewAllDiffsBtn) elements.viewAllDiffsBtn.style.display = 'inline-block';
    }

    elements.behindCount.textContent = s.behind;
    elements.aheadCount.textContent = s.ahead;
    const totalPending = s.counts.modified + s.counts.staged + s.counts.untracked;
    elements.pendingChangesCount.textContent = totalPending;
    elements.pendingCounterLabel.textContent = `${totalPending} changes`;

    renderStatusList(s.files, s.isClean);
  } catch (_) {
    elements.syncStatusBadge.textContent = 'Error';
  }
}

function renderStatusList(files, isClean) {
  elements.statusListContainer.innerHTML = '';
  if (isClean) {
    elements.statusListContainer.innerHTML = '<div class="empty-state">Working tree clean. Nothing to commit.</div>';
    return;
  }

  files.staged.forEach(f => {
    const row = document.createElement('div');
    row.className = 'status-row clickable';
    row.title = 'Tap to view diff';
    row.innerHTML = `<span>${f.file}</span><span class="status-tag A">staged</span>`;
    row.addEventListener('click', () => openDiffViewer(f.file));
    elements.statusListContainer.appendChild(row);
  });

  files.modified.forEach(f => {
    const row = document.createElement('div');
    row.className = 'status-row clickable';
    row.title = 'Tap to view diff';
    row.innerHTML = `<span>${f.file}</span><span class="status-tag M">modified</span>`;
    row.addEventListener('click', () => openDiffViewer(f.file));
    elements.statusListContainer.appendChild(row);
  });

  files.untracked.forEach(f => {
    const row = document.createElement('div');
    row.className = 'status-row clickable';
    row.title = 'Tap to view diff';
    row.innerHTML = `<span>${f}</span><span class="status-tag U">untracked</span>`;
    row.addEventListener('click', () => openDiffViewer(f));
    elements.statusListContainer.appendChild(row);
  });
}

async function openDiffViewer(filePath = '') {
  elements.diffModalTitle.textContent = filePath ? `Diff: ${filePath}` : 'Working Tree Diff';
  elements.diffContentContainer.innerHTML = '<div class="diff-empty">Loading diff...</div>';
  openModal(elements.diffModal);

  try {
    const res = await apiRequest(`/api/diff?file=${encodeURIComponent(filePath)}`);
    const rawDiff = res.diff || '';
    if (!rawDiff.trim()) {
      elements.diffContentContainer.innerHTML = '<div class="diff-empty">No differences found.</div>';
      return;
    }

    elements.diffContentContainer.innerHTML = '';
    const lines = rawDiff.split('\n');
    for (const line of lines) {
      const lineEl = document.createElement('div');
      lineEl.className = 'diff-line';
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff ') || line.startsWith('index ')) {
        lineEl.classList.add('header');
      } else if (line.startsWith('+')) {
        lineEl.classList.add('add');
      } else if (line.startsWith('-')) {
        lineEl.classList.add('del');
      } else if (line.startsWith('@@')) {
        lineEl.classList.add('hunk');
      } else {
        lineEl.classList.add('ctx');
      }
      lineEl.textContent = line;
      elements.diffContentContainer.appendChild(lineEl);
    }
  } catch (err) {
    elements.diffContentContainer.innerHTML = `<div class="diff-empty" style="color:var(--danger-fg);">Failed to load diff: ${err.message}</div>`;
  }
}

// Git Actions
elements.quickSyncBtn.addEventListener('click', async () => {
  try {
    elements.quickSyncBtn.disabled = true;
    elements.quickSyncBtn.textContent = 'Syncing...';
    logToConsole('Running One-Click Sync...', 'info');

    const res = await apiRequest('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' })
    });

    if (res.logs) res.logs.forEach(l => logToConsole(l, 'success'));
    showToast('Repository synced', 'success');
    loadRepoStatus();
    loadQuickPapers();
  } catch (err) {
    showToast('Sync error: ' + err.message, 'error');
  } finally {
    elements.quickSyncBtn.disabled = false;
    elements.quickSyncBtn.textContent = 'Sync Repository';
  }
});

elements.pullBtn.addEventListener('click', async () => {
  try {
    logToConsole('Executing git pull...', 'info');
    showToast('Pulling...', 'info');
    const res = await apiRequest('/api/pull', { method: 'POST' });
    logToConsole(res.result.stdout || 'Already up to date.', 'success');
    showToast('Pull complete', 'success');
    loadRepoStatus();
  } catch (err) {
    showToast('Pull failed: ' + err.message, 'error');
  }
});

elements.pushBtn.addEventListener('click', async () => {
  try {
    logToConsole('Executing git push...', 'info');
    showToast('Pushing...', 'info');
    const res = await apiRequest('/api/push', { method: 'POST' });
    logToConsole(res.result.stdout || 'Push completed.', 'success');
    showToast('Push complete', 'success');
    loadRepoStatus();
  } catch (err) {
    showToast('Push failed: ' + err.message, 'error');
  }
});

elements.openCommitModalBtn.addEventListener('click', () => {
  elements.commitMessageInput.value = '';
  openModal(elements.commitModal);
});

elements.confirmCommitBtn.addEventListener('click', async () => {
  const message = elements.commitMessageInput.value.trim();
  if (!message) {
    showToast('Commit message required', 'error');
    return;
  }
  try {
    const res = await apiRequest('/api/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    logToConsole(res.result.stdout, 'success');
    showToast('Committed', 'success');
    closeModals();
    loadRepoStatus();
  } catch (err) {
    showToast('Commit error: ' + err.message, 'error');
  }
});

// Custom Git Command Runner (CLI)
function fillGitCmd(cmd) {
  elements.customGitCmdInput.value = cmd;
  elements.customGitCmdInput.focus();
}

async function runCustomGitCommand() {
  const cmd = elements.customGitCmdInput.value.trim();
  if (!cmd) return;

  try {
    logToConsole(`$ git ${cmd}`, 'info');
    const res = await apiRequest('/api/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: cmd })
    });

    if (res.result.stdout) logToConsole(res.result.stdout, 'success');
    if (res.result.stderr) logToConsole(res.result.stderr, 'warn');
    loadRepoStatus();
  } catch (err) {
    logToConsole(err.message, 'error');
    showToast('Command failed', 'error');
  }
}

elements.runCustomGitBtn.addEventListener('click', runCustomGitCommand);
elements.customGitCmdInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') runCustomGitCommand();
});

// Files & Upload
async function loadQuickPapers() {
  try {
    const res = await apiRequest('/api/files?folder=papers');
    if (!res.success) return;

    elements.papersCount.textContent = res.files.length;
    elements.quickPapersList.innerHTML = '';

    if (res.files.length === 0) {
      elements.quickPapersList.innerHTML = '<div class="empty-state">No research papers in papers/</div>';
      return;
    }

    res.files.forEach(f => {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.innerHTML = `
        <div class="table-row-main">
          <span>📄</span>
          <span>${f.name}</span>
        </div>
        <span class="table-row-meta">${formatBytes(f.size)}</span>
      `;
      row.onclick = () => {
        if (f.name.endsWith('.md') || f.name.endsWith('.txt')) viewFile(f.path);
      };
      elements.quickPapersList.appendChild(row);
    });
  } catch (_) {}
}

async function loadFiles(folder = '') {
  state.currentFolder = folder;
  renderBreadcrumbs(folder);

  try {
    elements.fileListContainer.innerHTML = '<div class="empty-state">Loading tree...</div>';
    const res = await apiRequest(`/api/files?folder=${encodeURIComponent(folder)}`);
    if (!res.success) return;

    elements.fileListContainer.innerHTML = '';
    if (res.files.length === 0) {
      elements.fileListContainer.innerHTML = '<div class="empty-state">Folder is empty.</div>';
      return;
    }

    res.files.forEach(item => {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.innerHTML = `
        <div class="table-row-main">
          <span>${item.isDirectory ? '📁' : '📄'}</span>
          <span>${item.name}</span>
        </div>
        <span class="table-row-meta">${item.isDirectory ? 'dir' : formatBytes(item.size)}</span>
      `;
      row.onclick = () => {
        if (item.isDirectory) loadFiles(item.path);
        else viewFile(item.path);
      };
      elements.fileListContainer.appendChild(row);
    });
  } catch (_) {}
}

function renderBreadcrumbs(folder) {
  elements.fileBreadcrumbs.innerHTML = '';
  const root = document.createElement('span');
  root.className = `crumb ${folder === '' ? 'active' : ''}`;
  root.textContent = 'root';
  root.onclick = () => loadFiles('');
  elements.fileBreadcrumbs.appendChild(root);

  if (!folder) return;
  const parts = folder.split('/');
  let pathAcc = '';
  parts.forEach((p, idx) => {
    pathAcc += (pathAcc ? '/' : '') + p;
    const sep = document.createElement('span');
    sep.textContent = ' / ';
    sep.style.color = 'var(--fg-subtle)';
    elements.fileBreadcrumbs.appendChild(sep);

    const crumb = document.createElement('span');
    crumb.className = `crumb ${idx === parts.length - 1 ? 'active' : ''}`;
    crumb.textContent = p;
    const target = pathAcc;
    crumb.onclick = () => loadFiles(target);
    elements.fileBreadcrumbs.appendChild(crumb);
  });
}

async function viewFile(path) {
  try {
    const res = await apiRequest(`/api/file?path=${encodeURIComponent(path)}`);
    elements.viewerFileName.textContent = path;
    elements.viewerFileContent.textContent = res.content;
    elements.openInEditorBtn.onclick = () => {
      elements.notePathInput.value = path;
      elements.noteContentArea.value = res.content;
      closeModals();
      switchTab('notes');
    };
    openModal(elements.fileViewerModal);
  } catch (_) {
    showToast('Binary preview not supported', 'info');
  }
}

// Upload
elements.paperFileInput.addEventListener('change', () => {
  if (elements.paperFileInput.files.length > 0) {
    elements.selectedFileName.textContent = elements.paperFileInput.files[0].name;
  }
});
elements.openUploadModalBtn.addEventListener('click', openUploadModal);

elements.confirmUploadBtn.addEventListener('click', async (e) => {
  e.preventDefault();
  const file = elements.paperFileInput.files[0];
  if (!file) return showToast('Select a file', 'error');

  const folder = elements.uploadFolderSelect.value;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('autoCommit', elements.uploadAutoCommit.checked ? 'true' : 'false');
  formData.append('commitMessage', `feat: add ${file.name}`);

  try {
    elements.confirmUploadBtn.disabled = true;
    const headers = {};
    if (state.authPin) headers['x-gitmobile-pin'] = state.authPin;

    const res = await (await fetch(`/api/upload?folder=${encodeURIComponent(folder)}`, {
      method: 'POST',
      headers,
      body: formData
    })).json();

    if (res.success) {
      showToast(`Uploaded ${res.filename}`, 'success');
      logToConsole(`Uploaded: ${res.path}`, 'success');
      closeModals();
      loadFiles(folder);
      loadQuickPapers();
      loadRepoStatus();
    }
  } catch (err) {
    showToast('Upload error', 'error');
  } finally {
    elements.confirmUploadBtn.disabled = false;
  }
});

// Notes
elements.newNoteBtn.addEventListener('click', () => {
  const d = new Date().toISOString().slice(0, 10);
  elements.notePathInput.value = `notes/note-${d}.md`;
  elements.noteContentArea.value = `# Note: ${d}\n\n- Summary:\n`;
  elements.noteContentArea.focus();
});

elements.saveNoteBtn.addEventListener('click', async () => {
  const filePath = elements.notePathInput.value.trim();
  const content = elements.noteContentArea.value;
  if (!filePath) return showToast('File path required', 'error');

  try {
    const res = await apiRequest('/api/note', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filePath,
        content,
        autoCommit: elements.noteAutoCommit.checked,
        commitMessage: `docs: update note ${filePath}`
      })
    });
    if (res.success) {
      showToast('Note saved & committed', 'success');
      logToConsole(`Saved note: ${filePath}`, 'success');
      loadRepoStatus();
    }
  } catch (err) {
    showToast('Save failed', 'error');
  }
});

// History
async function loadHistory() {
  try {
    const res = await apiRequest('/api/history?count=25');
    if (!res.success) return;

    elements.historyCount.textContent = res.history.length;
    elements.commitTimelineContainer.innerHTML = '';

    if (res.history.length === 0) {
      elements.commitTimelineContainer.innerHTML = '<div class="empty-state">No commits yet.</div>';
      return;
    }

    res.history.forEach(c => {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.innerHTML = `
        <div class="table-row-main">
          <strong>${c.subject}</strong>
        </div>
        <div class="table-row-meta">
          <code>${c.shortHash}</code> • ${c.relativeDate}
        </div>
      `;
      elements.commitTimelineContainer.appendChild(row);
    });
  } catch (_) {}
}

elements.clearConsoleBtn.addEventListener('click', () => {
  elements.consoleOutput.innerHTML = '';
});
elements.refreshBtn.addEventListener('click', () => {
  loadRepoStatus();
  loadQuickPapers();
  loadRemoteInfo();
  showToast('Refreshed', 'info');
});

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

window.addEventListener('DOMContentLoaded', initApp);
