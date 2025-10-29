import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/AppSidebar";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Bell, Menu, LogOut, User, Building2, ShoppingCart, UserCircle, Building, ChevronDown } from "lucide-react";
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

  const handleCompanySwitch = (companyId: string) => {
    setSelectedCompanyId(companyId);
    // Clear branch selection to show all branches data by default
    setSelectedBranchId(null);
    // Clear branch selection from localStorage
    if (user?.id) {
      localStorage.removeItem(`selected_branch_${user.id}`);
    }
    // Optionally refresh the page or reload data
    window.location.reload();
  };

  const handleBranchSwitch = (branchId: string) => {
    if (branchId === 'all') {
      // Clear branch selection
      setSelectedBranchId(null);
      if (user?.id) {
        localStorage.removeItem(`selected_branch_${user.id}`);
      }
    } else {
      // Set branch selection
      setSelectedBranchId(branchId);
      if (user?.id) {
        localStorage.setItem(`selected_branch_${user.id}`, branchId);
      }
    }
    // Optionally refresh the page or reload data
    window.location.reload();
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
            {/* Header with New Sale button for all users */}
            <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between sticky top-0 z-10">
              <div className="text-sm flex text-blue-900">
              <Button
                  onClick={() => navigate('/create-invoice')}
                  className="bg-[#1D4ED8] hover:bg-[#0a2470] text-white px-4 py-1.5 rounded-md font-medium text-sm shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                >
                  New Sale
                </Button>
                {/* {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') ? (
                  <>Current branch: <span className="font-semibold">{selectedBranch?.name || 'All branches'}</span></>
                ) : (
                  <>Welcome, <span className="font-semibold">{user?.name || 'User'}</span></>
                )} */}
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

                {/* Profile Icon Dropdown - Only visible to Admin and SuperAdmin */}
                {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
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
                        <UserCircle className="w-4 h-4 mr-2" />
                        Edit Profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/zapeera')} className="cursor-pointer">
                        <UserCircle className="w-4 h-4 mr-2" />
                        Back to Profile
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
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