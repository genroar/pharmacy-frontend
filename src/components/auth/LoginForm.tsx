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
  Shield
} from "lucide-react";
import { apiService } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import AccountDeactivationModal from "./AccountDeactivationModal";

interface LoginFormProps {
  onLogin: (user: { id: string; name: string; email?: string; username?: string; role: string; branchId: string }) => void;
  onNavigateToSignup?: () => void;
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
  const [showDeactivationModal, setShowDeactivationModal] = useState(false);
  const [deactivatedUserInfo, setDeactivatedUserInfo] = useState<{
    username?: string;
    email?: string;
    name?: string;
  }>({});


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username.trim() || !formData.password.trim()) {
      toast({
        title: "Missing fields",
        description: "Please enter both username and password.",
        duration: 2000,
      });
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

        // Redirect to dashboard after successful login
        console.log('🔄 Redirecting to dashboard...');
        // Small delay to ensure state is updated
        setTimeout(() => {
          navigate('/');
        }, 100);
      } else {
        console.log('❌ Login failed:', response.message);

        // Check if account is disabled
        if (response.accountDisabled) {
          // Set user info for the modal (we'll try to get it from the username/email)
          setDeactivatedUserInfo({
            username: formData.username,
            email: formData.username.includes('@') ? formData.username : undefined
          });
          setShowDeactivationModal(true);
          setError(""); // Clear any existing error
        } else {
          setError(response.message || "Login failed");
          toast({
            title: "Login failed",
            description: response.message || "Please check your credentials and try again.",
            duration: 2000,
          });
        }
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);

      // Check if it's a backend connection error
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('Cannot connect to server') ||
          errorMessage.includes('backend may still be starting') ||
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError')) {
        setError("Backend server is not responding. Please wait a moment and try again. If the problem persists, restart the application.");
        toast({
          title: "Connection Error",
          description: "Cannot connect to the backend server. Please wait and try again.",
          duration: 5000,
          variant: "destructive"
        });
      } else {
        setError(errorMessage || "An unexpected error occurred. Please try again.");
        toast({
          title: "Login Error",
          description: errorMessage || "An unexpected error occurred.",
          duration: 3000,
          variant: "destructive"
        });
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
    if (error) setError("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c2c8a] to-[#153186] flex">
      {/* Left Side - Sign In (White Background) */}
      <div className="w-full bg-white lg:w-3/5 flex items-center justify-center rounded-tr-[50px] rounded-br-[50px] p-8 lg:p-12">
        <div className="w-full max-w-md">
          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-8">Sign In</h1>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="login-username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                  id="login-username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Enter your username"

                />
              </div>
            </div>


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
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Forgot Password */}
            <div className="text-right">
              <a href="#" className="text-sm text-gray-600 hover:text-purple-600">
                Forgot Your Password?
              </a>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
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
          <div className="items-center flex  flex-col  mt-[20px]">
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

          {/* Compliance note */}
          <p className="mt-4 text-xs text-gray-500 text-center">
            We keep your data secure and compliant with healthcare standards.
          </p>
        </div>
      </div>

      {/* Right Side - Welcome (Purple Background) */}
      <div className="hidden lg:flex lg:w-2/5  relative">
        {/* Curved edge */}

        <div className="flex justify-center w-[100%] items-center text-white p-8 relative z-10">
          <div className="text-center w-[100%] flex flex-col items-center justify-center space-y-6">
            <div className="text-center flex flex-col items-center ">
              <div className="w-[70px] h-[70px] text-[50px] flex items-center justify-center bg-white text-blue-900 rounded-full font-bold"><img src=" /images/favicon.png" alt="logo" className="w-10 object-cover" /></div>
              <h1 className="text-2xl font-bold text-white/90 mb-2">Zapeera</h1>
              <div className="w-16 h-0.5 bg-white/30 mx-auto"></div>
            </div>
            <h2 className="text-4xl font-bold">Welcome Back!</h2>
            <p className="text-lg text-purple-100 max-w-xs">
              Welcome to the world's best pharmacy POS system
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
    </div>
  );
};

export default LoginForm;
