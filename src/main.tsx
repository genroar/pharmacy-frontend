import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { validateEnvironment, logEnvironmentConfig, getEnvironmentRecommendations } from './lib/env-validator'

// Validate environment variables on startup
const { isValid, errors } = validateEnvironment();

if (!isValid) {
  console.error('❌ Environment validation failed:', errors);
  // You might want to show a user-friendly error message here
} else {
  console.log('✅ Environment validation passed');
}

// Log configuration in debug mode
logEnvironmentConfig();

// Show recommendations
const recommendations = getEnvironmentRecommendations();
if (recommendations.length > 0) {
  console.log('💡 Environment recommendations:', recommendations);
}

createRoot(document.getElementById("root")!).render(<App />);
