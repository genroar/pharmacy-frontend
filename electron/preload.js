const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  getLogFilePath: () => ipcRenderer.invoke('get-log-file-path'),
  getStorageInfo: () => ipcRenderer.invoke('get-storage-info'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  getPlatform: () => ipcRenderer.invoke('get-platform'),
  isPackaged: () => ipcRenderer.invoke('is-packaged'),
  sendMessage: (message) => ipcRenderer.send('message', message),
  onMessage: (callback) => ipcRenderer.on('message', callback),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  setWindowState: (state) => ipcRenderer.send('set-window-state', state),
  // File download/save functions
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  getDownloadsPath: () => ipcRenderer.invoke('get-downloads-path')
});

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window')
});

contextBridge.exposeInMainWorld('nodeAPI', {
  getCwd: () => process.cwd(),
  getEnv: (key) => process.env[key],
  getProcessInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron
  })
});

contextBridge.exposeInMainWorld('appInfo', {
  name: 'Zapeera',
  description: 'Pharmacy Management System',
  storageInfo: {
    type: 'SQLite',
    location: '~/.zapeera/data/zapeera.db',
    persistent: true,
    note: 'Data is stored permanently and will NOT be deleted on refresh or restart'
  },
  offline: {
    supported: true,
    syncReady: true,
    note: 'App works fully offline. Data syncs when internet is available.'
  }
});
