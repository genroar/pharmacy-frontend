/**
 * Backend Health Check Utility
 * Checks if the backend API is available before the app tries to connect
 */

const BACKEND_CHECK_TIMEOUT = 60000; // 60 seconds
const BACKEND_CHECK_INTERVAL = 2000; // Check every 2 seconds

// Helper function to detect Windows platform
function isWindowsPlatform(): boolean {
  if (typeof window === 'undefined') return false;
  return window.navigator?.platform?.includes('Win') ||
         (window as any).electronAPI?.platform === 'win32' ||
         (window as any).electronAPI?.getPlatform?.() === 'win32';
}

// Helper function to detect if running in production (packaged app)
function isProductionMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as any).electronAPI?.isPackaged === true ||
         !(window as any).electronAPI; // If no electronAPI, assume production
}

// Maximum retries - more for production EXE builds
// CRITICAL: Increased retries to handle slower backend startup
function getMaxRetries(): number {
  const isWin = isWindowsPlatform();
  const isProd = isProductionMode();

  if (isProd && isWin) {
    return 90; // Windows EXE: 90 retries = 180 seconds total (increased from 60)
  } else if (isProd) {
    return 75; // Production (non-Windows): 75 retries = 150 seconds (increased from 50)
  } else {
    return 60; // Dev: 60 retries = 120 seconds (increased from 40)
  }
}

const MAX_RETRIES = getMaxRetries();

// For Electron, wait a bit longer initially as backend might be starting
// Windows EXE in production needs significantly more time due to slower startup
// CRITICAL: Increased wait times to handle slower backend startup
function getInitialWaitTime(): number {
  const isWin = isWindowsPlatform();
  const isProd = isProductionMode();

  if (isProd && isWin) {
    return 30000; // Windows EXE: 30 seconds (increased from 15)
  } else if (isProd) {
    return 20000; // Production (non-Windows): 20 seconds (increased from 10)
  } else if (isWin) {
    return 15000;  // Dev Windows: 15 seconds (increased from 8)
  } else {
    return 10000;  // Dev others: 10 seconds (increased from 5)
  }
}

const INITIAL_WAIT_MS = getInitialWaitTime();

/**
 * Check if backend is healthy
 */
export async function checkBackendHealth(baseUrl: string): Promise<boolean> {
  try {
    // Extract base URL without /api
    let healthUrl = baseUrl.replace('/api', '');
    // Remove trailing slash if present
    healthUrl = healthUrl.replace(/\/$/, '');
    // Add /health endpoint
    healthUrl = `${healthUrl}/health`;

    const controller = new AbortController();
    // Windows EXE may need more time for backend to respond
    // CRITICAL: Increased timeout to handle slower backend responses
    const isWin = isWindowsPlatform();
    const isProd = isProductionMode();
    const healthCheckTimeout = (isProd && isWin) ? 20000 : (isWin ? 15000 : 10000); // Windows EXE: 20s, Windows Dev: 15s, Others: 10s
    const timeoutId = setTimeout(() => controller.abort(), healthCheckTimeout);

    try {
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
        // Add cache control to prevent caching
        cache: 'no-cache',
        // Add mode to handle CORS properly
        mode: 'cors',
        credentials: 'omit', // Don't send credentials for health check
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log(`[Backend Health] ✓ Backend is healthy at ${healthUrl}`, data);
        return true;
      }

      console.warn(`[Backend Health] Backend returned status ${response.status} at ${healthUrl}`);
      return false;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      // Network errors are expected when backend is starting
      if (fetchError.name === 'AbortError') {
        // Timeout - backend might not be ready yet
        console.log(`[Backend Health] Health check timed out for ${healthUrl} (backend may still be starting)`);
        return false;
      }
      if (fetchError.name === 'TypeError' || fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
        // Network error - backend might not be ready yet
        console.log(`[Backend Health] Network error for ${healthUrl} (backend may not be running yet)`);
        return false;
      }
      // Log other errors for debugging
      console.warn(`[Backend Health] Unexpected error:`, fetchError.message);
      return false;
    }
  } catch (error: any) {
    // Ignore abort errors (timeouts) - they're expected
    if (error.name !== 'AbortError' && error.name !== 'TypeError') {
      console.warn('[Backend Health] Health check failed:', error.message);
    }
    return false;
  }
}

/**
 * Wait for backend to be ready
 * @param baseUrl - Base API URL
 * @param onProgress - Optional callback for progress updates
 * @returns Promise that resolves when backend is ready, or rejects after max retries
 */
export async function waitForBackend(
  baseUrl: string,
  onProgress?: (attempt: number, maxRetries: number) => void
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const isElectron = typeof window !== 'undefined' && typeof (window as any).electronAPI !== 'undefined';

    const checkHealth = async () => {
      attempts++;

      if (onProgress) {
        onProgress(attempts, getMaxRetries());
      }

      const isHealthy = await checkBackendHealth(baseUrl);

      if (isHealthy) {
        console.log(`[Backend Health] ✅ Backend is ready after ${attempts} attempts`);
        resolve(true);
        return;
      }

      const maxRetries = getMaxRetries();
      if (attempts >= maxRetries) {
        const totalTime = (attempts * BACKEND_CHECK_INTERVAL + (isElectron ? getInitialWaitTime() : 0)) / 1000;
        const healthUrl = baseUrl.replace('/api', '/health');
        console.error(`[Backend Health] ❌ Backend not ready after ${attempts} attempts (${totalTime} seconds)`);
        console.error(`[Backend Health] Checked URL: ${healthUrl}`);
        console.error(`[Backend Health] 💡 Troubleshooting:`);
        console.error(`[Backend Health]    1. Check if backend is running: curl ${healthUrl}`);
        if (!isProductionMode()) {
          console.error(`[Backend Health]    2. In dev mode, build backend: cd backend-pharmachy && npm run build`);
          console.error(`[Backend Health]    3. Or run backend separately: cd backend-pharmachy && npm run dev`);
        }
        console.error(`[Backend Health]    4. Check logs: ~/.zapeera/logs/backend-*.log`);
        console.error(`[Backend Health]    5. Check Electron console for backend startup messages`);
        reject(new Error(`Backend not available after ${totalTime} seconds. Please check if the backend server is running on port 5001.`));
        return;
      }

      // Continue checking
      setTimeout(checkHealth, BACKEND_CHECK_INTERVAL);
    };

    // In Electron, wait a bit before first check to give backend time to start
    if (isElectron && attempts === 0) {
      const waitTime = getInitialWaitTime();
      const isWin = isWindowsPlatform();
      const isProd = isProductionMode();
      const platformInfo = isProd
        ? (isWin ? 'Windows EXE (Production)' : 'Production')
        : (isWin ? 'Windows (Dev)' : 'Dev');
      console.log(`[Backend Health] ⏳ Waiting ${waitTime}ms for backend to start (${platformInfo})...`);
      setTimeout(checkHealth, waitTime);
    } else {
      // Start checking immediately
      checkHealth();
    }
  });
}
