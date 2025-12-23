import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/AppSidebar";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Menu, LogOut, User, Building2, ShoppingCart, UserCircle, Building, ChevronDown, Wifi, WifiOff, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useState, useEffect, useRef } from "react";
import { createContext, useContext } from "react";
import { useNavigate } from "react-router-dom";

interface MainLayoutProps {
  children: React.ReactNode;
}

// Create a context for sidebar state
const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}>({
  isCollapsed: false,
  setIsCollapsed: () => {}
});

export const useSidebarContext = () => useContext(SidebarContext);

const MainLayout = ({ children }: MainLayoutProps) => {
  const { user, logout } = useAuth();
  const { selectedBranch, selectedBranchId, selectedCompanyId, setSelectedCompanyId, setSelectedBranchId, allCompanies, allBranches } = useAdmin();
  const navigate = useNavigate();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleCompanySwitch = (companyId: string) => {
    setSelectedCompanyId(companyId);
    // Note: AdminContext's handleSetSelectedCompanyId already clears branch selection
    // No need to reload - React state updates will trigger re-renders
    console.log('🏢 Company switched to:', companyId);
  };

  const handleBranchSwitch = (branchId: string) => {
    if (branchId === 'all') {
      // Clear branch selection
      setSelectedBranchId(null);
    } else {
      // Set branch selection
      setSelectedBranchId(branchId);
    }
    // No need to reload - React state updates will trigger re-renders
    console.log('🏢 Branch switched to:', branchId);
  };
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Temporarily disabled timer to test re-rendering issue
  // useEffect(() => {
  //   const updateDateTime = () => {
  //     setCurrentDateTime(new Date());
  //   };

  //   updateDateTime();
  //   timerRef.current = setInterval(updateDateTime, 1000);

  //   return () => {
  //     if (timerRef.current) {
  //       clearInterval(timerRef.current);
  //       timerRef.current = null;
  //     }
  //   };
  // }, []);

  return (
    <SidebarProvider>
      <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
        <div className="h-screen  flex w-full bg-gray-50 overflow-hidden">
          <RoleBasedSidebar />

          <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
            {/* Header with New Sale button and Online/Offline status */}
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => navigate('/create-invoice')}
                  className="bg-[#1D4ED8] hover:bg-[#0a2470] text-white px-4 py-1.5 rounded-md font-medium text-sm shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                >
                  New Sale
                </Button>

                {/* Online/Offline Status Badge */}
                <Badge
                  variant="outline"
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium ${
                    isOnline
                      ? 'bg-green-50 text-green-700 border-green-300'
                      : 'bg-orange-50 text-orange-700 border-orange-300'
                  }`}
                >
                  {isOnline ? (
                    <Wifi className="w-3.5 h-3.5" />
                  ) : (
                    <WifiOff className="w-3.5 h-3.5" />
                  )}
                  {isOnline ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div className="flex items-center space-x-3">

                {/* Branch Selection Dropdown for Admins */}
                {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && selectedCompanyId && allBranches && allBranches.filter((branch: any) => branch.companyId === selectedCompanyId).length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-8 px-3 text-sm border-amber-200 bg-white hover:bg-amber-50">
                        <Building2 className="w-4 h-4 mr-2 text-amber-600" />
                        {selectedBranch?.name || 'All branches'}
                        <ChevronDown className="w-3 h-3 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => handleBranchSwitch('all')}
                        className="cursor-pointer"
                      >
                        <Building2 className="w-4 h-4 mr-2 text-amber-600" />
                        <span>All branches</span>
                      </DropdownMenuItem>
                      {allBranches.filter((branch: any) => branch.companyId === selectedCompanyId).map((branch: any) => (
                        <DropdownMenuItem
                          key={branch.id}
                          onClick={() => handleBranchSwitch(branch.id)}
                          className="cursor-pointer"
                        >
                          <Building2 className="w-4 h-4 mr-2 text-amber-600" />
                          <span>{branch.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {/* Switch Business Button for Admins */}
                {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && allCompanies && allCompanies.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-8 px-3 text-sm border-blue-200 bg-white hover:bg-blue-50">
                        <Building className="w-4 h-4 mr-2 text-blue-600" />
                        {selectedCompanyId
                          ? allCompanies.find((c: any) => c.id === selectedCompanyId)?.name || 'Switch Business'
                          : 'Switch Business'}
                        <ChevronDown className="w-3 h-3 ml-2" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {allCompanies.map((company: any) => (
                        <DropdownMenuItem
                          key={company.id}
                          onClick={() => handleCompanySwitch(company.id)}
                          className="cursor-pointer"
                        >
                          <Building className="w-4 h-4 mr-2 text-blue-600" />
                          <span>{company.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {/* Profile Icon Dropdown - Visible to all users */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-0 hover:bg-blue-100 rounded-full transition-colors h-10 w-10"
                    >
                      {user?.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt="Profile"
                          className="w-full h-full rounded-full object-cover border-2 border-blue-600"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserCircle className="w-10 h-10 text-blue-600" />
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email || 'No email'}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
                      <User className="w-4 h-4 mr-2" />
                      Edit Profile
                    </DropdownMenuItem>
                    {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
                      <DropdownMenuItem onClick={() => navigate('/zapeera')} className="cursor-pointer">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Dashboard
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="cursor-pointer text-red-600 focus:text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto rounded-lg bg-white">
              {children}
            </main>
          </div>
        </div>
      </SidebarContext.Provider>
    </SidebarProvider>
  );
};

export default MainLayout;