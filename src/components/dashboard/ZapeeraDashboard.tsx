import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Briefcase,
  BarChart3,
  Star,
  Key,
  Building,
  Plus
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
  const { user } = useAuth();
  const { setSelectedCompanyId, allCompanies } = useAdmin();
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [showCompanySelection, setShowCompanySelection] = useState(false);

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

  // Check if user has companies and if any need business type
  useEffect(() => {
    if (allCompanies) {
      const hasNoCompanies = allCompanies.length === 0;
      const companyNeedingType = allCompanies.find((company: any) => !company.businessType);

      if (hasNoCompanies || companyNeedingType) {
        setShowCompanySelection(true);
      }
    }
  }, [allCompanies]);

  const handleCreateBusiness = () => {
    navigate('/admin/companies');
  };

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompany(companyId);
  };

  const handleContinueWithCompany = () => {
    if (!selectedCompany) {
      toast({
        title: "Please select a company",
        description: "Choose a company to continue.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    // Set the selected company in AdminContext
    setSelectedCompanyId(selectedCompany);

    // Find the selected company details
    const company = allCompanies.find(c => c.id === selectedCompany);

    // Show success message
    toast({
      title: "Company Selected",
      description: `You are now viewing ${company?.name || 'the selected company'}'s dashboard.`,
      duration: 3000,
    });

    // Navigate to the main dashboard with the selected company context
    navigate('/dashboard');
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

                {/* Company Selection */}
                {showCompanySelection ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Select Your Company
                      </label>
                      <Select value={selectedCompany} onValueChange={handleCompanySelect}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose your company" />
                        </SelectTrigger>
                        <SelectContent>
                          {allCompanies?.map((company: any) => (
                            <SelectItem
                              key={company.id}
                              value={company.id}
                              className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                            >
                              <div className="flex items-center space-x-2">
                                <Building className="w-4 h-4" />
                                <span>{company.name}</span>
                                {!company.businessType && (
                                  <span className="text-xs text-orange-600">(Setup Required)</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex space-x-3">
                      <Button
                        onClick={handleContinueWithCompany}
                        disabled={!selectedCompany}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                      >
                        Continue
                      </Button>
                      <Button
                        onClick={handleCreateBusiness}
                        variant="outline"
                        className="border-blue-600 text-blue-600 hover:bg-blue-50 px-6 py-2"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Company
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={handleCreateBusiness}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium"
                  >
                    Create Your First Business
                  </Button>
                )}
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
    </ZapeeraLayout>
  );
};

export default ZapeeraDashboard;
