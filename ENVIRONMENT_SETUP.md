# Environment Variables Setup

This document explains how to configure the MediBill Pulse application using environment variables.

## Quick Start

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your specific configuration values.

3. Restart your development server to load the new environment variables.

## Environment Variables

### API Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:5001/api` | `https://api.medibillpulse.com/api` |
| `VITE_API_TIMEOUT` | API request timeout in milliseconds | `30000` | `60000` |

### App Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_APP_NAME` | Application name | `MediBill Pulse` | `My Pharmacy App` |
| `VITE_APP_VERSION` | Application version | `1.0.0` | `2.1.0` |

### Development Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_DEBUG_MODE` | Enable debug logging | `true` | `false` |
| `VITE_LOG_LEVEL` | Logging level | `info` | `error`, `warn`, `info`, `debug` |

### Feature Flags

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_ENABLE_ANALYTICS` | Enable analytics tracking | `false` | `true` |
| `VITE_ENABLE_DEBUG_LOGS` | Enable detailed debug logs | `true` | `false` |

### UI Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_DEFAULT_THEME` | Default UI theme | `light` | `dark` |
| `VITE_ITEMS_PER_PAGE` | Default items per page | `10` | `20` |

## Environment-Specific Configuration

### Development
```env
VITE_API_BASE_URL=http://localhost:5001/api
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
```

### Staging
```env
VITE_API_BASE_URL=https://staging-api.medibillpulse.com/api
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=info
```

### Production
```env
VITE_API_BASE_URL=https://api.medibillpulse.com/api
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=error
VITE_ENABLE_ANALYTICS=true
```

## Usage in Code

### Using the Config Object
```typescript
import { config } from '../lib/config';

// Access API configuration
const apiUrl = config.api.baseUrl;
const timeout = config.api.timeout;

// Access app configuration
const appName = config.app.name;
const version = config.app.version;

// Check feature flags
if (config.features.analytics) {
  // Enable analytics
}

// Check debug mode
if (config.debug.enabled) {
  console.log('Debug information');
}
```

### Direct Environment Variable Access
```typescript
// Direct access (not recommended for complex logic)
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const debugMode = import.meta.env.VITE_DEBUG_MODE === 'true';
```

## Security Notes

- Never commit `.env` files to version control
- Use `.env.example` to document required variables
- Environment variables prefixed with `VITE_` are exposed to the client-side code
- Do not store sensitive information in environment variables that start with `VITE_`

## Troubleshooting

### Environment Variables Not Loading
1. Ensure the `.env` file is in the project root
2. Restart the development server after changing `.env`
3. Check that variable names start with `VITE_`
4. Verify there are no spaces around the `=` sign

### Build Issues
1. Ensure all required environment variables are set
2. Check that production environment variables are configured
3. Verify the build process has access to environment variables

## Examples

### Complete Development Environment
```env
# API Configuration
VITE_API_BASE_URL=http://localhost:5001/api
VITE_API_TIMEOUT=30000

# App Configuration
VITE_APP_NAME=MediBill Pulse
VITE_APP_VERSION=1.0.0

# Development Configuration
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DEBUG_LOGS=true

# UI Configuration
VITE_DEFAULT_THEME=light
VITE_ITEMS_PER_PAGE=10
```

### Production Environment
```env
# API Configuration
VITE_API_BASE_URL=https://api.medibillpulse.com/api
VITE_API_TIMEOUT=60000

# App Configuration
VITE_APP_NAME=MediBill Pulse
VITE_APP_VERSION=1.0.0

# Development Configuration
VITE_DEBUG_MODE=false
VITE_LOG_LEVEL=error

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG_LOGS=false

# UI Configuration
VITE_DEFAULT_THEME=light
VITE_ITEMS_PER_PAGE=20
```
