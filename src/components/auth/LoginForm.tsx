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

interface LoginFormProps {
  onLogin: (user: { id: string; name: string; role: string; branchId: string }) => void;
}


const LoginForm = ({ onLogin }: LoginFormProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    usernameOrEmail: "",
    password: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      console.log('🔍 Attempting login with:', { usernameOrEmail: formData.usernameOrEmail });
      const response = await apiService.login({
        usernameOrEmail: formData.usernameOrEmail,
        password: formData.password
      });

      console.log('🔍 Login response received:', response);

      if (response.success && response.data) {
        const { user } = response.data;
        console.log('✅ Login successful, calling onLogin with user:', user);
        onLogin({
          id: user.id,
          name: user.name,
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
        setError(response.message || "Login failed");
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setError(error instanceof Error ? error.message : "Login failed. Please try again.");
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">MediBill Pulse</h1>
          <p className="text-gray-600">Pharmacy Management System</p>
        </div>

        {/* Login Form */}
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-gray-900">Welcome Back</CardTitle>
            <p className="text-gray-600">Sign in to your account</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username or Email */}
              <div className="space-y-2">
                <Label htmlFor="usernameOrEmail" className="text-sm font-medium text-gray-700">
                  Username or Email
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="usernameOrEmail"
                    type="text"
                    placeholder="Enter your username or email"
                    value={formData.usernameOrEmail}
                    onChange={(e) => handleInputChange("usernameOrEmail", e.target.value)}
                    className="pl-10 h-12 border-gray-300 focus:border-green-500 focus:ring-green-500"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    className="pl-10 pr-10 h-12 border-gray-300 focus:border-green-500 focus:ring-green-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>


              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {/* Login Button */}
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90 transition-opacity"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>


            {/* Demo Credentials */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Demo Credentials:</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <p><strong>SuperAdmin:</strong> superadmin / password123</p>
                <p><strong>Admin:</strong> admin / password123</p>
                <p><strong>Manager:</strong> manager / password123</p>
                <p><strong>Cashier:</strong> cashier / password123</p>
                <p className="text-gray-500 mt-2">You can also use email addresses if available</p>
              </div>
            </div>

            {/* Signup Link */}
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{" "}
                <a
                  href="/signup"
                  className="text-green-600 hover:text-green-700 font-medium underline"
                >
                  Create Admin Account
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            © 2024 MediBill Pulse. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
