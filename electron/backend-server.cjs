/**
 * Backend Server Starter for Electron
 * Starts the bundled backend server when Electron app launches
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let backendProcess = null;
const BACKEND_PORT = process.env.BACKEND_PORT || 5001;

/**
 * Start the backend server
 * @param {string} backendPath - Path to backend dist folder
 * @returns {Promise<{success: boolean, port: number, error?: string}>}
 */
function startBackend(backendPath) {
  return new Promise((resolve, reject) => {
    try {
      const serverPath = path.join(backendPath, 'server.js');

      // Check if server file exists
      if (!fs.existsSync(serverPath)) {
        return resolve({
          success: false,
          port: BACKEND_PORT,
          error: `Backend server not found at: ${serverPath}`
        });
      }

      console.log(`[Backend] Starting server from: ${serverPath}`);

      // Set environment variables for backend
      // Load .env file if it exists (for DATABASE_URL and other config)
      let envVars = { ...process.env };

      // Try to load .env file from backend directory
      const envPath = path.join(backendPath, '..', '.env');
      if (fs.existsSync(envPath)) {
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
      }

      const env = {
        ...envVars,
        PORT: BACKEND_PORT,
        NODE_ENV: 'production'
      };

      // Get node executable path - use the bundled Node.js from Electron
      // In Electron, Node.js is available via process.execPath or require('electron')
      const { app } = require('electron');
      const isDev = !app.isPackaged;

      // For packaged apps, Node.js should be available in PATH or use system node
      // For development, use system node
      // Try to find Node.js in common locations or use PATH
      let nodeExecutable = process.platform === 'win32' ? 'node.exe' : 'node';

      // In packaged Electron apps, Node.js from Electron can be used
      // But it's easier to use system Node.js which should be in PATH

      // Start backend process
      backendProcess = spawn(nodeExecutable, [serverPath], {
        cwd: backendPath,
        env: env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        shell: process.platform === 'win32' // Use shell on Windows for better compatibility
      });

      let serverReady = false;
      const startupTimeout = setTimeout(() => {
        if (!serverReady) {
          backendProcess.kill();
          resolve({
            success: false,
            port: BACKEND_PORT,
            error: 'Backend server failed to start within 10 seconds'
          });
        }
      }, 10000);

      // Handle stdout
      backendProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[Backend] ${output}`);

        // Check if server is ready (look for specific log messages)
        if (output.includes('Server running on port') ||
            output.includes('Server is ready') ||
            output.includes('listening') ||
            output.includes(`port: ${BACKEND_PORT}`) ||
            output.includes(`port ${BACKEND_PORT}`)) {
          serverReady = true;
          clearTimeout(startupTimeout);
          console.log(`[Backend] ✓ Server confirmed ready on port ${BACKEND_PORT}`);
          resolve({
            success: true,
            port: BACKEND_PORT
          });
        }

        // Check for startup errors in output
        if ((output.includes('ERROR') || output.includes('Error:')) && !output.includes('Not Found')) {
          console.warn(`[Backend] Potential error in output: ${output}`);
        }
      });

      // Handle stderr
      backendProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(`[Backend Error] ${output}`);

        // Check for common startup errors
        if (output.includes('EADDRINUSE')) {
          console.error('[Backend] Port already in use!');
          if (!serverReady) {
            clearTimeout(startupTimeout);
            resolve({
              success: false,
              port: BACKEND_PORT,
              error: `Port ${BACKEND_PORT} is already in use`
            });
          }
        }

        if (output.includes('DATABASE_URL') || output.includes('庞大的')) {
          console.warn('[Backend] Database connection issue detected');
        }

        if (output.includes('Cannot find module') || output.includes('MODULE_NOT_FOUND')) {
          console.error('[Backend] Missing module detected');
          if (!serverReady) {
            clearTimeout(startupTimeout);
            resolve({
              success: false,
              port: BACKEND_PORT,
              error: 'Missing dependencies - backend node_modules may not be bundled correctly'
            });
          }
        }
      });

      // Handle process exit
      backendProcess.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          console.error(`[Backend] Process exited with code ${code}, signal ${signal}`);
          if (!serverReady) {
            clearTimeout(startupTimeout);
            resolve({
              success: false,
              port: BACKEND_PORT,
              error: `Backend server exited with code ${code}`
            });
          }
        }
      });

      backendProcess.on('error', (error) => {
        console.error(`[Backend] Failed to start:`, error);
        clearTimeout(startupTimeout);
        resolve({
          success: false,
          port: BACKEND_PORT,
          error: error.message
        });
      });

    } catch (error) {
      resolve({
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
  if (backendProcess) {
    console.log('[Backend] Stopping server...');
    try {
      // Check if process is still running
      if (backendProcess.killed) {
        backendProcess = null;
        return;
      }

      if (process.platform === 'win32') {
        // Windows - kill process tree
        try {
          spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t'], {
            stdio: 'ignore',
            detached: true
          });
        } catch (err) {
          // Fallback to regular kill
          backendProcess.kill('SIGTERM');
        }
      } else {
        // macOS/Linux - kill process group
        try {
          if (backendProcess.pid) {
            process.kill(-backendProcess.pid, 'SIGTERM');
          }
        } catch (err) {
          // Fallback to regular kill
          if (backendProcess.pid) {
            backendProcess.kill('SIGTERM');
          }
        }
      }

      // Wait a bit then force kill if still running
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          backendProcess.kill('SIGKILL');
        }
        backendProcess = null;
      }, 2000);

      console.log('[Backend] Server stopped');
    } catch (error) {
      console.error('[Backend] Error stopping server:', error);
      backendProcess = null;
    }
  }
}

/**
 * Get backend status
 */
function getBackendStatus() {
  return {
    running: backendProcess !== null && backendProcess.killed === false,
    port: BACKEND_PORT
  };
}

module.exports = {
  startBackend,
  stopBackend,
  getBackendStatus
};
