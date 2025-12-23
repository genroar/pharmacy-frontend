import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, LogIn, Database } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';

interface AuthStatusProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthStatus: React.FC<AuthStatusProps> = ({ children, fallback }) => {
  const { isAuthenticated, checkAuthStatus, logout, user } = useAuth();
  const [showError, setShowError] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);
  // Start with checking: true, running: false (assume SQLite mode until backend is confirmed)
  const [backendStatus, setBackendStatus] = useState<{ running: boolean; checking: boolean }>({ running: false, checking: true });
  const [isElectron, setIsElectron] = useState(false);

  // Check if user is properly authenticated
  const isProperlyAuthenticated = checkAuthStatus();

  console.log('🔍 AuthStatus: isAuthenticated:', isAuthenticated);
  console.log('🔍 AuthStatus: isProperlyAuthenticated:', isProperlyAuthenticated);
  console.log('🔍 AuthStatus: user:', user);

  // Check if running in Electron
  useEffect(() => {
    const electron = typeof window !== 'undefined' && typeof (window as any).electronAPI !== 'undefined';
    setIsElectron(electron);
  }, []);

  // Check backend status in Electron
  useEffect(() => {
    if (!isElectron) {
      // Not Electron, assume backend is running
      setBackendStatus({ running: true, checking: false });
      return;
    }

    // Add timeout to force SQLite mode if backend check takes too long
    const timeoutId = setTimeout(() => {
      console.log('⏱️ Backend check timeout - showing SQLite fallback');
      setBackendStatus({ running: false, checking: false });
    }, 3000); // 3 second timeout

    const checkBackend = async () => {
      try {
        // Add timeout to the backend status check
        const statusPromise = (window as any).electronAPI?.getBackendStatus();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Backend check timeout')), 2500)
        );

        const status = await Promise.race([statusPromise, timeoutPromise]) as any;

        // Clear the timeout since we got a response
        clearTimeout(timeoutId);

        if (status) {
          setBackendStatus({ running: status.running, checking: false });

          // If backend is down, show SQLite message immediately
          // Don't try to restart immediately - let user work offline
          if (!status.running) {
            console.log('🔍 Backend is down - SQLite mode active');
            // Try to restart in background (non-blocking)
            (async () => {
              try {
                const restartResult = await (window as any).electronAPI?.restartBackend();
                if (restartResult?.success) {
                  console.log('✅ Backend restarted successfully');
                  // Check again after 2 seconds
                  setTimeout(async () => {
                    try {
                      const newStatus = await (window as any).electronAPI?.getBackendStatus();
                      setBackendStatus({ running: newStatus?.running || false, checking: false });
                    } catch (err) {
                      console.error('Failed to recheck backend:', err);
                    }
                  }, 2000);
                }
              } catch (error) {
                console.error('Failed to restart backend:', error);
              }
            })();
          }
        } else {
          clearTimeout(timeoutId);
          setBackendStatus({ running: false, checking: false });
        }
      } catch (error) {
        console.error('Failed to check backend status:', error);
        clearTimeout(timeoutId);
        // On error, assume backend is down and show SQLite mode
        setBackendStatus({ running: false, checking: false });
      }
    };

    checkBackend();
    // Check every 5 seconds
    const interval = setInterval(checkBackend, 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeoutId);
    };
  }, [isElectron]);

  // Check if user account is disabled - allow access to Zapeera screen
  if (user && user.isActive === false) {
    console.log('🔍 AuthStatus: User account is disabled, allowing access to Zapeera screen');
    // Don't redirect - let the ZapeeraDashboard handle the disabled account display
  }

  // Show loading state during initialization (with timeout and auto-redirect)
  useEffect(() => {
    if (!isAuthenticated && !user && !shouldRedirect) {
      // Show error message after 3 seconds
      const errorTimer = setTimeout(() => {
        setShowError(true);
      }, 3000);

      // Redirect to login after 5 seconds using React Router
      const redirectTimer = setTimeout(() => {
        setShouldRedirect(true);
        console.log('🔍 AuthStatus: Redirecting to login page');
      }, 5000);

      return () => {
        clearTimeout(errorTimer);
        clearTimeout(redirectTimer);
      };
    }
  }, [isAuthenticated, user, shouldRedirect]);

  // Handle redirect using React Router Navigate
  if (shouldRedirect) {
    return <Navigate to="/login" replace />;
  }

  // If not authenticated and no user, show loading then redirect to login
  if (!isAuthenticated && !user) {
    // In Electron, if backend is down, show SQLite mode message
    const isBackendDown = isElectron && !backendStatus.checking && !backendStatus.running;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          {!isBackendDown && (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          )}
          {isBackendDown && (
            <Database className="h-8 w-8 text-green-600 mx-auto" />
          )}
          <p className="mt-2 text-gray-600">Loading...</p>
          {isBackendDown ? (
            <p className="mt-1 text-sm text-green-600 font-medium">Working offline with SQLite</p>
          ) : (
            <p className="mt-1 text-sm text-gray-400">Connecting to server...</p>
          )}
          {showError && !isBackendDown && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-yellow-800">
                Taking longer than expected. Redirecting to login...
              </p>
            </div>
          )}
          {isBackendDown && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-green-800">
                App is working in offline mode. All data is saved locally in SQLite database.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isProperlyAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    // Use Navigate component for redirecting
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default AuthStatus;
