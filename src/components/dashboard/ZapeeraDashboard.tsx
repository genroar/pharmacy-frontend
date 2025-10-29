import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Briefcase,
  BarChart3,
  Star,
  Key,
  Building,
  Plus,
  MessageCircle,
  Phone,
  Mail,
  LogOut,
  X
} from "lucide-react";
import ZapeeraLayout from "@/components/layout/ZapeeraLayout";
import OnboardingTour, { OnboardingStep } from "@/components/OnboardingTour";
import { useMutation } from "@tanstack/react-query";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { toast } from "@/hooks/use-toast";

const ZapeeraDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setSelectedCompanyId, allCompanies } = useAdmin();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Type assertion to ensure we're using the correct User interface
  const currentUser = user as {
    id: string;
    name: string;
    username?: string;
    email?: string;
    role: string;
    isActive?: boolean;
  } | null;

  // Onboarding tour steps for the dashboard
  const dashboardSteps: OnboardingStep[] = [
    {
      target: '.sidebar-menu',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Navigation Menu</h3>
          <p>This is your main menu — access all modules from here. You can navigate to different sections like POS, Reports, and Settings.</p>
        </div>
      ),
      title: "Welcome to Zapeera! 👋",
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.new-sale-button',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">New Sale Button</h3>
          <p>Click here to start a new sale transaction. This is where you'll process customer purchases and manage your point of sale.</p>
        </div>
      ),
      title: "Start Selling",
      placement: 'bottom',
    },
    {
      target: '.feature-cards',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Key Features</h3>
          <p>Explore these feature cards to understand what Zapeera can do for your business. Each card represents a core functionality.</p>
        </div>
      ),
      title: "Discover Features",
      placement: 'top',
    },
    {
      target: '.help-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Need Help?</h3>
          <p>If you need assistance, use these support options to get in touch with our team via WhatsApp or email.</p>
        </div>
      ),
      title: "Get Support",
      placement: 'top',
    }
  ];

  const handleCreateBusiness = () => {
    setIsCreateModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});

    // Basic validation
    if (!formData.name.trim()) {
      setFormErrors({ name: 'Company name is required' });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await apiService.createCompany(formData);
      if (response.success) {
        toast({
          title: "Success",
          description: "Company created successfully!",
        });

        // Reset form
        setFormData({
          name: '',
          description: '',
          address: '',
          phone: '',
          email: ''
        });
        setIsCreateModalOpen(false);

        // Navigate to My Businesses tab
        navigate('/zapeera/companies');
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to create company",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error creating company:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create company",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormCancel = () => {
    setIsCreateModalOpen(false);
    setFormData({
      name: '',
      description: '',
      address: '',
      phone: '',
      email: ''
    });
    setFormErrors({});
  };

  const handleChatSupport = () => {
    // Open WhatsApp with the support number
    const phoneNumber = "+923107100663";
    const message = "Hello! I need support with Zapeera.";
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleScheduleDemo = () => {
    // Open email client to schedule a demo call
    const subject = "Schedule Demo Call - Zapeera";
    const body = `Hello,

I would like to schedule a demo call to learn more about Zapeera.

Please let me know your available time slots.

Best regards,
${user?.name || 'User'}`;

    const emailUrl = `mailto:support@zapeera.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(emailUrl, '_blank');
  };

  const handleExploreDemo = () => {
    // Implement demo business exploration
    console.log("Explore demo business clicked");
  };

  const handleContactSupport = () => {
    // Open WhatsApp with the support number
    const phoneNumber = "+923107100663";
    const message = `Hello! My account is disabled and I need it to be activated. My username: ${currentUser?.username || 'N/A'}. Please help me activate my account.`;
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleEmailSupport = () => {
    // Open email client to contact support
    const subject = "Account Activation Request - Zapeera";
    const body = `Hello,

My account is currently disabled and I need it to be activated.

Account Details:
- Username: ${currentUser?.username || 'N/A'}
- Email: ${currentUser?.email || 'N/A'}
- Name: ${currentUser?.name || 'N/A'}

Please help me activate my account so I can access the system.

Best regards,
${currentUser?.name || 'User'}`;

    const emailUrl = `mailto:support@zapeera.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(emailUrl, '_blank');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Check if user account is disabled
  console.log('🔍 ZapeeraDashboard: Current user:', currentUser);
  console.log('🔍 ZapeeraDashboard: User isActive:', currentUser?.isActive);

  if (currentUser && currentUser.isActive === false) {
    console.log('🔍 ZapeeraDashboard: User is disabled, showing disabled account message');
    return (
      <ZapeeraLayout>
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            {/* Disabled Account Message */}
            <Card className="shadow-xl border-0 mb-8">
              <CardContent className="p-8">
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-orange-600" />
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Account Disabled
                  </h1>
                  <p className="text-lg text-gray-600">
                    Your account is currently disabled and needs to be activated by an administrator.
                  </p>
                </div>

                {/* Contact Information */}
                <div className="bg-blue-50 rounded-lg p-6 mb-8">
                  <h3 className="font-semibold text-blue-900 mb-3 text-lg">Contact Support</h3>
                  <p className="text-blue-800 mb-4">
                    Please contact our support team to activate your account:
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-blue-700 text-lg">
                    <Phone className="w-5 h-5" />
                    <span className="font-medium">+923107100663</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <Button
                    onClick={handleContactSupport}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                    size="lg"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    Contact via WhatsApp
                  </Button>

                  <Button
                    onClick={handleEmailSupport}
                    variant="outline"
                    className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-3"
                    size="lg"
                  >
                    <Mail className="w-5 h-5 mr-2" />
                    Send Email
                  </Button>
                </div>

                {/* User Info */}
                <div className="bg-gray-50 rounded-lg p-6 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Your Account Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Username:</span>
                      <span className="ml-2 text-gray-600">{currentUser?.username || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Name:</span>
                      <span className="ml-2 text-gray-600">{currentUser?.name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Email:</span>
                      <span className="ml-2 text-gray-600">{currentUser?.email || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Role:</span>
                      <span className="ml-2 text-gray-600">{currentUser?.role || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="text-center">
                  <Button
                    onClick={handleLogout}
                    variant="ghost"
                    className="text-gray-500 hover:text-gray-700"
                    disabled={isLoggingOut}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ZapeeraLayout>
    );
  }

  return (
    <ZapeeraLayout>
      {/* Onboarding Tour */}
      <OnboardingTour
        steps={dashboardSteps}
        storageKey="zapeera-dashboard-tour"
        onComplete={(data) => {
          console.log('Dashboard tour completed!', data);
        }}
        onSkip={(data) => {
          console.log('Dashboard tour skipped!', data);
        }}
      />

      <div className="p-6">
        {/* Welcome Section */}
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Left Side - Welcome Content */}
            <div className="space-y-6">
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">
                  Welcome to Zapeera 👋
                </h1>
                <p className="text-lg text-gray-600 mb-8">
                  Manage all your businesses, branches, sales, and teams — all in one place.
                </p>

                {/* Create Company Button */}
                <Button
                  onClick={handleCreateBusiness}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Your Business
                </Button>
              </div>
            </div>

            {/* Right Side - Demo Card */}
            <div className="flex justify-center lg:justify-end">
              <Card className="w-full max-w-md bg-gray-100 border-0">
                <CardContent className="p-6">
                  <div className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="space-y-3 mb-4">
                      {/* Mock Chart Bars */}
                      <div className="flex items-end space-x-2 h-16">
                        <div className="w-4 bg-blue-200 rounded-t h-10"></div>
                        <div className="w-4 bg-blue-300 rounded-t h-12"></div>
                        <div className="w-4 bg-blue-400 rounded-t h-7"></div>
                        <div className="w-4 bg-blue-500 rounded-t h-14"></div>
                        <div className="w-4 bg-blue-600 rounded-t h-11"></div>
                      </div>
                      {/* Mock Line Chart */}
                      <div className="h-8 bg-gradient-to-r from-blue-100 to-blue-200 rounded"></div>
                    </div>
                    <div className="flex justify-center">
                      <button
                        className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
                        aria-label="Play demo video"
                      >
                        <span className="text-white text-xl">▶</span>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Need Help Section */}
          <div className="text-center mb-12 help-section">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Need Help?</h2>
            <div className="flex justify-center space-x-8">
              <button
                onClick={handleChatSupport}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Chat with Support
              </button>
              <button
                onClick={handleScheduleDemo}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Schedule a Demo Call
              </button>
              <button
                onClick={handleExploreDemo}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Explore Demo Business
              </button>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 feature-cards">
            {/* Multiple Businesses */}
            <Card className="bg-gray-50 border-0">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Multiple Businesses</h3>
                <p className="text-gray-600 text-sm">Manage all your businesses from a single account</p>
              </CardContent>
            </Card>

            {/* Smart Analytics */}
            <Card className="bg-gray-50 border-0">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Analytics</h3>
                <p className="text-gray-600 text-sm">Get insights into your sales, inventory, and more</p>
              </CardContent>
            </Card>

            {/* Real-time Operations */}
            <Card className="bg-gray-50 border-0">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Real-time Operations</h3>
                <p className="text-gray-600 text-sm">Track sales and inventory in real-time</p>
              </CardContent>
            </Card>

            {/* Role-based Access */}
            <Card className="bg-gray-50 border-0">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Key className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Role-based Access</h3>
                <p className="text-gray-600 text-sm">Control what each user can see and do</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create Company Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Company</DialogTitle>
            <DialogDescription>
              Fill in the details to create your new company.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Company Name *
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`mt-1 ${formErrors.name ? 'border-red-500' : ''}`}
                placeholder="Enter company name"
              />
              {formErrors.name && (
                <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
                placeholder="Enter company description"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="address" className="text-sm font-medium text-gray-700">
                Address
              </Label>
              <Input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="mt-1"
                placeholder="Enter company address"
              />
            </div>

            <div>
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1"
                placeholder="Enter phone number"
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1"
                placeholder="Enter email address"
              />
            </div>

            <DialogFooter className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleFormCancel}
                className="px-6 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                {isSubmitting ? 'Creating...' : 'Create Company'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ZapeeraLayout>
  );
};

export default ZapeeraDashboard;
