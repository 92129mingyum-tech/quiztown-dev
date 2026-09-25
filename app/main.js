const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'update-config.json'), 'utf8'));
let mainWindow = null;
let gameActive = false;
let updateReady = false;
let downloadedUpdateInfo = null;
let installTriggered = false;
let installTimer = null;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.autoRunAppAfterInstall = true;
autoUpdater.allowDowngrade = false;
// GitHub Releases uses latest.yml. Do not set a custom 'dev' channel here.

const hasRealFeed = cfg.provider === 'github' && cfg.owner && cfg.repo;
// electron-builder embeds GitHub publish config into app-update.yml; electron-updater reads it automatically.

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1296, height: 759, minWidth: 976, minHeight: 579,
    show: false, backgroundColor: '#052653', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.loadFile(path.join(root, 'game', 'index.html'));
  mainWindow.setTitle('QuizTown');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    send('client-version', cfg.displayVersion);
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function checkUpdate() {
  if (!hasRealFeed) return;
  autoUpdater.checkForUpdates().catch(err => send('update-status', {type:'error', message:String(err.message || err)}));
}

function installDownloadedUpdate() {
  if (!updateReady || !downloadedUpdateInfo || gameActive || installTriggered || installTimer) return;

  send('update-status', {
    type: 'ready',
    version: downloadedUpdateInfo.version,
    deferred: false,
    forced: true
  });

  installTimer = setTimeout(() => {
    installTimer = null;
    if (!updateReady || !downloadedUpdateInfo || gameActive || installTriggered) return;

    installTriggered = true;
    try {
      // electron-updater 6.6.2 positional API:
      // isSilent=true hides the NSIS wizard, isForceRunAfter=true relaunches QuizTown.
      autoUpdater.quitAndInstall(true, true);
    } catch (err) {
      updateReady = false;
      send('update-status', {type:'error', message:String(err.message || err)});
    }
  }, 1200);
}

app.whenReady().then(() => {
  createWindow();
  checkUpdate();
  setInterval(checkUpdate, Number(cfg.checkIntervalMs || 60000));
});


function credentialPath(){ return path.join(app.getPath('userData'),'credential.bin'); }
ipcMain.handle('credential-save', (_e, cred={}) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption unavailable');
  const payload=JSON.stringify({id:String(cred.id||''),password:String(cred.password||'')});
  fs.writeFileSync(credentialPath(), safeStorage.encryptString(payload)); return true;
});
ipcMain.handle('credential-load', () => {
  try { if(!safeStorage.isEncryptionAvailable()||!fs.existsSync(credentialPath())) return null; return JSON.parse(safeStorage.decryptString(fs.readFileSync(credentialPath()))); } catch { return null; }
});
ipcMain.handle('credential-clear', () => { try{fs.rmSync(credentialPath(),{force:true})}catch{} return true; });

// Supabase auth session is persisted with Electron safeStorage instead of relying on file:// localStorage.
function authSessionPath(){ return path.join(app.getPath('userData'),'supabase-session.bin'); }
ipcMain.handle('auth-session-save', (_e, session=null) => {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS credential encryption unavailable');
  if (!session || !session.access_token || !session.refresh_token) return false;
  const payload = JSON.stringify({access_token:String(session.access_token), refresh_token:String(session.refresh_token)});
  fs.writeFileSync(authSessionPath(), safeStorage.encryptString(payload));
  return true;
});
ipcMain.handle('auth-session-load', () => {
  try {
    if(!safeStorage.isEncryptionAvailable() || !fs.existsSync(authSessionPath())) return null;
    return JSON.parse(safeStorage.decryptString(fs.readFileSync(authSessionPath())));
  } catch { return null; }
});
ipcMain.handle('auth-session-clear', () => { try{fs.rmSync(authSessionPath(),{force:true})}catch{} return true; });


ipcMain.on('game-state', (_e, state) => {
  gameActive = state === 'playing';
  if (!gameActive) installDownloadedUpdate();
});

ipcMain.handle('display-get', () => ({
  fullscreen: !!mainWindow?.isFullScreen(),
  contentSize: mainWindow ? mainWindow.getContentSize() : [1280,720]
}));
ipcMain.handle('display-apply', (_e, opts = {}) => {
  if (!mainWindow) return false;
  const mode = opts.mode === 'fullscreen' ? 'fullscreen' : 'windowed';
  if (mode === 'fullscreen') {
    mainWindow.setFullScreen(true);
  } else {
    mainWindow.setFullScreen(false);
    const allowed = new Set(['1280x720','1600x900','1920x1080']);
    const key = allowed.has(opts.resolution) ? opts.resolution : '1280x720';
    const [w,h] = key.split('x').map(Number);
    mainWindow.setContentSize(w,h,true);
    mainWindow.center();
  }
  return true;
});
ipcMain.on('display-toggle-fullscreen', () => { if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen()); });

autoUpdater.on('update-available', info => {
  send('update-status', {type:'available', version:info.version, forced:true});
});
autoUpdater.on('download-progress', p => send('update-status', {type:'progress', percent:Math.round(p.percent)}));
autoUpdater.on('update-downloaded', info => {
  updateReady = true;
  downloadedUpdateInfo = info;
  send('update-status', {type:'ready', version:info.version, deferred:gameActive, forced:true});
  installDownloadedUpdate();
});
autoUpdater.on('error', err => {
  if (!installTriggered) {
    updateReady = false;
    downloadedUpdateInfo = null;
  }
  send('update-status', {type:'error', message:String(err.message || err)});
});

app.on('window-all-closed', () => app.quit());
