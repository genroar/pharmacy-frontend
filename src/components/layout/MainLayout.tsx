import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/layout/AppSidebar";
import { RoleBasedSidebar } from "@/components/layout/RoleBasedSidebar";
import { Button } from "@/components/ui/button";
import { Bell, Menu, LogOut, User, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { useState, useEffect, useRef } from "react";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  const { user, logout } = useAuth();
  const { selectedBranch, selectedBranchId } = useAdmin();
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
      <div className="min-h-screen flex w-full bg-background">
        <RoleBasedSidebar />

        <div className="flex-1 flex flex-col ml-64">
          {/* Top Header */}
          <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card">
            <div className="flex  items-center ">
              <SidebarTrigger className="lg:hidden">
                <Menu className="w-5 h-5" />
              </SidebarTrigger>
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-primary" />
                <div>
                  <h1 className="text-lg font-semibold text-foreground">
                    {selectedBranchId ? selectedBranch?.name : "Admin Dashboard"}
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Date and Time */}
              <div className="text-right text-sm">
                <p className="text-foreground font-medium">
                  {currentDateTime.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-muted-foreground text-xs">
                  {currentDateTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>

              {/* User Info */}
              <div className="flex items-center space-x-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{user?.name}</span>
                <span className="text-muted-foreground">({user?.role})</span>
              </div>

              <Button variant="ghost" size="sm">
                <Bell className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;