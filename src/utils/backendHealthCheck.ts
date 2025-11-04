/**
 * Backend Health Check Utility
 * Checks if the backend API is available before the app tries to connect
 */

const BACKEND_CHECK_TIMEOUT = 30000; // 30 seconds
const BACKEND_CHECK_INTERVAL = 1000; // Check every 1 second
const MAX_RETRIES = 30; // Maximum number of retries

/**
 * Check if backend is healthy
 */
export async function checkBackendHealth(baseUrl: string): Promise<boolean> {
  try {
    const healthUrl = baseUrl.replace('/api', '/health');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return true;
    }

    return false;
  } catch (error: any) {
    // Ignore abort errors (timeouts) - they're expected
    if (error.name !== 'AbortError') {
      console.warn('[Backend Health] Health check failed:', error);
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

    const checkHealth = async () => {
      attempts++;

      if (onProgress) {
        onProgress(attempts, MAX_RETRIES);
      }

      const isHealthy = await checkBackendHealth(baseUrl);

      if (isHealthy) {
        console.log(`[Backend Health] Backend is ready after ${attempts} attempts`);
        resolve(true);
        return;
      }

      if (attempts >= MAX_RETRIES) {
        console.error(`[Backend Health] Backend not ready after ${MAX_RETRIES} attempts`);
        reject(new Error(`Backend not available after ${MAX_RETRIES} attempts`));
        return;
      }

      // Continue checking
      setTimeout(checkHealth, BACKEND_CHECK_INTERVAL);
    };

    // Start checking
    checkHealth();
  });
}
