/**
 * Backend Server Starter for Electron
 * Runs the Express backend server directly inside Electron main process
 * Works on Windows, macOS, and Linux
 * Falls back to spawning a process if direct require fails
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, fork } = require('child_process');
const { app } = require('electron');
const os = require('os');

let backendServer = null;
let backendProcess = null;
let serverInstance = null;
let isBackendRunning = false;
const BACKEND_PORT = parseInt(process.env.BACKEND_PORT || '5001', 10);

// Create log file path
const logDir = path.join(os.homedir(), '.zapeera', 'logs');
const logFile = path.join(logDir, `backend-${new Date().toISOString().split('T')[0]}.log`);

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (err) {
    console.error('[Backend] Failed to create log directory:', err);
  }
}

// Logging function that writes to both console and file
function logToFile(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;

  // Console output
  if (level === 'ERROR') {
    console.error(logMessage.trim());
  } else {
    console.log(logMessage.trim());
  }

  // File output
  try {
    fs.appendFileSync(logFile, logMessage, 'utf8');
  } catch (err) {
    // Silently fail if we can't write to log file
  }
}

/**
 * Start the backend server by directly requiring it
 * @param {string} backendPath - Path to backend dist folder
 * @returns {Promise<{success: boolean, port: number, error?: string}>}
 */
async function startBackend(backendPath) {
  try {
    const serverPath = path.join(backendPath, 'server.js');

    // Check if server file exists
    if (!fs.existsSync(serverPath)) {
      return {
        success: false,
        port: BACKEND_PORT,
        error: `Backend server not found at: ${serverPath}`
      };
    }

    // Check if backend is already running
    if (isBackendRunning) {
      console.log('[Backend] Server is already running');
      return {
        success: true,
        port: BACKEND_PORT
      };
    }

    logToFile('INFO', `Starting backend server from: ${backendPath}`);
    logToFile('INFO', `Log file location: ${logFile}`);
    console.log(`[Backend] Starting server from: ${backendPath}`);
    console.log(`[Backend] 📝 Logs are being written to: ${logFile}`);

    // Set environment variables for backend
    // Load .env file if it exists (for DATABASE_URL and other config)
    let envVars = { ...process.env };

    // Try to load .env file from backend directory
    // Works on Windows, macOS, and Linux (path.join handles platform differences)
    const envPath = path.join(backendPath, '..', '.env');
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
            }
          }
        });
      } catch (err) {
        console.warn('[Backend] Could not read .env file:', err.message);
      }
    }

    // Set backend-specific environment variables
    process.env.PORT = BACKEND_PORT.toString();
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';

    // Override environment variables from .env file
    Object.keys(envVars).forEach(key => {
      if (envVars[key] !== undefined) {
        process.env[key] = envVars[key];
      }
    });

    // Add backend node_modules to module path
    // Try multiple possible locations for node_modules
    const possibleNodeModulesPaths = [
      path.join(backendPath, '..', 'node_modules'),
      path.join(process.resourcesPath, 'backend', 'node_modules'),
      // Windows-specific
      ...(process.platform === 'win32' ? [
        path.join(path.dirname(process.execPath), 'resources', 'backend', 'node_modules'),
        path.join(path.dirname(process.execPath), 'backend', 'node_modules'),
      ] : []),
      // macOS-specific
      ...(process.platform === 'darwin' ? [
        path.join(app.getAppPath(), '..', 'Resources', 'backend', 'node_modules'),
      ] : []),
    ];

    let backendNodeModules = null;
    for (const nodeModulesPath of possibleNodeModulesPaths) {
      if (fs.existsSync(nodeModulesPath)) {
        backendNodeModules = nodeModulesPath;
        logToFile('INFO', `Found backend node_modules at: ${backendNodeModules}`);
        console.log('[Backend] Found backend node_modules at:', backendNodeModules);
        break;
      }
    }

    if (backendNodeModules) {
      // Add to NODE_PATH if not already there
      const nodePath = process.env.NODE_PATH || '';
      if (!nodePath.includes(backendNodeModules)) {
        process.env.NODE_PATH = nodePath
          ? `${nodePath}${path.delimiter}${backendNodeModules}`
          : backendNodeModules;

        // Update module paths
        if (require.main && require.main.paths) {
          require.main.paths.push(backendNodeModules);
        }

        logToFile('INFO', `Added backend node_modules to NODE_PATH: ${backendNodeModules}`);
      }
    } else {
      logToFile('WARNING', 'Backend node_modules not found. Backend may fail to start if dependencies are missing.');
      console.warn('[Backend] ⚠️  Backend node_modules not found. Searched paths:');
      possibleNodeModulesPaths.forEach(p => console.warn(`  - ${p}`));
    }

    // Use process spawn method by default for better reliability
    // This prevents Electron from crashing if backend has errors
    console.log('[Backend] Starting backend using process spawn method (recommended for stability)...');
    const spawnResult = await startBackendAsProcess(backendPath);
    return spawnResult;

  } catch (error) {
    console.error('[Backend] Error starting backend:', error);
    return {
      success: false,
      port: BACKEND_PORT,
      error: error.message
    };
  }
}

/**
 * Check if port is in use and kill the process if needed
 */
async function checkAndFreePort(port) {
  return new Promise((resolve) => {
    try {
      const net = require('net');
      const server = net.createServer();

      server.listen(port, () => {
        server.close(() => {
          logToFile('INFO', `Port ${port} is available`);
          resolve(true);
        });
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logToFile('WARNING', `Port ${port} is already in use. Attempting to free it...`);

          // Try to find and kill the process using the port
          const { execSync } = require('child_process');
          try {
            if (process.platform === 'darwin' || process.platform === 'linux') {
              // macOS/Linux: Find PID using lsof
              try {
                const pid = execSync(`lsof -ti:${port}`, { encoding: 'utf8', timeout: 2000 }).trim();
                if (pid) {
                  logToFile('INFO', `Found process ${pid} using port ${port}, killing it...`);
                  // Kill all processes using this port (in case there are multiple)
                  const pids = pid.split('\n').filter(p => p.trim());
                  pids.forEach(p => {
                    try {
                      execSync(`kill -9 ${p.trim()}`, { timeout: 2000 });
                      logToFile('INFO', `Killed process ${p.trim()}`);
                    } catch (e) {
                      logToFile('WARNING', `Could not kill process ${p.trim()}: ${e.message}`);
                    }
                  });
                  // Wait longer for port to be fully released
                  setTimeout(() => {
                    // Verify port is actually free
                    try {
                      execSync(`lsof -ti:${port}`, { encoding: 'utf8', timeout: 1000 });
                      logToFile('WARNING', `Port ${port} still in use after kill, retrying...`);
                      setTimeout(() => resolve(true), 2000);
                    } catch (e) {
                      logToFile('INFO', `Port ${port} is now free`);
                      resolve(true);
                    }
                  }, 2000);
                } else {
                  logToFile('WARNING', `Could not find process using port ${port}`);
                  resolve(false);
                }
              } catch (e) {
                // No process found, port is free
                logToFile('INFO', `No process found using port ${port}`);
                resolve(true);
              }
            } else if (process.platform === 'win32') {
              // Windows: Find PID using netstat
              const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', timeout: 2000 });
              const lines = result.split('\n').filter(line => line.includes('LISTENING'));
              if (lines.length > 0) {
                const pid = lines[0].trim().split(/\s+/).pop();
                if (pid) {
                  logToFile('INFO', `Found process ${pid} using port ${port}, killing it...`);
                  execSync(`taskkill /F /PID ${pid}`, { timeout: 2000 });
                  logToFile('INFO', `Killed process ${pid}`);
                  setTimeout(() => resolve(true), 1000);
                } else {
                  resolve(false);
                }
              } else {
                resolve(false);
              }
            }
          } catch (killError) {
            logToFile('ERROR', `Failed to kill process: ${killError.message}`);
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    } catch (error) {
      logToFile('ERROR', `Error checking port: ${error.message}`);
      resolve(false);
    }
  });
}

/**
 * Start backend as a separate process (fallback method)
 */
async function startBackendAsProcess(backendPath) {
  return new Promise(async (resolveProcess) => {
    try {
      // Aggressively kill any process using port 5001 BEFORE checking
      logToFile('INFO', `Killing any processes using port ${BACKEND_PORT}...`);
      const { execSync } = require('child_process');
      try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
          // Kill ALL processes using this port
          try {
            const pids = execSync(`lsof -ti:${BACKEND_PORT}`, { encoding: 'utf8', timeout: 2000 }).trim();
            if (pids) {
              const pidArray = pids.split('\n').filter(p => p.trim());
              pidArray.forEach(pid => {
                try {
                  logToFile('INFO', `Killing process ${pid} using port ${BACKEND_PORT}...`);
                  execSync(`kill -9 ${pid.trim()}`, { timeout: 1000 });
                } catch (e) {
                  logToFile('WARNING', `Could not kill process ${pid}: ${e.message}`);
                }
              });
              // Wait for port to be fully released
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (e) {
            // No processes found, port is free
            logToFile('INFO', `No processes found using port ${BACKEND_PORT}`);
          }
        } else if (process.platform === 'win32') {
          // Windows: Kill processes using the port
          try {
            const result = execSync(`netstat -ano | findstr :${BACKEND_PORT}`, { encoding: 'utf8', timeout: 2000 });
            const lines = result.split('\n').filter(line => line.includes('LISTENING'));
            lines.forEach(line => {
              const pid = line.trim().split(/\s+/).pop();
              if (pid) {
                try {
                  logToFile('INFO', `Killing process ${pid} using port ${BACKEND_PORT}...`);
                  execSync(`taskkill /F /PID ${pid}`, { timeout: 1000 });
                } catch (e) {
                  logToFile('WARNING', `Could not kill process ${pid}: ${e.message}`);
                }
              }
            });
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (e) {
            // No processes found
          }
        }
      } catch (error) {
        logToFile('WARNING', `Error killing processes: ${error.message}`);
      }

      // Now check and free port if needed - with retry
      logToFile('INFO', `Checking if port ${BACKEND_PORT} is available...`);

      // Try multiple times to ensure port is free
      let portFree = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        portFree = await checkAndFreePort(BACKEND_PORT);
        if (portFree) {
          // Final verification - check port is actually free
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          try {
            if (process.platform === 'darwin' || process.platform === 'linux') {
              execSync(`lsof -ti:${BACKEND_PORT}`, { encoding: 'utf8', timeout: 500 });
              // If we get here, port is still in use
              logToFile('WARNING', `Port ${BACKEND_PORT} still in use, retrying...`);
              portFree = false;
            }
          } catch (e) {
            // Port is free, continue
            logToFile('INFO', `Port ${BACKEND_PORT} verified as free`);
            break;
          }
        }
        if (portFree) break;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
      }

      if (!portFree) {
        logToFile('ERROR', `Could not free port ${BACKEND_PORT} after multiple attempts`);
        return resolveProcess({
          success: false,
          port: BACKEND_PORT,
          error: `Port ${BACKEND_PORT} is in use and could not be freed. Please close other applications using this port.`
        });
      }

      // Reserve the port by binding to it in the main process
      // This prevents other processes from grabbing it
      logToFile('INFO', `Reserving port ${BACKEND_PORT} by binding to it...`);
      const net = require('net');
      let portReserver = null;
      let portReserved = false;

      try {
        portReserver = net.createServer();
        await new Promise((resolve, reject) => {
          portReserver.listen(BACKEND_PORT, '127.0.0.1', () => {
            logToFile('INFO', `Port ${BACKEND_PORT} reserved successfully`);
            portReserved = true;
            resolve(true);
          });

          portReserver.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              logToFile('ERROR', `Port ${BACKEND_PORT} still in use after cleanup`);
              reject(new Error(`Port ${BACKEND_PORT} is still in use`));
            } else {
              reject(err);
            }
          });

          // Timeout after 2 seconds
          setTimeout(() => {
            if (!portReserved) {
              reject(new Error('Port reservation timeout'));
            }
          }, 2000);
        });
      } catch (reserveError) {
        logToFile('ERROR', `Failed to reserve port: ${reserveError.message}`);
        if (portReserver) {
          portReserver.close();
        }
        return resolveProcess({
          success: false,
          port: BACKEND_PORT,
          error: `Port ${BACKEND_PORT} could not be reserved: ${reserveError.message}`
        });
      }

      console.log('[Backend] Starting backend as separate process...');

      // Set environment variables
      const env = {
        ...process.env,
        PORT: BACKEND_PORT.toString(),
        NODE_ENV: process.env.NODE_ENV || 'production'
      };

      // Try to load .env file from multiple locations
      const envPaths = [
        path.join(backendPath, '..', '.env'),
        path.join(backendPath, '..', '..', '.env'),
        path.join(process.resourcesPath, 'backend', '.env'),
        // Windows-specific paths
        ...(process.platform === 'win32' ? [
          path.join(path.dirname(process.execPath), 'resources', 'backend', '.env'),
          path.join(path.dirname(process.execPath), 'backend', '.env'),
        ] : []),
        // macOS-specific paths
        ...(process.platform === 'darwin' ? [
          path.join(app.getAppPath(), '..', 'Resources', 'backend', '.env'),
        ] : []),
      ];

      let envLoaded = false;
      for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
          try {
            logToFile('INFO', `Loading .env file from: ${envPath}`);
            const envContent = fs.readFileSync(envPath, 'utf8');
            envContent.split('\n').forEach(line => {
              const trimmed = line.trim();
              if (trimmed && !trimmed.startsWith('#')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                  env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                }
              }
            });
            envLoaded = true;
            logToFile('INFO', '✅ .env file loaded successfully');
            break;
          } catch (err) {
            logToFile('WARNING', `Could not read .env file from ${envPath}: ${err.message}`);
          }
        }
      }

      // If no .env file found, provide default DATABASE_URL for local SQLite (fallback)
      if (!envLoaded || !env.DATABASE_URL) {
        logToFile('WARNING', 'No .env file found or DATABASE_URL not set. Using default SQLite database.');
        // Use SQLite as fallback - this allows backend to start even without DATABASE_URL
        // Users will need to set up their database, but at least backend won't crash
        if (!env.DATABASE_URL) {
          const sqlitePath = path.join(backendPath, '..', '..', 'data', 'zapeera.db');
          env.DATABASE_URL = `file:${sqlitePath}`;
          logToFile('INFO', `Using default SQLite database: ${env.DATABASE_URL}`);
        }
      }

      // Log environment variables (without sensitive data)
      logToFile('INFO', `PORT: ${env.PORT}`);
      logToFile('INFO', `NODE_ENV: ${env.NODE_ENV}`);
      logToFile('INFO', `DATABASE_URL: ${env.DATABASE_URL ? 'SET' : 'NOT SET'}`);

      const serverPath = path.join(backendPath, 'server.js');

      // Use fork() instead of spawn() - fork uses the same Node.js runtime as Electron
      // This means we don't need to find a separate Node.js executable!
      // fork() automatically uses process.execPath (Electron's Node.js)
      logToFile('INFO', 'Using child_process.fork() - no separate Node.js needed!');
      logToFile('INFO', `Server path: ${serverPath}`);
      logToFile('INFO', `Backend path: ${backendPath}`);
      logToFile('INFO', `Platform: ${process.platform}`);
      logToFile('INFO', `Node version: ${process.version}`);
      logToFile('INFO', `Electron version: ${process.versions.electron}`);
      console.log('[Backend] Using child_process.fork() - no separate Node.js needed!');
      console.log('[Backend] Server path:', serverPath);
      console.log('[Backend] Backend path:', backendPath);
      console.log('[Backend] Platform:', process.platform);

      // Close port reservation RIGHT before forking - backend will bind immediately
      // This minimizes the gap where port could be grabbed
      if (portReserver) {
        logToFile('INFO', 'Closing port reservation - backend will bind now...');
        portReserver.close(() => {
          logToFile('INFO', 'Port reservation closed');
        });
        // Small delay to ensure port is released
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Fork the backend server - this uses Electron's Node.js runtime
      // fork() is better than spawn() because:
      // 1. Uses the same Node.js runtime (no need to find node executable)
      // 2. Better IPC communication
      // 3. Works on all platforms without needing system Node.js

      // For Windows EXE, we need to ensure the executable path is set correctly
      const forkOptions = {
        cwd: backendPath,
        env: env,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        silent: false,
        detached: false
      };

      // On Windows, explicitly set execPath to ensure fork works correctly
      // This is especially important for packaged EXE files
      if (process.platform === 'win32') {
        // Use process.execPath which points to the Electron executable
        // This ensures fork() uses the correct Node.js runtime
        forkOptions.execPath = process.execPath;
        logToFile('INFO', `Windows EXE: Using execPath: ${process.execPath}`);
        console.log('[Backend] Windows EXE: Using execPath:', process.execPath);
      }

      logToFile('INFO', `Forking backend with options: ${JSON.stringify({ ...forkOptions, env: { ...forkOptions.env, DATABASE_URL: forkOptions.env.DATABASE_URL ? 'SET' : 'NOT SET' } })}`);

      backendProcess = fork(serverPath, [], forkOptions);

      let serverReady = false;
      let healthCheckAttempts = 0;
      const maxHealthChecks = 20; // Check for 20 seconds (20 * 1 second)
      let healthCheckInterval = null;

      // Health check function to verify backend is actually responding
      const checkHealth = async () => {
        try {
          const http = require('http');
          return new Promise((resolve) => {
            const req = http.get(`http://localhost:${BACKEND_PORT}/health`, { timeout: 2000 }, (res) => {
              if (res.statusCode === 200) {
                logToFile('SUCCESS', 'Health check passed - backend is responding');
                resolve(true);
              } else {
                resolve(false);
              }
            });
            req.on('error', () => resolve(false));
            req.on('timeout', () => {
              req.destroy();
              resolve(false);
            });
          });
        } catch (err) {
          return false;
        }
      };

      const startupTimeout = setTimeout(async () => {
        if (!serverReady) {
          // Try health check before giving up
          logToFile('INFO', 'Startup timeout reached, checking backend health...');
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
          }
          const isHealthy = await checkHealth();
          if (isHealthy) {
            logToFile('SUCCESS', 'Backend health check passed after timeout');
            serverReady = true;
            isBackendRunning = true;
            resolveProcess({
              success: true,
              port: BACKEND_PORT
            });
          } else {
            if (backendProcess && !backendProcess.killed) {
              backendProcess.kill();
            }
            logToFile('ERROR', 'Backend server failed to start within timeout');
            resolveProcess({
              success: false,
              port: BACKEND_PORT,
              error: 'Backend server failed to start within 20 seconds. Check logs at: ~/.zapeera/logs/backend-*.log'
            });
          }
        }
      }, 20000); // Increased to 20 seconds

      // Periodic health check while waiting for startup
      healthCheckInterval = setInterval(async () => {
        if (!serverReady && healthCheckAttempts < maxHealthChecks) {
          healthCheckAttempts++;
          const isHealthy = await checkHealth();
          if (isHealthy) {
            logToFile('SUCCESS', 'Health check passed - backend is ready');
            serverReady = true;
            isBackendRunning = true;
            clearTimeout(startupTimeout);
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
            resolveProcess({
              success: true,
              port: BACKEND_PORT
            });
          }
        } else if (serverReady) {
          clearInterval(healthCheckInterval);
          healthCheckInterval = null;
        }
      }, 1000); // Check every second

      // Handle stdout
      backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        logToFile('INFO', `Backend stdout: ${output.trim()}`);
        console.log(`[Backend] ${output}`);

        // Check for various backend startup messages
        if (output.includes('Server running on port') ||
            output.includes('Server is ready') ||
            output.includes('Server is ready to accept connections') ||
            output.includes(`port: ${BACKEND_PORT}`) ||
            output.includes(`port ${BACKEND_PORT}`) ||
            output.includes(`🌐 Server running on port`) ||
            output.includes(`✅ Server is ready`) ||
            output.includes(`Listening on port`)) {
          serverReady = true;
          clearTimeout(startupTimeout);
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
          }

          // Port reservation was already closed before forking
          // Backend now owns the port

          isBackendRunning = true;
          logToFile('SUCCESS', `Server started successfully on port ${BACKEND_PORT}`);
          console.log(`[Backend] ✓ Server started successfully on port ${BACKEND_PORT}`);
          // Verify with health check
          setTimeout(async () => {
            const isHealthy = await checkHealth();
            if (isHealthy) {
              logToFile('SUCCESS', 'Backend health check confirmed');
            } else {
              logToFile('WARNING', 'Backend started but health check failed');
            }
          }, 500);
          resolveProcess({
            success: true,
            port: BACKEND_PORT
          });
        }
      });

      // Handle stderr
      backendProcess.stderr.on('data', (data) => {
        const output = data.toString();
        logToFile('ERROR', `Backend stderr: ${output.trim()}`);
        console.error(`[Backend Error] ${output}`);

        // Check for common errors
        if (output.includes('Cannot find module') || output.includes('MODULE_NOT_FOUND')) {
          logToFile('ERROR', 'Missing module detected in backend');
          console.error('[Backend] ⚠️  Missing module detected in backend');
          console.error('[Backend] This usually means backend node_modules are not properly bundled');
          console.error('[Backend] Check electron-builder.json extraResources configuration');
          if (process.platform === 'win32') {
            console.error('[Backend] Windows EXE: Verify backend/node_modules is included in the build');
          }
        }
        if (output.includes('ENOENT') || output.includes('no such file')) {
          logToFile('ERROR', 'File not found error');
          console.error('[Backend] ⚠️  File not found error');
          if (process.platform === 'win32') {
            console.error('[Backend] Windows EXE: This may indicate a path resolution issue');
            console.error('[Backend] Check if backend files are in the correct location');
          }
        }
        if (output.includes('EADDRINUSE') || (output.includes('Port') && output.includes('already in use'))) {
          logToFile('ERROR', 'Port already in use - attempting to free port and retry...');
          console.error('[Backend] ⚠️  Port already in use - attempting to free and retry...');

          // Try to free the port one more time and restart backend
          if (!serverReady) {
            checkAndFreePort(BACKEND_PORT).then(async () => {
              await new Promise(resolve => setTimeout(resolve, 2000));
              logToFile('INFO', 'Port freed, but backend process already exited. Please restart the app.');
            });
          }
        }
        // Windows-specific error patterns
        if (process.platform === 'win32') {
          if (output.includes('The system cannot find the path specified')) {
            logToFile('ERROR', 'Windows path not found - check backend path resolution');
            console.error('[Backend] ⚠️  Windows: Path not found - this is a path resolution issue');
            console.error('[Backend] Verify backend is bundled correctly in the EXE');
          }
          if (output.includes('Access is denied')) {
            logToFile('ERROR', 'Windows access denied - may need Administrator privileges');
            console.error('[Backend] ⚠️  Windows: Access denied - try running as Administrator');
          }
        }
      });

      // Handle process exit
      backendProcess.on('exit', (code, signal) => {
        logToFile('INFO', `Backend process exited with code ${code}, signal ${signal}`);

        // Release port reservation if backend failed to start
        if (!serverReady && portReserver) {
          portReserver.close(() => {
            logToFile('INFO', 'Port reservation released due to backend failure');
          });
        }

        if (code !== 0 && code !== null && !serverReady) {
          clearTimeout(startupTimeout);
          if (healthCheckInterval) {
            clearInterval(healthCheckInterval);
            healthCheckInterval = null;
          }
          logToFile('ERROR', `Backend server failed to start - exited with code ${code}`);
          resolveProcess({
            success: false,
            port: BACKEND_PORT,
            error: `Backend server exited with code ${code}. Check logs at: ${logFile}`
          });
        }
      });

      backendProcess.on('error', (error) => {
        logToFile('ERROR', `Process fork error: ${error.message}`);
        logToFile('ERROR', `Error code: ${error.code}, syscall: ${error.syscall}`);
        logToFile('ERROR', `Platform: ${process.platform}, ExecPath: ${process.execPath}`);
        logToFile('ERROR', `Server path: ${serverPath}`);
        logToFile('ERROR', `Backend path: ${backendPath}`);
        console.error(`[Backend] Process fork error:`, error);
        console.error(`[Backend] Error code:`, error.code);
        console.error(`[Backend] Error syscall:`, error.syscall);
        console.error(`[Backend] Platform:`, process.platform);
        console.error(`[Backend] ExecPath:`, process.execPath);
        console.error(`[Backend] Server path:`, serverPath);
        console.error(`[Backend] Backend path:`, backendPath);

        // Provide helpful error messages
        let errorMessage = error.message;
        if (error.code === 'ENOENT') {
          if (process.platform === 'win32') {
            errorMessage = `Backend server file not found or Electron executable path incorrect.\n\n` +
                          `This is usually a path resolution issue in Windows EXE.\n\n` +
                          `Server path: ${serverPath}\n` +
                          `ExecPath: ${process.execPath}\n\n` +
                          `Please check:\n` +
                          `1. Backend is properly bundled in the EXE\n` +
                          `2. Check logs at: ${logFile}\n` +
                          `3. Verify electron-builder.json extraResources configuration`;
          } else {
            errorMessage = `Node.js not found. Please install Node.js to run the backend server. (${error.message})`;
            console.error('[Backend] ⚠️  Node.js executable not found in PATH');
            console.error('[Backend] Solution: Install Node.js from https://nodejs.org/');
          }
        } else if (error.code === 'EACCES') {
          errorMessage = `Permission denied. Cannot execute backend server.\n\n` +
                        `This may be a Windows security/permissions issue.\n\n` +
                        `Try:\n` +
                        `1. Run the application as Administrator\n` +
                        `2. Check Windows Defender/Antivirus settings\n` +
                        `3. Verify file permissions`;
        }

        clearTimeout(startupTimeout);
        if (healthCheckInterval) {
          clearInterval(healthCheckInterval);
          healthCheckInterval = null;
        }
        resolveProcess({
          success: false,
          port: BACKEND_PORT,
          error: errorMessage
        });
      });

    } catch (error) {
      resolveProcess({
        success: false,
        port: BACKEND_PORT,
        error: error.message
      });
    }
  });
}

/**
 * Stop the backend server
 */
function stopBackend() {
  if (isBackendRunning) {
    console.log('[Backend] Stopping server...');
    isBackendRunning = false;

    // If we spawned a process, kill it
    if (backendProcess && !backendProcess.killed) {
      if (process.platform === 'win32') {
        try {
          spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t'], {
            stdio: 'ignore',
            detached: true
          });
        } catch (err) {
          backendProcess.kill('SIGTERM');
        }
      } else {
        try {
          if (backendProcess.pid) {
            process.kill(-backendProcess.pid, 'SIGTERM');
          }
        } catch (err) {
          if (backendProcess.pid) {
            backendProcess.kill('SIGTERM');
          }
        }
      }

      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill('SIGKILL');
        }
        backendProcess = null;
      }, 2000);
    }

    // If we required it directly, we can't stop it, but Electron will clean up on exit
    console.log('[Backend] Server stopped');
  }
}

/**
 * Get backend status
 */
function getBackendStatus() {
  return {
    running: isBackendRunning,
    port: BACKEND_PORT
  };
}

module.exports = {
  startBackend,
  stopBackend,
  getBackendStatus
};
