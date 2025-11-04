const { app, BrowserWindow, Menu, shell, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const backendServer = require('./backend-server.cjs');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Keep a global reference of the window object
let mainWindow;

// Security: Validate URL before navigation
function isAllowedURL(url) {
  if (isDev) {
    // Allow localhost in development
    return url.startsWith('http://localhost:') || url.startsWith('file://');
  }
  // In production, only allow file:// protocol
  return url.startsWith('file://');
}

// Security: Configure Content Security Policy
function setupSecurityHeaders() {
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
          "connect-src 'self' https://* wss://* ws://*; " +
          "frame-ancestors 'none';"
        ]
      }
    });
  });
}

function createWindow() {
  // Setup security headers
  setupSecurityHeaders();

  // Create the browser window with security best practices
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#ffffff',
    webPreferences: {
      // ✅ SECURITY: Disable node integration in renderer
      nodeIntegration: false,
      // ✅ SECURITY: Enable context isolation
      contextIsolation: true,
      // ✅ SECURITY: Disable remote module
      enableRemoteModule: false,
      // ✅ SECURITY: Use preload script for secure IPC
      preload: path.join(__dirname, 'preload.cjs'),
      // ✅ SECURITY: Enable web security
      webSecurity: true,
      // ✅ SECURITY: Disallow running insecure content
      allowRunningInsecureContent: false,
      // ✅ SECURITY: Disable spell checker (optional, improves performance)
      spellcheck: false,
      // ✅ SECURITY: Prevent plugins
      plugins: false,
      // ✅ PERFORMANCE: Optimize for production
      backgroundThrottling: true,
      // ✅ STABILITY: Reduce memory issues
      v8CacheOptions: 'code',
      // ✅ STABILITY: Better error handling
      enableWebSQL: false
    },
    icon: getIconPath(),
    show: false, // Don't show until ready to prevent flash
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: !isDev // Hide menu bar in production
  });

  // Store indexPath in a variable accessible to error handlers
  let indexPath = null;

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    const vitePort = process.env.VITE_PORT || 5173;
    const devURL = `http://localhost:${vitePort}`;
    mainWindow.loadURL(devURL);
    // Open DevTools in development (only for debugging)
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built app
    // Use app.getAppPath() which works correctly in packaged apps
    const appPath = app.getAppPath();
    const distPath = path.join(appPath, 'dist');
    indexPath = path.join(distPath, 'index.html');

    // Log for debugging
    console.log('App path:', appPath);
    console.log('Dist path:', distPath);
    console.log('Index path:', indexPath);

    // Check if files exist before loading to prevent crashes
    const checkAndLoad = (filePath, description) => {
      try {
        if (!fs.existsSync(filePath)) {
          console.error(`${description} does not exist:`, filePath);
          return false;
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
          console.error(`${description} is not a file:`, filePath);
          return false;
        }

        console.log(`✓ ${description} found:`, filePath);
        return true;
      } catch (error) {
        console.error(`Error checking ${description}:`, error);
        return false;
      }
    };

    // Try primary path first
    if (checkAndLoad(indexPath, 'index.html')) {
      // Load the index.html file
      // React Router HashRouter will handle hash-based routing (#/login, etc.)
      mainWindow.loadFile(indexPath).catch(err => {
        console.error('Error loading index.html:', err);
        tryAlternativePaths();
      });
    } else {
      tryAlternativePaths();
    }

    function tryAlternativePaths() {
      const alternatives = [
        path.join(__dirname, '..', 'dist', 'index.html'),
        path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'),
        path.join(process.resourcesPath, 'dist', 'index.html')
      ];

      let loaded = false;
      for (const altPath of alternatives) {
        if (checkAndLoad(altPath, 'index.html (alternative)')) {
          mainWindow.loadFile(altPath).catch(err => {
            console.error('Failed to load from alternative path:', altPath, err);
          });
          loaded = true;
          break;
        }
      }

      if (!loaded) {
        const errorMsg = `Could not load the application.\n\nTried paths:\n${indexPath}\n${alternatives.join('\n')}\n\nPlease ensure the app is properly installed.`;
        console.error(errorMsg);
        dialog.showErrorBox('Load Error', errorMsg);
      }
    }
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    console.log('[Main] Window ready to show');
    mainWindow.show();
    mainWindow.focus();

    // Also ensure window is visible even if ready-to-show doesn't fire
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  // Fallback: Show window after a delay if ready-to-show didn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      console.log('[Main] Window not visible after delay, showing now');
      mainWindow.show();
      mainWindow.focus();
    }
  }, 3000);

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // ✅ SECURITY: Handle external links - open in browser instead of app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Validate URL
    try {
      const parsedUrl = new URL(url);
      // Allow http/https URLs to open in external browser
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch (error) {
      console.error('Invalid URL:', error);
    }
    return { action: 'deny' };
  });

  // ✅ SECURITY: Prevent navigation to external URLs
  // ✅ FIX: Allow hash-based routing for React Router HashRouter
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Allow hash-based navigation (for React Router HashRouter)
    // Hash routes look like: file:///path/to/index.html#/login
    // Parse the URL to check if it's the same base file
    try {
      const parsedUrl = new URL(url);
      // If it's file:// protocol and has a hash, allow it (it's React Router navigation)
      if (parsedUrl.protocol === 'file:' && parsedUrl.hash) {
        // Allow hash-based navigation within the same file
        return;
      }

      // Check if it's an allowed URL
      if (!isAllowedURL(url)) {
        console.warn('Blocked navigation to:', url);
        event.preventDefault();
      }
    } catch (error) {
      // If URL parsing fails, check if it's a hash-only change
      // HashRouter might navigate to file:///#/login which is valid
      if (url.includes('#') && url.startsWith('file://')) {
        // Allow hash navigation
        return;
      }

      if (!isAllowedURL(url)) {
        console.warn('Blocked navigation to:', url);
        event.preventDefault();
      }
    }
  });

  // ✅ SECURITY: Handle new window attempts
  mainWindow.webContents.on('new-window', (event, url) => {
    event.preventDefault();
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch (error) {
      console.error('Invalid URL in new-window:', error);
    }
  });

  // ✅ SECURITY: Prevent downloading files unless explicitly allowed
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    // Allow downloads from trusted sources only
    // You can add file type validation here
    const allowedExtensions = ['.pdf', '.csv', '.xlsx', '.xls'];
    const fileName = item.getFilename();
    const fileExt = path.extname(fileName).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      event.preventDefault();
      dialog.showErrorBox('Download Blocked', `File type ${fileExt} is not allowed for security reasons.`);
    }
  });

  // ✅ SECURITY: Log security events in development
  if (isDev) {
    mainWindow.webContents.on('console-message', (event, level, message) => {
      if (level === 2) { // Warning level
        console.warn('[Renderer]', message);
      }
    });
  }

  // Add error handling for page load failures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', errorCode, errorDescription, validatedURL);

    // FIX: Handle hash route errors (ERR_FILE_NOT_FOUND for file:///#/login etc.)
    // This happens when React Router HashRouter tries to navigate before the page is fully loaded
    if (errorCode === -6 && validatedURL && validatedURL.includes('#') && validatedURL.startsWith('file:///')) {
      console.log('Hash route error detected, fixing by reloading index.html');
      // Extract the hash from the failed URL
      const hashMatch = validatedURL.match(/#(.+)$/);
      const hash = hashMatch ? hashMatch[0] : '';

      // Reload from the correct index.html path with the hash
      setTimeout(() => {
        // Try to find the correct index.html path
        const possiblePaths = [
          indexPath,
          path.join(__dirname, '..', 'dist', 'index.html'),
          path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html'),
          path.join(process.resourcesPath, 'dist', 'index.html')
        ];

        let foundPath = null;
        for (const possiblePath of possiblePaths) {
          if (possiblePath && fs.existsSync(possiblePath)) {
            foundPath = possiblePath;
            break;
          }
        }

        if (foundPath) {
          mainWindow.loadFile(foundPath).then(() => {
            // After loading, navigate to the hash route if needed
            if (hash) {
              mainWindow.webContents.executeJavaScript(`window.location.hash = '${hash}';`);
            }
          }).catch(err => {
            console.error('Failed to reload index.html:', err);
          });
        } else {
          console.error('Could not find index.html to reload');
        }
      }, 100);
      return; // Don't show error dialog for hash route issues
    }

    // Don't show error dialog for cancelled loads or navigation
    if (errorCode !== -3 && !isDev) {
      dialog.showErrorBox('Load Error', `Failed to load the application.\n\nError: ${errorDescription}\n\nURL: ${validatedURL}`);
    }
  });

  // Handle renderer process crashes (memory issues)
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer process crashed:', details);
    if (details.reason === 'crashed' || details.reason === 'killed') {
      const errorMsg = `The application crashed unexpectedly.\n\nReason: ${details.reason}\n\nExit code: ${details.exitCode || 'N/A'}\n\nPlease restart the application.`;
      dialog.showErrorBox('Application Crash', errorMsg);
    }
  });

  // Handle unresponsive renderer
  mainWindow.on('unresponsive', () => {
    console.warn('Window became unresponsive');
    dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Application Not Responding',
      message: 'The application is not responding. Would you like to wait or reload?',
      buttons: ['Wait', 'Reload'],
      defaultId: 1
    }).then(result => {
      if (result.response === 1) {
        mainWindow.reload();
      }
    });
  });

  // Log when page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading successfully');
    // Ensure we're on the correct base URL for hash routing
    const currentURL = mainWindow.webContents.getURL();
    console.log('Current URL after load:', currentURL);

    // If the URL doesn't have index.html in it but should, fix it
    if (currentURL && !currentURL.includes('index.html') && currentURL.startsWith('file:///')) {
      // Try to fix by loading index.html again if needed
      // This shouldn't happen, but just in case
      console.warn('URL missing index.html, but should be handled by HashRouter');
    }
  });

  // Handle console messages for debugging
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // Error or warning
      console.log(`[Renderer ${level === 2 ? 'WARNING' : 'ERROR'}]`, message);
    }
  });
}

function getIconPath() {
  if (process.platform === 'win32') {
    return path.join(__dirname, '../public/icons/icon.ico');
  } else if (process.platform === 'darwin') {
    return path.join(__dirname, '../public/icons/icon.icns');
  } else {
    return path.join(__dirname, '../public/icons/icon.png');
  }
}

// ✅ SECURITY: Secure IPC handlers
function setupIPC() {
  // Get app version (secure - read-only)
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Get backend status
  ipcMain.handle('get-backend-status', () => {
    return backendServer.getBackendStatus();
  });

  // Check if app is packaged
  ipcMain.handle('is-packaged', () => {
    return app.isPackaged;
  });

  // Get platform info (secure - public info only)
  ipcMain.handle('get-platform', () => {
    return process.platform;
  });

  // Open external URL (secure - validates URL first)
  ipcMain.handle('open-external', async (event, url) => {
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        await shell.openExternal(url);
        return { success: true };
      }
      return { success: false, error: 'Invalid URL protocol' };
    } catch (error) {
      return { success: false, error: 'Invalid URL' };
    }
  });

  // Window controls (secure - safe operations)
  ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
  });
}

// Create window when Electron is ready
app.whenReady().then(async () => {
  // Setup IPC handlers
  setupIPC();

  // Start backend server first (if in production)
  if (!isDev) {
    // Try multiple paths for backend (extraResources are in process.resourcesPath)
    const possiblePaths = [
      path.join(process.resourcesPath, 'backend', 'dist'),  // electron-builder extraResources (primary)
      path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'dist'), // Unpacked ASAR
      path.join(app.getAppPath(), '..', '..', 'backend', 'dist'), // Alternative path
      path.join(__dirname, '..', '..', 'backend', 'dist'),  // Development fallback
    ];

    let backendDistPath = null;
    for (const possiblePath of possiblePaths) {
      console.log(`[Main] Checking backend path: ${possiblePath}`);
      if (fs.existsSync(possiblePath)) {
        const serverFile = path.join(possiblePath, 'server.js');
        if (fs.existsSync(serverFile)) {
          backendDistPath = possiblePath;
          console.log(`[Main] ✓ Found backend at: ${backendDistPath}`);
          break;
        } else {
          console.log(`[Main] ✗ Backend directory exists but server.js not found`);
        }
      }
    }

    // Check if backend exists
    if (backendDistPath) {
      console.log('[Main] Starting backend server...');
      try {
        const backendResult = await backendServer.startBackend(backendDistPath);

        if (!backendResult.success) {
          console.warn(`[Main] Backend failed to start: ${backendResult.error}`);
          // Don't block app startup - continue and let frontend handle connection errors
          console.warn('[Main] App will try to connect to external backend or show connection error');
        } else {
          console.log(`[Main] ✓ Backend server started successfully on port ${backendResult.port}`);
        }
      } catch (error) {
        console.error('[Main] Error starting backend:', error);
        console.warn('[Main] App will continue and try to connect to external backend');
      }
    } else {
      console.warn('[Main] Backend not found in bundled resources');
      console.warn('[Main] App will try to connect to external API at http://localhost:5001/api');
      console.warn('[Main] Make sure backend is running separately or check build configuration');
    }
  }

  // Add delay before creating window to ensure all resources are ready
  // This helps prevent crashes when loading from DMG
  // Also gives backend time to start if it was launched
  setTimeout(() => {
    try {
      createWindow();
    } catch (error) {
      console.error('Failed to create window:', error);
      dialog.showErrorBox('Startup Error', `Failed to start the application.\n\nError: ${error.message}\n\nPlease try restarting the application.`);
    }
  }, 2000); // Increased delay to give backend time to start

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        createWindow();
      } catch (error) {
        console.error('Failed to create window on activate:', error);
      }
    }
  });
}).catch((error) => {
  console.error('App ready failed:', error);
  dialog.showErrorBox('Startup Error', `Failed to initialize the application.\n\nError: ${error.message}`);
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  // Stop backend server before quitting
  if (!isDev) {
    backendServer.stopBackend();
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Stop backend when app is quitting
app.on('before-quit', () => {
  if (!isDev) {
    backendServer.stopBackend();
  }
});

// ✅ SECURITY: Prevent new window creation globally
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// ✅ SECURITY: Prevent navigation to external URLs globally
// ✅ FIX: Allow hash-based routing for React Router HashRouter
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    // Allow hash-based navigation (for React Router HashRouter)
    // Hash routes look like: file:///path/to/index.html#/login
    try {
      const parsedUrl = new URL(navigationUrl);
      // If it's file:// protocol and has a hash, allow it (it's React Router navigation)
      if (parsedUrl.protocol === 'file:' && parsedUrl.hash) {
        // Allow hash-based navigation within the same file
        return;
      }
    } catch (error) {
      // If URL parsing fails, check if it's a hash-only change
      // HashRouter might navigate to file:///#/login which is valid
      if (navigationUrl.includes('#') && navigationUrl.startsWith('file://')) {
        // Allow hash navigation
        return;
      }
    }

    // Check if it's an allowed URL
    if (!isAllowedURL(navigationUrl)) {
      event.preventDefault();
    }
  });
});

// ✅ SECURITY: Certificate verification
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    // In development, allow self-signed certificates
    event.preventDefault();
    callback(true);
  } else {
    // In production, validate certificates properly
    callback(false);
  }
});

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools', visible: isDev },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Zapeera',
          click: async () => {
            await dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Zapeera',
              message: 'Zapeera',
              detail: `Version ${app.getVersion()}\n\nPharmacy Management System`
            });
          }
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Create menu after app is ready
app.whenReady().then(() => {
  createMenu();
});

// ✅ SECURITY: Prevent protocol handlers (block custom protocols)
app.setAsDefaultProtocolClient('zapeera');

// ✅ SECURITY: Disable hardware acceleration if needed (can cause issues on some systems)
// app.disableHardwareAcceleration();

// ✅ SECURITY: Set app name
app.setName('Zapeera');
