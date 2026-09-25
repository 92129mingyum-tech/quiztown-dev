const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('QuizTownClient', {
  setGameState: state => ipcRenderer.send('game-state', state),
  onVersion: cb => ipcRenderer.on('client-version', (_e, v) => cb(v)),
  onUpdateStatus: cb => ipcRenderer.on('update-status', (_e, s) => cb(s)),
  onForceUpdate: cb => ipcRenderer.on('force-update', (_e, s) => cb(s)),
  getDisplaySettings: () => ipcRenderer.invoke('display-get'),
  applyDisplaySettings: opts => ipcRenderer.invoke('display-apply', opts),
  toggleFullscreen: () => ipcRenderer.send('display-toggle-fullscreen'),
  saveCredential: cred => ipcRenderer.invoke('credential-save', cred),
  loadCredential: () => ipcRenderer.invoke('credential-load'),
  clearCredential: () => ipcRenderer.invoke('credential-clear'),
  saveAuthSession: session => ipcRenderer.invoke('auth-session-save', session),
  loadAuthSession: () => ipcRenderer.invoke('auth-session-load'),
  clearAuthSession: () => ipcRenderer.invoke('auth-session-clear')
});
