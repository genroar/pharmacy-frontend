import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Mail,
  Building,
  CheckCircle,
  Phone
} from "lucide-react";
import { apiService } from "@/services/api";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface AdminSignupFormProps {
  onNavigateToLogin?: () => void;
}

const AdminSignupForm = ({ onNavigateToLogin }: AdminSignupFormProps) => {
  const navigate = useNavigate();
  const { login } = useAuth();
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
  const [step, setStep] = useState<1 | 2>(1);
  const [usernameError, setUsernameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false); // NEW: Success dialog
  const [passwordStrength, setPasswordStrength] = useState({
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
    minLength: false
  });

  // Test toast on component mount
  useEffect(() => {
    console.log("AdminSignupForm mounted - toast system should be working");
  }, []);

  // Password validation function
  const validatePassword = (password: string) => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    const minLength = password.length >= 8;

    setPasswordStrength({
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
      minLength
    });

    return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar && minLength;
  };

  // Check if password meets all requirements
  const isPasswordValid = () => {
    return passwordStrength.hasUpperCase &&
           passwordStrength.hasLowerCase &&
           passwordStrength.hasNumber &&
           passwordStrength.hasSpecialChar &&
           passwordStrength.minLength;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Step-wise validation / progression
    if (step === 1) {
      if (!formData.name || !formData.username || !formData.email) {
        setError("Please fill all required fields");
        toast({
          title: "Missing fields",
          description: "Name, Username and Email are required.",
          duration: 2000,
        });
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      // Validate password strength
      if (!validatePassword(formData.password)) {
        setPasswordError("Password does not meet requirements");
        setError("Password does not meet the required criteria");
        toast({
          title: "Weak password",
          description: "Password must contain at least one uppercase letter, one lowercase letter, one number, one special character, and be at least 8 characters long.",
          duration: 5000,
          variant: "destructive",
        });
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        toast({
          title: "Passwords do not match",
          description: "Make sure both password fields are identical.",
          duration: 2000,
        });
        return;
      }
      // Final submit on step 2 (no more steps needed)
    }
    setIsLoading(true);

    try {
      const response = await apiService.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        name: formData.name,
        role: 'ADMIN',
        branchId: ""
        // No branchId or branchData needed - admin will create companies from dashboard
      });

      if (response.success) {
        // NEW: Show success dialog - DO NOT auto-login
        // Account is inactive until SuperAdmin activates it
        console.log('✅ Account created successfully - pending activation');
        setShowSuccessDialog(true);
        setSuccess("Account created successfully!");

        // Clear form
        setFormData({
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
          name: "",
          branchName: "",
          branchAddress: "",
          branchPhone: ""
        });
        setStep(1);
      } else {
        setError(response.message || "Registration failed");

        // Show specific toast based on the error field
        if ((response as any).field === 'username') {
          setUsernameError("Username already exists");
          toast({
            title: "Username already exists",
            description: "Please choose a different username.",
            variant: "destructive",
            duration: 3000,
          });
        } else if ((response as any).field === 'email') {
          setEmailError("Email already exists");
          toast({
            title: "Email already exists",
            description: "This email is already registered. Please use a different email or try logging in.",
            variant: "destructive",
            duration: 3000,
          });
        } else {
          toast({
            title: "Registration failed",
            description: response.message || "Please review your details and try again.",
            variant: "destructive",
            duration: 3000,
          });
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Error field:', error.field);
      console.error('Error message:', error.message);
      console.error('Full error object:', JSON.stringify(error, null, 2));

      setError(error instanceof Error ? error.message : "Registration failed. Please try again.");

      // Always show a toast for debugging
      toast({
        title: "Registration Error",
        description: `Error: ${error.message || 'Unknown error'}, Field: ${error.field || 'none'}`,
        variant: "destructive",
        duration: 5000,
      });

      // Check if the error has field information
      if (error.field === 'username') {
        setUsernameError("Username already exists");
        toast({
          title: "Username already exists",
          description: "Please choose a different username.",
          variant: "destructive",
          duration: 3000,
        });
      } else if (error.field === 'email') {
        setEmailError("Email already exists");
        toast({
          title: "Email already exists",
          description: "This email is already registered. Please use a different email or try logging in.",
          variant: "destructive",
          duration: 3000,
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

    // Clear field-specific errors when user starts typing
    if (field === 'username') {
      setUsernameError("");
    } else if (field === 'email') {
      setEmailError("");
    } else if (field === 'password') {
      setPasswordError("");
      validatePassword(value);
    }
  };

  // Function to check if username exists
  const checkUsernameExists = async (username: string) => {
    if (username.length < 3) return;

    try {
      // We'll create a simple check endpoint or use the existing validation
      // For now, we'll clear the error and let the form submission handle it
      setUsernameError("");
    } catch (error) {
      console.error('Error checking username:', error);
    }
  };

  // Function to check if email exists
  const checkEmailExists = async (email: string) => {
    if (!email.includes('@')) return;

    try {
      // We'll create a simple check endpoint or use the existing validation
      // For now, we'll clear the error and let the form submission handle it
      setEmailError("");
    } catch (error) {
      console.error('Error checking email:', error);
    }
  };

  // Handle dialog close - redirect to login
  const handleSuccessDialogClose = () => {
    setShowSuccessDialog(false);
    if (onNavigateToLogin) {
      onNavigateToLogin();
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0c2c8a] to-[#153186] flex">
      {/* Success Dialog - Account Pending Activation */}
      <Dialog open={showSuccessDialog} onOpenChange={handleSuccessDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                Account Created Successfully! 🎉
              </DialogTitle>
              <DialogDescription className="mt-4 text-gray-600">
                <p className="mb-4">
                  Thank you for creating your account!
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-amber-800 font-medium mb-2">
                    ⚠️ Account Activation Required
                  </p>
                  <p className="text-amber-700 text-sm">
                    Your account is pending activation. Please contact the SuperAdmin to activate your account before you can login.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-blue-800 font-medium mb-2 flex items-center justify-center">
                    <Phone className="w-4 h-4 mr-2" />
                    Contact SuperAdmin
                  </p>
                  <p className="text-blue-700 text-lg font-bold">
                    +92 310 7100663
                  </p>
                </div>
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="mt-4">
            <Button
              onClick={handleSuccessDialogClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Go to Login Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Left Side - Welcome Content */}
      <div className="hidden lg:flex lg:w-2/5 relative">
        <div className="flex justify-center w-[100%] items-center text-white p-8 relative z-10">
          <div className="text-center w-[100%] flex flex-col items-center justify-center space-y-6">
            <div className="text-center flex flex-col items-center ">
              <div className="w-[70px] h-[70px] text-[50px] flex items-center justify-center bg-white text-blue-900 rounded-full font-bold"><img src={`${import.meta.env.BASE_URL}images/favicon.png`} alt="logo" className="w-10 object-cover" /></div>
               <h1 className="text-2xl font-bold text-white/90 mb-2">Zapeera</h1>
               <div className="w-16 h-0.5 bg-white/30 mx-auto"></div>
             </div>
            <h2 className="text-4xl font-bold">Create Account!</h2>
            <p className="text-lg text-purple-100 max-w-xs">
            Your pharmacy, organized. Set up your account to manage inventory, billing, and reports
            </p>

          </div>
        </div>
      </div>

      {/* Right Side - Signup Form (White Background) */}
      <div className="w-full bg-white lg:w-3/5 flex items-center justify-center rounded-tl-[50px] rounded-bl-[50px] p-8 lg:p-12">
        <div className="w-full max-w-2xl">
          {/* Signup Form */}
          <Card className="shadow-xl border-0">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center">
                <CardTitle className="text-lg font-bold text-gray-900 text-center">Secure, reliable, pharmacy-first POS  system for your business</CardTitle>
              </div>
              <p className="text-gray-600">Set up your pharmacy management system</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {step === 1 && (
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
                          className={`pl-10 h-10 ${
                            usernameError
                              ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                              : 'border-gray-300 focus:border-green-500 focus:ring-green-500'
                          }`}
                        />
                        {usernameError && (
                          <p className="text-sm text-red-600 mt-1">{usernameError}</p>
                        )}
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
                        className={`pl-10 h-10 ${
                          emailError
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                            : 'border-gray-300 focus:border-green-500 focus:ring-green-500'
                        }`}
                      />
                      {emailError && (
                        <p className="text-sm text-red-600 mt-1">{emailError}</p>
                      )}
                    </div>
                  </div>
                </div>
                )}

                {step === 2 && (
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

                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {/* Password Strength Indicator */}
                      {formData.password && (
                        <div className="mt-2 space-y-2">
                          <div className="text-xs text-gray-600">Password Requirements:</div>
                          <div className="space-y-1">
                            <div className={`flex items-center text-xs ${passwordStrength.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                              <div className={`w-2 h-2 rounded-full mr-2 ${passwordStrength.minLength ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              At least 8 characters
                            </div>
                            <div className={`flex items-center text-xs ${passwordStrength.hasUpperCase ? 'text-green-600' : 'text-gray-500'}`}>
                              <div className={`w-2 h-2 rounded-full mr-2 ${passwordStrength.hasUpperCase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              One uppercase letter (A-Z)
                            </div>
                            <div className={`flex items-center text-xs ${passwordStrength.hasLowerCase ? 'text-green-600' : 'text-gray-500'}`}>
                              <div className={`w-2 h-2 rounded-full mr-2 ${passwordStrength.hasLowerCase ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              One lowercase letter (a-z)
                            </div>
                            <div className={`flex items-center text-xs ${passwordStrength.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                              <div className={`w-2 h-2 rounded-full mr-2 ${passwordStrength.hasNumber ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              One number (0-9)
                            </div>
                            <div className={`flex items-center text-xs ${passwordStrength.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                              <div className={`w-2 h-2 rounded-full mr-2 ${passwordStrength.hasSpecialChar ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                              One special character (!@#$%^&*)
                            </div>
                          </div>
                        </div>
                      )}
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
                )}


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

                <div className="flex items-center justify-between">
                  {step > 1 ? (
                    <Button type="button" variant="outline" onClick={() => setStep((s) => (s > 1 ? (s - 1) as 1 | 2 : s))}>
                      Previous
                    </Button>
                  ) : <div />}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-10 text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Creating Account...</span>
                      </div>
                    ) : (
                      step < 3 ? 'Next' : 'Create Admin Account'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          {/* OR Login CTA below the signup form */}
          <div className="mt-6">
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-500">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => (onNavigateToLogin ? onNavigateToLogin() : navigate('/login'))}
              className="w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white shadow-md hover:shadow-lg transition-all duration-200"
            >
              Login
            </Button>
          </div>
          {/* Compliance note */}
          <p className="mt-4 text-xs text-gray-500 text-center">
            We keep your data secure and compliant with healthcare standards.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminSignupForm;
