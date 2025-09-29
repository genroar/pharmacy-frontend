import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/AppSidebar";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";
import { Button } from "@/components/ui/button";
import { Bell, Menu, LogOut, User, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useState, useEffect, useRef } from "react";
import { createContext, useContext } from "react";

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
        <div className="h-screen pr-[20px] py-[20px] flex w-full bg-[#0c2c8a] overflow-hidden">
          <RoleBasedSidebar />

          <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${isCollapsed ? 'ml-16' : 'ml-64'}`}>
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