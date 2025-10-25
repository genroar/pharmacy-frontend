import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Settings as SettingsIcon,
  User,
  Building,
  Wifi,
  WifiOff,
  Shield,
  Bell,
  Printer,
  Database,
  Smartphone,
  Monitor,
  Save,
  RefreshCw,
  Download,
  Upload,
  Edit,
  X
} from "lucide-react";
import SuperAdminSettings from "./SuperAdminSettings";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/api";

const Settings = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isEditingPharmacy, setIsEditingPharmacy] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isEditingPOS, setIsEditingPOS] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
    username: '',
    role: '',
    branchName: ''
  });
  const [originalPharmacySettings, setOriginalPharmacySettings] = useState({
    name: "Al-Shifa Pharmacy",
    address: "Block A, Gulberg III, Lahore",
    phone: "+92 42 1234567",
    email: "info@alshifapharmacy.com",
    license: "PHR-LHR-2024-001",
    taxNumber: "1234567890123"
  });
  const [settings, setSettings] = useState({
    pharmacy: {
      name: "Al-Shifa Pharmacy",
      address: "Block A, Gulberg III, Lahore",
      phone: "+92 42 1234567",
      email: "info@alshifapharmacy.com",
      license: "PHR-LHR-2024-001",
      taxNumber: "1234567890123"
    },
    pos: {
      autoSync: true,
      offlineMode: true,
      receiptPrinter: "EPSON TM-T20II",
      barcodePrinter: "Zebra ZD220",
      defaultTax: 17,
      lowStockAlert: 20,
      expiryAlert: 30
    },
    user: {
      name: userProfile.name || user?.name || "Loading...",
      email: userProfile.email || "Loading...",
      role: userProfile.role || user?.role || "Loading...",
      deviceId: "TABLET-001",
      lastLogin: "2024-01-15 10:30 AM"
    },
    security: {
      autoLogout: 30,
      requirePin: true,
      encryptData: true,
      backupEnabled: true,
      auditLog: true
    },
    notifications: {
      lowStock: true,
      expiry: true,
      sales: false,
      sync: true,
      errors: true
    }
  });

  const deviceStatus = {
    connectivity: isOnline ? "Online" : "Offline",
    lastSync: "2 minutes ago",
    storage: "2.3 GB / 32 GB",
    battery: "78%",
    printer: "Connected"
  };

  useEffect(() => {
    loadSettings();
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const response = await apiService.getProfile();
      if (response.success && response.data) {
        setUserProfile({
          name: response.data.name,
          email: response.data.email,
          username: response.data.username,
          role: response.data.role,
          branchName: response.data.branch?.name || 'Unknown Branch'
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      // Fallback to auth context data
      if (user) {
        setUserProfile({
          name: user.name,
          email: 'N/A',
          username: 'N/A',
          role: user.role,
          branchName: 'Unknown Branch'
        });
      }
    }
  };

  const handlePOSEdit = () => {
    setIsEditingPOS(true);
  };

  const handlePOSSave = async () => {
    try {
      // Save to localStorage for immediate availability
      localStorage.setItem('pos_settings', JSON.stringify(settings.pos));

      // Also save to a global variable for easy access in POS
      (window as any).globalPOSSettings = settings.pos;

      // Dispatch a custom event to notify other components about settings change
      window.dispatchEvent(new CustomEvent('posSettingsUpdated', {
        detail: settings.pos
      }));

      setIsEditingPOS(false);
      console.log('POS settings saved:', settings.pos);

      // Show success message
      alert(`POS settings saved successfully! Tax rate set to ${settings.pos.defaultTax}%`);
    } catch (error) {
      console.error('Error saving POS settings:', error);
      alert('Error saving settings. Please try again.');
    }
  };

  const handlePOSCancel = () => {
    setIsEditingPOS(false);
    // Reload settings from localStorage or reset to default
    loadSettings();
  };

  const handleSettingChange = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
  };

  const loadSettings = async () => {
    try {
      // First try to load from localStorage
      const savedPOSSettings = localStorage.getItem('pos_settings');
      if (savedPOSSettings) {
        const posData = JSON.parse(savedPOSSettings);
        setSettings(prev => ({
          ...prev,
          pos: {
            ...prev.pos,
            ...posData
          }
        }));
        return;
      }

      // If no localStorage data, try backend
      const settingsResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/settings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        if (settingsData.success && settingsData.data) {
          setSettings(prev => ({
            ...prev,
            pos: {
              ...prev.pos,
              defaultTax: parseFloat(settingsData.data.defaultTax) || 17,
              autoSync: settingsData.data.autoSync === 'true',
              offlineMode: settingsData.data.offlineMode === 'true',
              receiptPrinter: settingsData.data.receiptPrinter || 'EPSON TM-T20II'
            },
            pharmacy: {
              ...prev.pharmacy,
              name: settingsData.data.pharmacyName || 'Al-Shifa Pharmacy',
              address: settingsData.data.pharmacyAddress || 'Block A, Gulberg III, Lahore',
              phone: settingsData.data.pharmacyPhone || '+92 42 1234567',
              email: settingsData.data.pharmacyEmail || 'info@alshifapharmacy.com',
              license: settingsData.data.pharmacyLicense || 'PHR-LHR-2024-001',
              taxNumber: settingsData.data.pharmacyTaxNumber || '1234567890123'
            }
          }));
        }
      }

      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.success && userData.data) {
          setSettings(prev => ({
            ...prev,
            user: {
              ...prev.user,
              name: userData.data.name || prev.user.name,
              email: userData.data.email || prev.user.email,
              role: userData.data.role || prev.user.role,
              lastLogin: userData.data.lastLogin || prev.user.lastLogin
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          defaultTax: settings.pos.defaultTax,
          lowStockAlert: settings.pos.lowStockAlert,
          expiryAlert: settings.pos.expiryAlert,
          autoSync: settings.pos.autoSync,
          offlineMode: settings.pos.offlineMode,
          receiptPrinter: settings.pos.receiptPrinter,
          pharmacyName: settings.pharmacy.name,
          pharmacyAddress: settings.pharmacy.address,
          pharmacyPhone: settings.pharmacy.phone,
          pharmacyEmail: settings.pharmacy.email,
          pharmacyLicense: settings.pharmacy.license,
          pharmacyTaxNumber: settings.pharmacy.taxNumber
        })
      });

      if (response.ok) {
        alert('Settings saved successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to save settings: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    }
  };

  const handleExportData = async () => {
    try {
      // Create comprehensive data export
      const exportData = {
        settings: settings,
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        pharmacy: settings.pharmacy
      };

      // Convert to JSON
      const jsonString = JSON.stringify(exportData, null, 2);

      // Create and download file
      const blob = new Blob([jsonString], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `pharmacy_backup_${new Date().toISOString().split('T')[0]}.json`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert('Data exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const handleImportData = () => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedData = JSON.parse(text);

        // Validate imported data
        if (importedData.settings && importedData.pharmacy) {
          // Confirm import
          const confirmed = window.confirm(
            'This will replace your current settings. Are you sure you want to continue?'
          );

          if (confirmed) {
            setSettings(importedData.settings);
            alert('Data imported successfully!');
          }
        } else {
          alert('Invalid backup file format.');
        }
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import data. Please check the file format.');
      }
    };

    input.click();
  };

  const handleFactoryReset = () => {
    const confirmed = window.confirm(
      'This will reset ALL settings to default values. This action cannot be undone. Are you sure?'
    );

    if (confirmed) {
      const doubleConfirm = window.confirm(
        'Are you absolutely sure? This will permanently delete all your custom settings.'
      );

      if (doubleConfirm) {
        // Reset to default settings
        setSettings({
          pharmacy: {
            name: "Al-Shifa Pharmacy",
            address: "Block A, Gulberg III, Lahore",
            phone: "+92 42 1234567",
            email: "info@alshifapharmacy.com",
            license: "PHR-LHR-2024-001",
            taxNumber: "1234567890123"
          },
          pos: {
            autoSync: true,
            offlineMode: true,
            receiptPrinter: "EPSON TM-T20II",
            barcodePrinter: "Zebra ZD220",
            defaultTax: 17,
            lowStockAlert: 20,
            expiryAlert: 30
          },
          user: {
            name: userProfile.name || user?.name || "Loading...",
            email: userProfile.email || "Loading...",
            role: userProfile.role || user?.role || "Loading...",
            deviceId: "TABLET-001",
            lastLogin: "2024-01-15 10:30 AM"
          },
          security: {
            autoLogout: 30,
            requirePin: true,
            encryptData: true,
            backupEnabled: true,
            auditLog: true
          },
          notifications: {
            lowStock: true,
            expiry: true,
            sales: false,
            sync: true,
            errors: true
          }
        });

        alert('Settings have been reset to default values.');
      }
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('New passwords do not match. Please try again.');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      if (response.ok) {
        alert('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setIsChangingPassword(false);
      } else {
        const error = await response.json();
        alert(`Failed to change password: ${error.message}`);
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Error changing password. Please try again.');
    }
  };

  const handleUpdateProfile = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name: settings.user.name,
          email: settings.user.email
        })
      });

      if (response.ok) {
        alert('Profile updated successfully!');
        setIsEditingProfile(false);
      } else {
        const error = await response.json();
        alert(`Failed to update profile: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile. Please try again.');
    }
  };

  const handleUpdateProfilePicture = () => {
    // Create file input element for image selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file.');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB.');
        return;
      }

      try {
        // Here you would typically upload the image to your server
        // For now, we'll just show a success message
        alert('Profile picture updated successfully!');

        // You could also update the user's profile picture in the state
        // setSettings(prev => ({
        //   ...prev,
        //   user: {
        //     ...prev.user,
        //     profilePicture: URL.createObjectURL(file)
        //   }
        // }));
      } catch (error) {
        console.error('Profile picture update error:', error);
        alert('Failed to update profile picture. Please try again.');
      }
    };

    input.click();
  };

  // Show SuperAdminSettings for super admin users
  if (user?.role === 'SUPERADMIN') {
    return <SuperAdminSettings />;
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your pharmacy POS configuration</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" /> l
            Sync Now
          </Button>
          <Button
            onClick={handleSaveSettings}
            className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Device Status */}
      <Card className="shadow-soft border-[1px] border-[#0C2C8A]">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Monitor className="w-5 h-5 text-[#0C2C8A]" />
            <span>Device Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                {isOnline ? (
                  <Wifi className="w-8 h-8 text-green-600" />
                ) : (
                  <WifiOff className="w-8 h-8 text-yellow-600" />
                )}
              </div>
              <p className="text-sm font-medium text-foreground">{deviceStatus.connectivity}</p>
              <p className="text-xs text-muted-foreground">Connection</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Database className="w-8 h-8 text-[#0C2C8A]" />
              </div>
              <p className="text-sm font-medium text-foreground">{deviceStatus.lastSync}</p>
              <p className="text-xs text-muted-foreground">Last Sync</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Smartphone className="w-8 h-8 text-[#0C2C8A]" />
              </div>
              <p className="text-sm font-medium text-foreground">{deviceStatus.storage}</p>
              <p className="text-xs text-muted-foreground">Storage</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Shield className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm font-medium text-foreground">{deviceStatus.battery}</p>
              <p className="text-xs text-muted-foreground">Battery</p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center mb-2">
                <Printer className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="text-sm font-medium text-foreground">{deviceStatus.printer}</p>
              <p className="text-xs text-muted-foreground">Printer</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Profile Section */}
      <div className="mb-6">
        {/* User Profile */}
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-[#0C2C8A]" />
                <span>User Profile</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
              >
                <Edit className="w-4 h-4 mr-2" />
                {isEditingProfile ? 'Cancel' : 'Edit'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-[#0C2C8A]/10 rounded-full flex items-center justify-center">
                <span className="text-xl font-semibold text-[#0C2C8A]">
                  {settings.user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{settings.user.name}</h3>
                <Badge variant="outline" className="bg-[#0C2C8A]/10 text-[#0C2C8A] border-[#0C2C8A]/20">
                  {settings.user.role}
                </Badge>
                <p className="text-sm text-muted-foreground mt-1">Device: {settings.user.deviceId}</p>
              </div>
            </div>

            {isEditingProfile && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label htmlFor="user-name">Full Name</Label>
                  <Input
                    id="user-name"
                    value={settings.user.name}
                    onChange={(e) => handleSettingChange('user', 'name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    type="email"
                    value={settings.user.email || ''}
                    onChange={(e) => handleSettingChange('user', 'email', e.target.value)}
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handleUpdateProfile} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md hover:shadow-lg transition-all duration-200">
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditingProfile(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Last Login</Label>
              <p className="text-sm text-muted-foreground">{settings.user.lastLogin}</p>
            </div>

            {/* Password Change Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Change Password</Label>
                  <p className="text-xs text-muted-foreground">Update your account password</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                >
                  {isChangingPassword ? 'Cancel' : 'Change'}
                </Button>
              </div>

              {isChangingPassword && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                    />
                  </div>
                  <Button onClick={handleChangePassword} className="w-full bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md hover:shadow-lg transition-all duration-200">
                    <Save className="w-4 h-4 mr-2" />
                    Update Password
                  </Button>
                </div>
              )}
            </div>

          </CardContent>
        </Card>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pharmacy Information */}
        {/* <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building className="w-5 h-5 text-primary" />
              <span>Pharmacy Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pharmacy-name">Pharmacy Name</Label>
              <Input
                id="pharmacy-name"
                value={settings.pharmacy.name}
                onChange={(e) => handleSettingChange('pharmacy', 'name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pharmacy-address">Address</Label>
              <Input
                id="pharmacy-address"
                value={settings.pharmacy.address}
                onChange={(e) => handleSettingChange('pharmacy', 'address', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pharmacy-phone">Phone</Label>
                <Input
                  id="pharmacy-phone"
                  value={settings.pharmacy.phone}
                  onChange={(e) => handleSettingChange('pharmacy', 'phone', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pharmacy-email">Email</Label>
                <Input
                  id="pharmacy-email"
                  type="email"
                  value={settings.pharmacy.email}
                  onChange={(e) => handleSettingChange('pharmacy', 'email', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pharmacy-license">License Number</Label>
                <Input
                  id="pharmacy-license"
                  value={settings.pharmacy.license}
                  onChange={(e) => handleSettingChange('pharmacy', 'license', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pharmacy-tax">Tax Number</Label>
                <Input
                  id="pharmacy-tax"
                  value={settings.pharmacy.taxNumber}
                  onChange={(e) => handleSettingChange('pharmacy', 'taxNumber', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card> */}

        {/* POS Configuration */}
        <Card className="shadow-soft border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <SettingsIcon className="w-5 h-5 text-[#0C2C8A]" />
                <span>POS Configuration</span>
              </CardTitle>
              <div className="flex space-x-2">
                {!isEditingPOS ? (
                  <Button onClick={handlePOSEdit} variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex space-x-2">
                    <Button onClick={handlePOSSave} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md hover:shadow-lg transition-all duration-200">
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button onClick={handlePOSCancel} variant="outline" size="sm">
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-sync">Auto Sync</Label>
                <p className="text-xs text-muted-foreground">Automatically sync when online</p>
              </div>
              <Switch
                id="auto-sync"
                checked={settings.pos.autoSync}
                onCheckedChange={(checked) => handleSettingChange('pos', 'autoSync', checked)}
                disabled={!isEditingPOS}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="offline-mode">Offline Mode</Label>
                <p className="text-xs text-muted-foreground">Allow operations without internet</p>
              </div>
              <Switch
                id="offline-mode"
                checked={settings.pos.offlineMode}
                onCheckedChange={(checked) => handleSettingChange('pos', 'offlineMode', checked)}
                disabled={!isEditingPOS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="receipt-printer">Receipt Printer</Label>
              <Input
                id="receipt-printer"
                value={settings.pos.receiptPrinter}
                onChange={(e) => handleSettingChange('pos', 'receiptPrinter', e.target.value)}
                disabled={!isEditingPOS}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-tax">Default Tax (%)</Label>
              <Input
                id="default-tax"
                type="number"
                value={settings.pos.defaultTax || ''}
                onChange={(e) => handleSettingChange('pos', 'defaultTax', parseFloat(e.target.value) || 0)}
                disabled={!isEditingPOS}
                placeholder="Enter tax percentage (e.g., 17 for 17%)"
              />
              <p className="text-xs text-muted-foreground">
                This tax rate will be automatically applied to all sales. Set to 0 for no tax.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Security & Notifications */}
        {/* <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-[#0C2C8A]" />
              <span>Security & Notifications</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="encrypt-data">Encrypt local data</Label>
                  <p className="text-xs text-muted-foreground">Secure offline storage</p>
                </div>
                <Switch
                  id="encrypt-data"
                  checked={settings.security.encryptData}
                  onCheckedChange={(checked) => handleSettingChange('security', 'encryptData', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="low-stock-notif">Low stock notifications</Label>
                </div>
                <Switch
                  id="low-stock-notif"
                  checked={settings.notifications.lowStock}
                  onCheckedChange={(checked) => handleSettingChange('notifications', 'lowStock', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="expiry-notif">Expiry notifications</Label>
                </div>
                <Switch
                  id="expiry-notif"
                  checked={settings.notifications.expiry}
                  onCheckedChange={(checked) => handleSettingChange('notifications', 'expiry', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="sync-notif">Sync notifications</Label>
                </div>
                <Switch
                  id="sync-notif"
                  checked={settings.notifications.sync}
                  onCheckedChange={(checked) => handleSettingChange('notifications', 'sync', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card> */}
      </div>


    </div>
  );
};

export default Settings;