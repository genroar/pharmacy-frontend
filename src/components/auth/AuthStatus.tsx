import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { AlertCircle, LogIn } from 'lucide-react';

interface AuthStatusProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const AuthStatus: React.FC<AuthStatusProps> = ({ children, fallback }) => {
  const { isAuthenticated, checkAuthStatus, logout, user } = useAuth();

  // Check if user is properly authenticated
  const isProperlyAuthenticated = checkAuthStatus();

  console.log('🔍 AuthStatus: isAuthenticated:', isAuthenticated);
  console.log('🔍 AuthStatus: isProperlyAuthenticated:', isProperlyAuthenticated);
  console.log('🔍 AuthStatus: user:', user);

  // Show loading state during initialization
  if (!isAuthenticated && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isProperlyAuthenticated) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-xl font-semibold">Authentication Required</CardTitle>
            <CardDescription>
              Your session has expired or you need to log in to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Please log in to access the application.
            </p>
            <div className="flex flex-col space-y-2">
              <Button
                onClick={() => window.location.href = '/login'}
                className="w-full"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Go to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  logout();
                  window.location.href = '/login';
                }}
                className="w-full"
              >
                Clear Session & Login
              </Button>
              <Button
                variant="ghost"
                onClick={logout}
                className="w-full text-gray-600 hover:text-gray-800"
              >
                Just Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthStatus;
