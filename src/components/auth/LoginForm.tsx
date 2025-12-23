import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
  X,
  Mail
} from "lucide-react";
import { apiService } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import AccountDeactivationModal from "./AccountDeactivationModal";

interface LoginFormProps {
  onLogin: (user: { id: string; name: string; email?: string; username?: string; role: string; branchId: string }) => void;
  onNavigateToSignup?: () => void;
}

interface FieldErrors {
  username?: string;
  password?: string;
}

const LoginForm = ({ onLogin, onNavigateToSignup }: LoginFormProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [showDeactivationModal, setShowDeactivationModal] = useState(false);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordSubmitted, setForgotPasswordSubmitted] = useState(false);
  const [deactivatedUserInfo, setDeactivatedUserInfo] = useState<{
    username?: string;
    email?: string;
    name?: string;
  }>({});

  // Validate individual field
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case 'username':
        if (!value.trim()) return 'Username or email is required';
        if (value.length < 3) return 'Username must be at least 3 characters';
        return '';
      case 'password':
        if (!value.trim()) return 'Password is required';
        if (value.length < 4) return 'Password must be at least 4 characters';
        return '';
      default:
        return '';
    }
  };

  // Validate all fields
  const validateForm = (): boolean => {
    const errors: FieldErrors = {};

    const usernameError = validateField('username', formData.username);
    if (usernameError) errors.username = usernameError;

    const passwordError = validateField('password', formData.password);
    if (passwordError) errors.password = passwordError;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log('🔍 Attempting login with:', { usernameOrEmail: formData.username });
      const response = await apiService.login({
        usernameOrEmail: formData.username,
        password: formData.password
      });

      console.log('🔍 Login response received:', response);

      if (response.success && response.data) {
        const { user } = response.data;
        console.log('✅ Login successful, calling onLogin with user:', user);
        onLogin({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          profileImage: user.profileImage,
          role: user.role,
          branchId: user.branchId
        });

        setTimeout(() => {
          navigate('/');
        }, 100);
      } else {
        console.log('❌ Login failed:', response.message);

        if (response.accountDisabled) {
          // CRITICAL: Clear any stored data to prevent auto-login on page refresh
          localStorage.removeItem('token');
          localStorage.removeItem('medibill_user');
          localStorage.removeItem('auth_initialized');

          setDeactivatedUserInfo({
            username: formData.username,
            email: formData.username.includes('@') ? formData.username : undefined
          });
          setShowDeactivationModal(true);
          setError("");
        } else {
          // Handle specific error codes
          if (response.code === 'FIRST_LOGIN_REQUIRES_INTERNET' || response.requiresInternet) {
            setError("Internet connection required for first-time login. Please connect to the internet and try again.");
          } else if (response.code === 'DATABASE_NOT_INITIALIZED' || response.requiresRestart) {
            setError("Database not initialized. Please restart the application to complete setup.");
          } else if (response.message?.toLowerCase().includes('user not found')) {
            setFieldErrors({ username: 'No account found with this username/email' });
          } else if (response.message?.toLowerCase().includes('password')) {
            setFieldErrors({ password: 'Incorrect password' });
          } else {
            setError(response.message || "Login failed. Please check your credentials.");
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      const errorMessage = error?.message || String(error);

      if (errorMessage.includes('Cannot connect') || errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('backend may still be starting')) {
        // Don't show error immediately - backend might still be starting
        // Show a more helpful message
        setError("Backend is starting up. Please wait a moment and try again. If the problem persists, the app will work in offline mode.");

        // Auto-retry after 5 seconds
        setTimeout(async () => {
          try {
            const retryResponse = await apiService.login(formData.username, formData.password);
            if (retryResponse.success) {
              // Login successful on retry
              if (onLogin) {
                onLogin(retryResponse.data);
              }
              setTimeout(() => {
                navigate('/');
              }, 100);
            }
          } catch (retryError) {
            // If retry also fails, show error but allow offline mode
            console.warn('Login retry failed, app will continue in offline mode');
          }
        }, 5000);
      } else {
        setError(errorMessage || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear field error when user starts typing
    if (fieldErrors[field as keyof FieldErrors]) {
      setFieldErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (error) setError("");
  };

  const handleForgotPassword = () => {
    setShowForgotPasswordModal(true);
    setForgotPasswordSubmitted(false);
    setForgotPasswordEmail("");
  };

  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordResult, setForgotPasswordResult] = useState<{
    success: boolean;
    message: string;
    contactNumber?: string;
  } | null>(null);

  const handleForgotPasswordSubmit = async () => {
    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordResult({
        success: false,
        message: 'Please enter your email address.'
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail.trim())) {
      setForgotPasswordResult({
        success: false,
        message: 'Please enter a valid email address.'
      });
      return;
    }

    setForgotPasswordLoading(true);
    setForgotPasswordResult(null);

    try {
      const response = await apiService.forgotPassword(forgotPasswordEmail.trim());

      if (response.success) {
        setForgotPasswordResult({
          success: true,
          message: response.message || 'Your request has been submitted successfully.',
          contactNumber: response.contactNumber || '+923107100663'
        });
        setForgotPasswordSubmitted(true);
      } else {
        setForgotPasswordResult({
          success: false,
          message: response.message || 'Failed to submit request. Please try again.'
        });
      }
    } catch (error: any) {
      console.error('Forgot password error:', error);
      setForgotPasswordResult({
        success: false,
        message: error.message || 'Failed to connect to server. Please try again.'
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c2c8a] to-[#153186] flex">
      {/* Left Side - Sign In (White Background) */}
      <div className="w-full bg-white lg:w-3/5 flex items-center justify-center rounded-tr-[50px] rounded-br-[50px] p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Sign In</h1>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username Field */}
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-gray-700 mb-2">
                Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="login-username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  className={`w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    fieldErrors.username ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter your username or email"
                />
              </div>
              {/* Field Error Message */}
              {fieldErrors.username && (
                <div className="flex items-center mt-1.5 text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">{fieldErrors.username}</span>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className={`w-full pl-12 pr-12 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    fieldErrors.password ? 'border-red-500 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {/* Field Error Message */}
              {fieldErrors.password && (
                <div className="flex items-center mt-1.5 text-red-600">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span className="text-sm">{fieldErrors.password}</span>
                </div>
              )}
            </div>

            {/* General Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-300 rounded-lg flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Forgot Password */}
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                Forgot Your Password?
              </button>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-all duration-200 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="items-center flex flex-col mt-[20px]">
            <div className="w-full flex items-center space-x-4 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-500">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <button
              onClick={onNavigateToSignup}
              className="px-8 py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-600 hover:text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              Create Account
            </button>
          </div>

          {/* Compliance note - Generic Business */}
          <p className="mt-4 text-xs text-gray-500 text-center">
            We keep your data secure and compliant with industry standards.
          </p>
        </div>
      </div>

      {/* Right Side - Welcome (Blue Background) */}
      <div className="hidden lg:flex lg:w-2/5 relative">
        <div className="flex justify-center w-[100%] items-center text-white p-8 relative z-10">
          <div className="text-center w-[100%] flex flex-col items-center justify-center space-y-6">
            <div className="text-center flex flex-col items-center">
              <div className="w-[70px] h-[70px] flex items-center justify-center bg-white text-blue-900 rounded-full">
                <img src={`${import.meta.env.BASE_URL}images/favicon.png`} alt="logo" className="w-10 h-10 object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-white/90 mt-3 mb-2">Zapeera</h1>
              <div className="w-16 h-0.5 bg-white/30 mx-auto"></div>
            </div>
            <h2 className="text-4xl font-bold">Welcome Back!</h2>
            <p className="text-lg text-blue-100 max-w-xs">
              Complete Business Management & POS System
            </p>
          </div>
        </div>
      </div>

      {/* Account Deactivation Modal */}
      <AccountDeactivationModal
        isOpen={showDeactivationModal}
        onClose={() => setShowDeactivationModal(false)}
        userInfo={deactivatedUserInfo}
      />

      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {forgotPasswordSubmitted ? 'Request Submitted' : 'Forgot Password?'}
              </h2>
            </div>

            {!forgotPasswordSubmitted ? (
              <>
                <p className="text-gray-600 text-center mb-6">
                  Enter your email address and we'll help you reset your password.
                </p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your email"
                  />
                </div>
                {forgotPasswordResult && !forgotPasswordResult.success && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700">{forgotPasswordResult.message}</p>
                  </div>
                )}
                <button
                  onClick={handleForgotPasswordSubmit}
                  disabled={forgotPasswordLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {forgotPasswordLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    'Submit Request'
                  )}
                </button>
                <p className="text-xs text-gray-500 text-center mt-4">
                  You will be contacted by our support team.
                </p>
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-green-800 text-center text-sm">
                    {forgotPasswordResult?.message || 'Your password reset request has been submitted successfully.'}
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <p className="text-blue-800 text-center font-medium mb-2">
                    Please contact SuperAdmin to complete the reset:
                  </p>
                  <p className="text-center font-bold text-blue-900 text-lg">
                    {forgotPasswordResult?.contactNumber || '+923107100663'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowForgotPasswordModal(false);
                    setForgotPasswordSubmitted(false);
                    setForgotPasswordResult(null);
                    setForgotPasswordEmail("");
                  }}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginForm;
