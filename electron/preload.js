const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Example: Send a message to the main process
  sendMessage: (message) => ipcRenderer.send('message', message),
  
  // Example: Receive a message from the main process
  onMessage: (callback) => ipcRenderer.on('message', callback),
  
  // Example: Get app version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Example: Open external link
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Example: Get platform info
  getPlatform: () => process.platform,
  
  // Example: Minimize window
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  
  // Example: Maximize window
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  
  // Example: Close window
  closeWindow: () => ipcRenderer.send('close-window'),
  
  // Example: Get window state
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  
  // Example: Set window state
  setWindowState: (state) => ipcRenderer.send('set-window-state', state)
});

// Handle window controls
contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('minimize-window'),
  maximize: () => ipcRenderer.send('maximize-window'),
  close: () => ipcRenderer.send('close-window')
});

// Expose some Node.js APIs that might be useful
contextBridge.exposeInMainWorld('nodeAPI', {
  // Get current working directory
  getCwd: () => process.cwd(),
  
  // Get environment variables
  getEnv: (key) => process.env[key],
  
  // Get process info
  getProcessInfo: () => ({
    platform: process.platform,
    arch: process.arch,
    version: process.version,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    electronVersion: process.versions.electron
  })
});
