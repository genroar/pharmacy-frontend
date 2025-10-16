import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  CheckSquare,
  Building,
  Settings,
  MessageCircle,
  Calendar,
  Bell,
  ShoppingCart
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface ZapeeraLayoutProps {
  children: React.ReactNode;
}

const ZapeeraLayout = ({ children }: ZapeeraLayoutProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Update active tab based on current route
  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setActiveTab("dashboard");
    } else if (path.startsWith('/pos')) {
      setActiveTab("pos");
    } else if (path.startsWith('/admin/companies')) {
      setActiveTab("businesses");
    } else if (path.startsWith('/admin/branches')) {
      setActiveTab("branches");
    } else if (path.startsWith('/settings')) {
      setActiveTab("settings");
    }
  }, [location.pathname]);

  const handleNavigation = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case "dashboard":
        navigate('/');
        break;
      case "pos":
        navigate('/pos');
        break;
      case "businesses":
        navigate('/admin/companies');
        break;
      case "branches":
        navigate('/admin/branches');
        break;
      case "settings":
        navigate('/settings');
        break;
      default:
        break;
    }
  };

  const handleChatSupport = () => {
    // Implement chat support functionality
    console.log("Chat with support clicked");
  };

  const handleScheduleDemo = () => {
    // Implement demo scheduling functionality
    console.log("Schedule demo clicked");
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">Z</span>
            </div>
            <span className="text-xl font-semibold text-gray-900">Zapeera</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
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
            <span className="font-medium">Businesses</span>
          </button>

          <button
            onClick={() => handleNavigation("branches")}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
              activeTab === "branches"
                ? "bg-blue-50 text-blue-600"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Building className="w-5 h-5" />
            <span className="font-medium">Branches</span>
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
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">Z</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">Zapeera</span>
            </div>
            <div className="flex items-center space-x-4">
              <button
                className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
              </button>
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
