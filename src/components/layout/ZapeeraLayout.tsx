import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  CheckSquare,
  Settings,
  MessageCircle,
  Calendar,
  UserCircle,
  LogOut,
  User,
  ArrowLeft,
  ChevronDown
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ZapeeraLayoutProps {
  children: React.ReactNode;
}

const ZapeeraLayout = ({ children }: ZapeeraLayoutProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Update active tab based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard' || path === '/zapeera') {
      setActiveTab("dashboard");
    } else if (path.startsWith('/pos')) {
      setActiveTab("pos");
    } else if (path.startsWith('/admin/companies') || path.startsWith('/zapeera/companies')) {
      setActiveTab("businesses");
    } else if (path.startsWith('/settings')) {
      setActiveTab("settings");
    }
  }, [location.pathname]);

  const handleNavigation = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case "dashboard":
        // Navigate to Zapeera dashboard
        navigate('/zapeera');
        break;
      case "pos":
        navigate('/pos');
        break;
      case "businesses":
        navigate('/zapeera/companies');
        break;
      case "settings":
        navigate('/settings');
        break;
      default:
        break;
    }
  };

  const handleChatSupport = () => {
    // Open WhatsApp with the support number
    const phoneNumber = "+923107100663";
    const message = "Hello! I need support with Zapeera.";
    const whatsappUrl = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleScheduleDemo = () => {
    // Redirect to Zapeera contact page
    window.open('https://zapeera.com/contact', '_blank');
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleEditProfile = () => {
    navigate('/settings');
  };

  const handleBackToProfile = () => {
    navigate('/zapeera');
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo - Icon with text */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <img src={`${import.meta.env.BASE_URL}images/favicon.png`} alt="Zapeera" className="w-8 h-8 object-contain" />
            <span className="text-lg font-bold text-blue-900">Zapeera</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 sidebar-menu">
          <button
            onClick={() => handleNavigation("dashboard")}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "dashboard"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Dashboard</span>
          </button>

          <button
            onClick={() => handleNavigation("businesses")}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "businesses"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <CheckSquare className="w-5 h-5" />
            <span className="font-medium" >My Businesses</span>
          </button>


          <button
            onClick={() => handleNavigation("settings")}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "settings"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Settings</span>
          </button>
        </nav>

        {/* Need Help Section */}
        <div className="p-4 border-t border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Need Help?</h3>
          <div className="space-y-2">
            <button
              onClick={handleChatSupport}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">Chat with Support</span>
            </button>
            <button
              onClick={handleScheduleDemo}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Schedule a Demo Call</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold">Smart. Seamless. Scalable. That's Zapeera.</h2>
            </div>
            <div className="flex items-center space-x-4">
              {/* Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-full"
                  >
                    {user?.profileImage ? (
                      <img
                        src={user.profileImage}
                        alt="Profile"
                        className="w-8 h-8 rounded-full object-cover border-2 border-blue-600"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </span>
                      </div>
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.email || ''}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleEditProfile} className="cursor-pointer">
                    <User className="w-4 h-4 mr-2" />
                    Edit Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBackToProfile} className="cursor-pointer">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default ZapeeraLayout;
