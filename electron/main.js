const { app, BrowserWindow, Menu, shell, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');

// 🔥 MUST — embedded-server ko lazy load karo (warna module load time par error ho sakta hai)
// Embedded-server automatically initializes database and creates tables
// CRITICAL: Lazy load to prevent syntax errors during module load
let startServer, stopServer;
let embeddedServerModule = null;

function loadEmbeddedServer() {
  if (embeddedServerModule) return embeddedServerModule;

  // Helper to use log function if available, otherwise console
  const logMsg = (level, msg) => {
    if (typeof log === 'function') {
      log(level, msg);
    } else {
      console.log(`[Main] ${level}: ${msg}`);
    }
  };

  try {
    // CRITICAL: Use absolute path resolution for both dev and production
    // In production (packaged), __dirname points to the asar archive location
    const embeddedServerPath = path.join(__dirname, 'embedded-server.js');
    logMsg('INFO', `Loading embedded-server from: ${embeddedServerPath}`);
    logMsg('INFO', `File exists: ${fs.existsSync(embeddedServerPath)}`);
    logMsg('INFO', `isDev: ${isDev}, isPackaged: ${app.isPackaged}`);

    // Try to load the module
    embeddedServerModule = require(embeddedServerPath);

    if (!embeddedServerModule || !embeddedServerModule.startServer) {
      throw new Error('Embedded server module loaded but startServer function not found');
    }

    startServer = embeddedServerModule.startServer;
    stopServer = embeddedServerModule.stopServer;
    logMsg('INFO', '✅ Embedded server module loaded successfully');
    return embeddedServerModule;
  } catch (error) {
    logMsg('ERROR', `Failed to load embedded-server: ${error.message}`);
    logMsg('ERROR', `Error stack: ${error.stack}`);
    logMsg('ERROR', `__dirname: ${__dirname}`);
    logMsg('ERROR', `Tried path: ${path.join(__dirname, 'embedded-server.js')}`);

    // Try alternative path (for asar unpacked files)
    try {
      const altPath = path.join(process.resourcesPath || __dirname, 'electron', 'embedded-server.js');
      logMsg('INFO', `Trying alternative path: ${altPath}`);
      if (fs.existsSync(altPath)) {
        embeddedServerModule = require(altPath);
        startServer = embeddedServerModule.startServer;
        stopServer = embeddedServerModule.stopServer;
        logMsg('INFO', '✅ Embedded server loaded from alternative path');
        return embeddedServerModule;
      }
    } catch (altError) {
      logMsg('ERROR', `Alternative path also failed: ${altError.message}`);
    }

    // Provide fallback functions to prevent crashes
    startServer = async () => {
      log('ERROR', '[Main] Embedded server not available - cannot start');
      return null;
    };
    stopServer = () => {
      log('WARN', '[Main] Stop server called but server not available');
    };
    return null;
  }
}

// ============================================================
// GLOBAL REFERENCES
// ============================================================
let mainWindow = null;
let embeddedServer = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = 5001;

// Persistent data directory
const APP_DATA_DIR = path.join(os.homedir(), '.zapeera');
const DATA_DIR = path.join(APP_DATA_DIR, 'data');
const LOG_DIR = path.join(APP_DATA_DIR, 'logs');
const SQLITE_DB_PATH = path.join(DATA_DIR, 'zapeera.db');

const logFile = path.join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);

// ============================================================
// DIRECTORY SETUP
// ============================================================
function ensureDirectories() {
  [APP_DATA_DIR, DATA_DIR, LOG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        log('INFO', `Created directory: ${dir}`);
      } catch (err) {
        console.error(`Failed to create ${dir}:`, err);
      }
    }
  });
}
ensureDirectories();

// ============================================================
// LOGGING
// ============================================================
function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  try {
    fs.appendFileSync(logFile, logMessage + '\n', 'utf8');
  } catch (err) {}
}

// ============================================================
// ERROR HANDLING
// ============================================================
// CRITICAL: Prevent error popups on Windows - log errors silently
process.on('uncaughtException', (error) => {
  if (error.code === 'EPIPE') return;
  const errorMsg = error.message || String(error);
  const errorStack = error.stack || '';

  // Log to file and console (no popup)
  log('ERROR', `Uncaught Exception: ${errorMsg}`);
  if (errorStack) {
    log('ERROR', `Stack: ${errorStack}`);
  }

  // Don't show dialog - just log and continue
  // App should continue running even if there's an error
});

process.on('unhandledRejection', (reason) => {
  if (reason && reason.code === 'EPIPE') return;
  const reasonMsg = reason?.message || String(reason);

  // Log to file and console (no popup)
  log('ERROR', `Unhandled Rejection: ${reasonMsg}`);

  // Don't show dialog - just log and continue
});

// ============================================================
// PATH FUNCTIONS
// ============================================================
function getFrontendPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'dist', 'index.html');
  }

  const possiblePaths = [
    path.join(process.resourcesPath, 'frontend-pharmachy', 'dist', 'index.html'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'frontend-pharmachy', 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      log('INFO', `Found frontend at: ${p}`);
      return p;
    }
  }

  const asarPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(asarPath)) {
    return asarPath;
  }

  log('WARN', 'Frontend not found in expected locations');
  return possiblePaths[0];
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

function getIconPath() {
  const possiblePaths = isDev
    ? [
        path.join(__dirname, '..', 'public', 'icons', 'icon.ico'),
        path.join(__dirname, '..', 'public', 'icons', 'icon.png'),
        path.join(__dirname, '..', 'public', 'images', 'favicon.png')
      ]
    : [
        path.join(process.resourcesPath, 'frontend-pharmachy', 'dist', 'icons', 'icon.ico'),
        path.join(process.resourcesPath, 'frontend-pharmachy', 'dist', 'icons', 'icon.png'),
        path.join(process.resourcesPath, 'frontend-pharmachy', 'dist', 'images', 'favicon.png'),
        path.join(__dirname, '..', 'dist', 'icons', 'icon.ico'),
        path.join(__dirname, '..', 'dist', 'icons', 'icon.png')
      ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      log('INFO', `Using icon: ${iconPath}`);
      return iconPath;
    }
  }
  log('WARN', 'No icon found');
  return undefined;
}

// ============================================================
// BACKEND FUNCTIONS
// ============================================================
function checkBackendHealth() {
  return new Promise((resolve) => {
    const timeout = process.platform === 'win32' && app.isPackaged ? 10000 : 3000;
    const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/health`, { timeout }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForBackend(maxAttempts = 30) {
  const waitInterval = process.platform === 'win32' && app.isPackaged ? 2000 : 500;

  for (let i = 0; i < maxAttempts; i++) {
    if (await checkBackendHealth()) {
      log('INFO', `✅ Backend health check passed after ${i + 1} attempts`);
      return true;
    }
    if (i < maxAttempts - 1) {
      log('INFO', `Backend not ready yet, waiting... (${i + 1}/${maxAttempts})`);
    }
    await new Promise(r => setTimeout(r, waitInterval));
  }
  log('WARN', `Backend health check failed after ${maxAttempts} attempts`);
  return false;
}

/**
 * Start embedded server (PRIMARY server)
 * Uses sql.js - pure JavaScript, no native modules needed
 */
async function startEmbeddedServer() {
  log('INFO', '='.repeat(60));
  log('INFO', '=== Starting Embedded Server ===');
  log('INFO', '='.repeat(60));
  log('INFO', `Platform: ${process.platform}`);
  log('INFO', `Database Path: ${SQLITE_DB_PATH}`);
  log('INFO', `Port: ${BACKEND_PORT}`);

  try {
    // Lazy load embedded-server module (prevents syntax errors during module load)
    if (!embeddedServerModule) {
      log('INFO', 'Loading embedded-server module...');
      loadEmbeddedServer();
      if (!startServer) {
        log('ERROR', 'Failed to load embedded-server module');
        return false;
      }
    }

    // Check if port is already in use (might be main backend or embedded server)
    // If port is in use, that's OK - we'll use the existing server
    const portInUse = await checkBackendHealth();
    if (portInUse) {
      log('INFO', '✅ Server already running on port ' + BACKEND_PORT + ' (will use existing server)');
      // Mark embedded server as running even if it's the main backend
      // This ensures the app knows a server is available
      embeddedServer = { port: BACKEND_PORT }; // Dummy object to indicate server is available
      return true;
    }

    // Start embedded server
    // CRITICAL: Always try to start embedded server, even if port check fails
    // This ensures the app works even when main backend is stopped
    log('INFO', 'Starting embedded server (CRITICAL for offline mode)...');
    try {
      embeddedServer = await startServer(BACKEND_PORT);
    } catch (portError) {
      // Port might be in use or in TIME_WAIT state
      // Wait a moment and try again
      log('WARN', `Port ${BACKEND_PORT} might be in use, waiting 2 seconds and retrying...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        embeddedServer = await startServer(BACKEND_PORT);
      } catch (retryError) {
        log('ERROR', `Failed to start embedded server after retry: ${retryError.message}`);
        // Still try to use existing server if health check passes
        const healthCheck = await checkBackendHealth();
        if (healthCheck) {
          log('INFO', '✅ Using existing server on port ' + BACKEND_PORT);
          embeddedServer = { port: BACKEND_PORT };
          return true;
        }
        throw retryError;
      }
    }

    if (embeddedServer) {
      log('INFO', '✅ Embedded server started successfully!');
      log('INFO', `✅ API available at: http://127.0.0.1:${BACKEND_PORT}/api`);

      // Verify it's working
      await new Promise(r => setTimeout(r, 1000));
      const healthy = await checkBackendHealth();
      if (healthy) {
        log('INFO', '✅ Embedded server health check passed!');
      } else {
        log('WARN', 'Embedded server health check pending, but server should work');
      }

      return true;
    } else {
      log('ERROR', 'Failed to start embedded server');
      return false;
    }
  } catch (error) {
    log('ERROR', `Failed to start embedded server: ${error.message}`);
    if (error.stack) log('ERROR', error.stack);
    return false;
  }
}

function stopBackend() {
  log('INFO', 'Stopping embedded backend...');
  try {
    if (stopServer && typeof stopServer === 'function') {
      stopServer();
      log('INFO', '✅ Embedded server stopped successfully');
    }
    embeddedServer = null;
  } catch (e) {
    log('WARN', 'Could not stop embedded server cleanly: ' + e.message);
  }

  // Also try to close any remaining server instances
  try {
    if (embeddedServerModule && embeddedServerModule.stopServer) {
      embeddedServerModule.stopServer();
    }
  } catch (e) {
    // Ignore - server might already be stopped
  }
}

// ============================================================
// WINDOW FUNCTIONS
// ============================================================
function createWindow() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' http://localhost:* https://* ws://* wss://* http://127.0.0.1:*; " +
          "frame-ancestors 'none';"
        ]
      }
    });
  });

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
      webSecurity: true
    },
    icon: getIconPath(),
    show: false,
    autoHideMenuBar: !isDev
  });

  const frontendPath = getFrontendPath();
  log('INFO', `Loading frontend: ${frontendPath}`);

  if (fs.existsSync(frontendPath)) {
    mainWindow.loadFile(frontendPath);
  } else {
    mainWindow.loadURL(`data:text/html,<h1>Frontend not found</h1><p>${frontendPath}</p>`);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 5000);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// ============================================================
// IPC HANDLERS
// ============================================================
function setupIPC() {
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('is-packaged', () => app.isPackaged);
  ipcMain.handle('get-platform', () => process.platform);

  ipcMain.handle('get-backend-status', async () => ({
    running: await checkBackendHealth(),
    port: BACKEND_PORT,
    databasePath: SQLITE_DB_PATH
  }));

  // IPC handler to restart embedded server
  ipcMain.handle('restart-backend', async () => {
    log('INFO', 'Frontend requested backend restart...');
    try {
      // Stop existing server if running
      stopBackend();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      // Start server again
      const started = await startEmbeddedServer();
      if (started) {
        log('INFO', '✅ Backend restarted successfully');
        return { success: true, message: 'Backend restarted successfully' };
      } else {
        log('ERROR', '❌ Failed to restart backend');
        return { success: false, message: 'Failed to restart backend' };
      }
    } catch (error) {
      log('ERROR', `Backend restart error: ${error.message}`);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('get-storage-info', () => ({
    appDataDir: APP_DATA_DIR,
    dataDir: DATA_DIR,
    logDir: LOG_DIR,
    databasePath: SQLITE_DB_PATH
  }));

  ipcMain.handle('get-log-file-path', () => logFile);

  ipcMain.handle('open-external', async (event, url) => {
    await shell.openExternal(url);
    return { success: true };
  });

  ipcMain.handle('save-file', async (event, { content, filename, type }) => {
    try {
      const filters = [];
      if (type === 'html') filters.push({ name: 'HTML Files', extensions: ['html'] });
      else if (type === 'pdf') filters.push({ name: 'PDF Files', extensions: ['pdf'] });
      else if (type === 'csv') filters.push({ name: 'CSV Files', extensions: ['csv'] });
      else filters.push({ name: 'All Files', extensions: ['*'] });

      const result = await dialog.showSaveDialog(mainWindow, { defaultPath: filename, filters });
      if (result.canceled || !result.filePath) return { success: false, canceled: true };

      fs.writeFileSync(result.filePath, content, 'utf8');
      return { success: true, filePath: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-downloads-path', () => app.getPath('downloads'));
}

// ============================================================
// MENU
// ============================================================
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Zapeera',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Zapeera',
              message: `Zapeera v${app.getVersion()}`,
              detail: `Pharmacy Management System\n\nDatabase: ${SQLITE_DB_PATH}`
            });
          }
        },
        { label: 'Open Logs', click: () => shell.showItemInFolder(logFile) },
        { label: 'Open Data Folder', click: () => shell.openPath(DATA_DIR) }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' }, { type: 'separator' },
        { role: 'services' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' }, { role: 'quit' }
      ]
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ============================================================
// APP LIFECYCLE
// ============================================================
app.whenReady().then(async () => {
  log('INFO', '='.repeat(60));
  log('INFO', '=== Zapeera Starting ===');
  log('INFO', `Platform: ${process.platform}`);
  log('INFO', `Arch: ${process.arch}`);
  log('INFO', `Electron: ${process.versions.electron}`);
  log('INFO', `Node: ${process.versions.node}`);
  log('INFO', `isDev: ${isDev}`);
  log('INFO', `isPackaged: ${app.isPackaged}`);
  log('INFO', '='.repeat(60));

  setupIPC();
  createMenu();

  // CRITICAL: Start embedded server FIRST (PRIMARY server)
  // Embedded server is ALWAYS available - independent of main backend
  // PRODUCTION FIX: Start server SYNCHRONOUSLY and wait for it to be ready
  // This ensures the app works independently of IDE or external processes
  log('INFO', '='.repeat(60));
  log('INFO', 'Starting embedded server (ALWAYS AVAILABLE)...');
  log('INFO', '='.repeat(60));

  // CRITICAL: Start server BEFORE opening window
  // This ensures backend is ready when frontend loads
  let serverStarted = false;
  let attempts = 0;
  const maxAttempts = 5; // Increased retries for production reliability

  while (!serverStarted && attempts < maxAttempts) {
    attempts++;
    log('INFO', `Starting embedded server (attempt ${attempts}/${maxAttempts})...`);

    try {
      serverStarted = await startEmbeddedServer();

      if (serverStarted) {
        log('INFO', '='.repeat(60));
        log('INFO', '✅ Embedded server started successfully');
        log('INFO', `🌐 API available at: http://127.0.0.1:${BACKEND_PORT}/api`);
        log('INFO', '💡 All CRUD operations will work with SQLite');
        log('INFO', '💡 Server is running independently - IDE can be closed');
        log('INFO', '='.repeat(60));

        // Verify server is actually responding
        await new Promise(resolve => setTimeout(resolve, 500));
        const healthCheck = await checkBackendHealth();
        if (healthCheck) {
          log('INFO', '✅ Server health check passed - ready to serve requests');
        } else {
          log('WARN', '⚠️ Health check pending, but server should be ready');
        }
        break;
      } else if (attempts < maxAttempts) {
        log('WARN', `Embedded server failed to start, retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      log('ERROR', `Embedded server startup error (attempt ${attempts}): ${error.message}`);
      if (error.stack) log('ERROR', `Stack: ${error.stack}`);

      if (attempts < maxAttempts) {
        log('WARN', `Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        log('ERROR', '='.repeat(60));
        log('ERROR', '❌ Embedded server failed to start after all attempts');
        log('ERROR', '💡 App will continue but operations may fail');
        log('ERROR', '='.repeat(60));
      }
    }
  }

  // Show window AFTER server is started (or after all retries failed)
  log('INFO', 'Opening application window...');
  createWindow();

  // Start server monitoring - check every 10 seconds and restart if down
  setInterval(async () => {
    const isHealthy = await checkBackendHealth();
    if (!isHealthy && embeddedServer === null) {
      log('WARN', 'Backend server is down, attempting to restart...');
      try {
        const restarted = await startEmbeddedServer();
        if (restarted) {
          log('INFO', '✅ Backend server restarted successfully');
        } else {
          log('WARN', '⚠️ Backend server restart failed, will retry later');
        }
      } catch (error) {
        log('ERROR', `Backend restart error: ${error.message}`);
      }
    }
  }, 10000); // Check every 10 seconds

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// CRITICAL: Ensure server stops on all exit scenarios
app.on('before-quit', (event) => {
  log('INFO', 'App quitting - stopping embedded server...');
  stopBackend();
});

app.on('will-quit', (event) => {
  log('INFO', 'App will quit - ensuring server is stopped...');
  stopBackend();
});

// Handle process termination signals
process.on('SIGINT', () => {
  log('INFO', 'SIGINT received - stopping server...');
  stopBackend();
  app.quit();
});

process.on('SIGTERM', () => {
  log('INFO', 'SIGTERM received - stopping server...');
  stopBackend();
  app.quit();
});

// Handle uncaught exceptions - ensure server stops
process.on('exit', () => {
  log('INFO', 'Process exiting - stopping server...');
  stopBackend();
});

app.setName('Zapeera');
log('INFO', 'Main process initialized');
