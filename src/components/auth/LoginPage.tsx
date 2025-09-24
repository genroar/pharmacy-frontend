import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Stethoscope, Wifi, WifiOff } from "lucide-react";
import { useAdmin } from "@/contexts/AdminContext";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'manager' | 'cashier'>('cashier');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const { loginAsAdmin } = useAdmin();
  const navigate = useNavigate();

  const roles = [
    { id: 'admin', label: 'Admin', icon: Shield },
    { id: 'manager', label: 'Manager', icon: Stethoscope },
    { id: 'cashier', label: 'Cashier', icon: Stethoscope }
  ];

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-foreground">MediBill Pulse</span>
          </div>
          
          {/* Connection Status */}
          <div className="flex items-center justify-center space-x-2">
            {isOnline ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                <Wifi className="w-3 h-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                <WifiOff className="w-3 h-3 mr-1" />
                Offline Mode
              </Badge>
            )}
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-medium border-0">
          <CardHeader className="space-y-4">
            <CardTitle className="text-center text-xl text-foreground">
              Welcome Back
            </CardTitle>
            
            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">Select Role</Label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map((role) => {
                  const IconComponent = role.icon;
                  return (
                    <button
                      key={role.id}
                      onClick={() => {
                        setSelectedRole(role.id as any);
                        setIsAdminMode(role.id === 'admin');
                      }}
                      className={`p-3 rounded-lg border text-center transition-all ${
                        selectedRole === role.id
                          ? 'bg-primary text-primary-foreground border-primary shadow-soft'
                          : 'bg-card hover:bg-muted/50 border-border'
                      }`}
                    >
                      <IconComponent className="w-4 h-4 mx-auto mb-1" />
                      <span className="text-xs font-medium">{role.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Admin Mode Toggle */}
            {selectedRole === 'admin' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Admin Mode</Label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsAdminMode(false)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                      !isAdminMode
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card hover:bg-muted/50 border-border'
                    }`}
                  >
                    Branch User
                  </button>
                  <button
                    onClick={() => setIsAdminMode(true)}
                    className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                      isAdminMode
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card hover:bg-muted/50 border-border'
                    }`}
                  >
                    System Admin
                  </button>
                </div>
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Login Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your username"
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  className="h-11"
                />
              </div>
            </div>

            {/* Login Button */}
            <Button 
              className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity"
              onClick={() => {
                if (isAdminMode) {
                  loginAsAdmin('admin');
                  navigate('/admin');
                } else {
                  loginAsAdmin(selectedRole);
                  navigate('/');
                }
              }}
            >
              {isAdminMode ? 'Admin Sign In' : 'Sign In'}
            </Button>

            {/* Admin Info */}
            {isAdminMode && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-xs text-primary text-center">
                  <Shield className="w-3 h-3 inline mr-1" />
                  System Admin Access - Full control over all branches and users
                </p>
              </div>
            )}

            {/* Quick PIN Access */}
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground text-center mb-3">
                Quick Access (Last Session)
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <Button
                    key={num}
                    variant="outline"
                    size="sm"
                    className="h-10 text-lg font-medium"
                  >
                    {num === 9 ? '•' : num}
                  </Button>
                ))}
                <Button variant="outline" size="sm" className="h-10">
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 text-lg font-medium"
                >
                  0
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 bg-primary text-primary-foreground"
                >
                  ✓
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>Offline-First Pharmacy POS</p>
          <p className="mt-1">Device ID: DEVICE-001 • Last Sync: 2 min ago</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;