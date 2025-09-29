import { useState } from "react";
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
  Mail,
  Building,
  ArrowLeft
} from "lucide-react";
import { apiService } from "@/services/api";
import { useNavigate, Link } from "react-router-dom";

interface AdminSignupFormProps {
  onNavigateToLogin?: () => void;
}

const AdminSignupForm = ({ onNavigateToLogin }: AdminSignupFormProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    branchName: "",
    branchAddress: "",
    branchPhone: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiService.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: 'ADMIN',
        branchId: 'temp', // Will be created during registration
        branchData: {
          name: formData.branchName,
          address: formData.branchAddress,
          phone: formData.branchPhone
        }
      });

      if (response.success) {
        setSuccess("Admin account created successfully! You can now login.");
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(response.message || "Registration failed");
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (error) setError("")
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c2c8a] to-[#153186] flex">
      {/* Left Side - Welcome Content */}
      <div className="hidden lg:flex lg:w-2/5 relative">
        <div className="flex justify-center w-[100%] items-center text-white p-8 relative z-10">
          <div className="text-center w-[100%] flex flex-col items-center justify-center space-y-6">
            <div className="text-center flex flex-col items-center ">
              <div className="w-[70px] h-[70px] text-[50px] flex items-center justify-center bg-white text-blue-900 rounded-full font-bold">N</div>
               <h1 className="text-2xl font-bold text-white/90 mb-2">NextBill</h1>
               <div className="w-16 h-0.5 bg-white/30 mx-auto"></div>
             </div>
            <h2 className="text-4xl font-bold">Create Account!</h2>
            <p className="text-lg text-purple-100 max-w-xs">
              Join the world's best pharmacy POS system and transform your business
            </p>
            <div className="flex items-center space-x-4">
              <div className="w-8 h-px bg-white/30"></div>
              <span className="text-white/70 font-medium">OR</span>
              <div className="w-8 h-px bg-white/30"></div>
            </div>
            <button
              onClick={onNavigateToLogin}
              className="px-8 py-3 border-2 border-white text-white rounded-lg font-medium hover:bg-white hover:text-[#0c2c8a] transition-colors"
            >
              SIGN IN
            </button>
          </div>
        </div>
      </div>

      {/* Right Side - Signup Form (White Background) */}
      <div className="w-full bg-white lg:w-3/5 flex items-center justify-center rounded-tl-[50px] rounded-bl-[50px] p-8 lg:p-12">
        <div className="w-full max-w-2xl">
          {/* Signup Form */}
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={onNavigateToLogin}
                  className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </button>
                <CardTitle className="text-2xl font-bold text-gray-900">Create Admin Account</CardTitle>
                <div className="w-20"></div> {/* Spacer for centering */}
              </div>
              <p className="text-gray-600">Set up your pharmacy management system</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Personal Information */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-1">
                    Personal Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="signup-name" className="text-sm font-medium text-gray-700">
                        Full Name *
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Enter your full name"
                          value={formData.name}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          className="pl-10 h-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="signup-username" className="text-sm font-medium text-gray-700">
                        Username *
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="signup-username"
                          type="text"
                          placeholder="Choose a username"
                          value={formData.username}
                          onChange={(e) => handleInputChange("username", e.target.value)}
                          className="pl-10 h-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signup-email" className="text-sm font-medium text-gray-700">
                      Email Address *
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="Enter your email address"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        className="pl-10 h-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Password Section */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-1">
                    Security
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="signup-password" className="text-sm font-medium text-gray-700">
                        Password *
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          value={formData.password}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                          className="pl-10 pr-10 h-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
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

                    <div className="space-y-1">
                      <Label htmlFor="signup-confirmPassword" className="text-sm font-medium text-gray-700">
                        Confirm Password *
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="signup-confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                          className="pl-10 pr-10 h-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Branch Information */}
                <div className="space-y-3">
                  <h3 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-1">
                    Pharmacy Information
                  </h3>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="signup-branchName" className="text-sm font-medium text-gray-700">
                        Pharmacy Name *
                      </Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="signup-branchName"
                          type="text"
                          placeholder="Enter your pharmacy name"
                          value={formData.branchName}
                          onChange={(e) => handleInputChange("branchName", e.target.value)}
                          className="pl-10 h-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="signup-branchAddress" className="text-sm font-medium text-gray-700">
                        Pharmacy Address *
                      </Label>
                      <Input
                        id="signup-branchAddress"
                        type="text"
                        placeholder="Enter your pharmacy address"
                        value={formData.branchAddress}
                        onChange={(e) => handleInputChange("branchAddress", e.target.value)}
                        className="h-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="signup-branchPhone" className="text-sm font-medium text-gray-700">
                        Pharmacy Phone *
                      </Label>
                      <Input
                        id="signup-branchPhone"
                        type="tel"
                        placeholder="Enter your pharmacy phone number"
                        value={formData.branchPhone}
                        onChange={(e) => handleInputChange("branchPhone", e.target.value)}
                        className="h-10 border-gray-300 focus:border-green-500 focus:ring-green-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Error/Success Messages */}
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-600">{success}</p>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-10 text-white bg-[#0c2c8a]  hover:bg-[#153186] transition-opacity"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating Account...</span>
                    </div>
                  ) : (
                    "Create Admin Account"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSignupForm;
