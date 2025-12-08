import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, LogIn } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';

interface AuthStatusProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthStatus: React.FC<AuthStatusProps> = ({ children, fallback }) => {
  const { isAuthenticated, checkAuthStatus, logout, user } = useAuth();
  const [showError, setShowError] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  // Check if user is properly authenticated
  const isProperlyAuthenticated = checkAuthStatus();

  console.log('🔍 AuthStatus: isAuthenticated:', isAuthenticated);
  console.log('🔍 AuthStatus: isProperlyAuthenticated:', isProperlyAuthenticated);
  console.log('🔍 AuthStatus: user:', user);

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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
          <p className="mt-1 text-sm text-gray-400">Connecting to server...</p>
          {showError && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto">
              <p className="text-sm text-yellow-800">
                Taking longer than expected. Redirecting to login...
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
