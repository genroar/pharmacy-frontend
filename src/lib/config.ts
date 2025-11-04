/**
 * Application configuration from environment variables
 */

// Detect if running in Electron
const isElectron = typeof window !== 'undefined' &&
  typeof (window as any).electronAPI !== 'undefined';

// In Electron, always use localhost backend (auto-started)
// In web/dev, use environment variable
export const config = {
  // API Configuration
  api: {
    // Electron apps use localhost backend that auto-starts
    // Web/Dev can use environment variable or default
    baseUrl: (isElectron
      ? 'http://localhost:5001/api'
      : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api')),
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  },

  // App Configuration
  app: {
    name: import.meta.env.VITE_APP_NAME || 'MediBill Pulse',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  },

  // Development Configuration
  debug: {
    enabled: import.meta.env.VITE_DEBUG_MODE === 'true',
    logLevel: import.meta.env.VITE_LOG_LEVEL || 'info',
  },

  // Feature Flags
  features: {
    analytics: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    debugLogs: import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true',
  },

  // UI Configuration
  ui: {
    defaultTheme: import.meta.env.VITE_DEFAULT_THEME || 'light',
    itemsPerPage: parseInt(import.meta.env.VITE_ITEMS_PER_PAGE || '10'),
  },
} as const;

// Type definitions for better TypeScript support
export type Config = typeof config;
export type ApiConfig = typeof config.api;
export type AppConfig = typeof config.app;
export type DebugConfig = typeof config.debug;
export type FeatureConfig = typeof config.features;
export type UIConfig = typeof config.ui;
