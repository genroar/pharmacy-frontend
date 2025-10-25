import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/AppSidebar";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";
import { Button } from "@/components/ui/button";
import { Bell, Menu, LogOut, User, Building2, ShoppingCart, UserCircle } from "lucide-react";
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
  const { selectedBranch, selectedBranchId } = useAdmin();
  const navigate = useNavigate();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
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
              <div className="text-sm text-blue-900">
                {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') ? (
                  <>Current branch: <span className="font-semibold">{selectedBranch?.name || 'All branches'}</span></>
                ) : (
                  <>Welcome, <span className="font-semibold">{user?.name || 'User'}</span></>
                )}
              </div>
              <div className="flex items-center space-x-3">
                {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
                  selectedBranchId ? (
                    <Badge variant="outline" className="text-xs border-blue-200 text-blue-900">{selectedBranch?.name}</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs border-amber-200 text-amber-900">All branches</Badge>
                  )
                )}
                <Button
                  onClick={() => navigate('/create-invoice')}
                  className="bg-[#0C2C8A] hover:bg-[#0a2470] text-white px-4 py-1.5 rounded-md font-medium text-sm shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  New Sale
                </Button>
                {/* Profile Icon */}
                <Button
                  onClick={() => navigate('/zapeera')}
                  variant="ghost"
                  size="sm"
                  className="p-2 hover:bg-blue-100 rounded-full transition-colors"
                  title="Zapeera Profile"
                >
                  <UserCircle className="w-6 h-6 text-blue-600" />
                </Button>
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