/**
 * Backend Health Check Utility
 * Checks if the backend API is available before the app tries to connect
 */

const BACKEND_CHECK_TIMEOUT = 60000; // 60 seconds
const BACKEND_CHECK_INTERVAL = 2000; // Check every 2 seconds
const MAX_RETRIES = 30; // Maximum number of retries (30 * 2 = 60 seconds total)

// For Electron, wait a bit longer initially as backend might be starting
const INITIAL_WAIT_MS = 3000; // Wait 3 seconds before first check in Electron

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
    const timeoutId = setTimeout(() => controller.abort(), 5000); // Increased to 5 seconds for slower connections

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
      if (fetchError.name === 'AbortError' || fetchError.name === 'TypeError') {
        // These are expected - backend might not be ready yet
        return false;
      }
      throw fetchError;
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
        onProgress(attempts, MAX_RETRIES);
      }

      const isHealthy = await checkBackendHealth(baseUrl);

      if (isHealthy) {
        console.log(`[Backend Health] ✅ Backend is ready after ${attempts} attempts`);
        resolve(true);
        return;
      }

      if (attempts >= MAX_RETRIES) {
        const totalTime = (attempts * BACKEND_CHECK_INTERVAL + (isElectron ? INITIAL_WAIT_MS : 0)) / 1000;
        console.error(`[Backend Health] ❌ Backend not ready after ${attempts} attempts (${totalTime} seconds)`);
        console.error(`[Backend Health] Checked URL: ${baseUrl.replace('/api', '/health')}`);
        reject(new Error(`Backend not available after ${totalTime} seconds. Please check if the backend server is running.`));
        return;
      }

      // Continue checking
      setTimeout(checkHealth, BACKEND_CHECK_INTERVAL);
    };

    // In Electron, wait a bit before first check to give backend time to start
    if (isElectron && attempts === 0) {
      console.log(`[Backend Health] ⏳ Waiting ${INITIAL_WAIT_MS}ms for backend to start...`);
      setTimeout(checkHealth, INITIAL_WAIT_MS);
    } else {
      // Start checking immediately
      checkHealth();
    }
  });
}
