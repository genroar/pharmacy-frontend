import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { apiService } from '@/services/api';
import { useAuth } from './AuthContext';

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  companyId?: string;
}

interface Company {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  businessType?: string;
  isActive: boolean;
  branches?: Branch[];
}

interface AdminContextType {
  selectedCompanyId: string | null;
  setSelectedCompanyId: (companyId: string | null) => void;
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string | null) => void;
  allCompanies: Company[];
  allBranches: Branch[];
  selectedCompany: Company | null;
  selectedBranch: Branch | null;
  isLoading: boolean;
  error: string | null;
  refreshCompanies: () => Promise<void>;
  refreshBranches: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

interface AdminProviderProps {
  children: ReactNode;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  // Guard against calling useAuth outside of provider
  let authContext;
  try {
    authContext = useAuth();
  } catch (error) {
    // If useAuth fails, return children without context functionality
    console.warn('AdminProvider: useAuth failed, rendering without context');
    return <>{children}</>;
  }

  const { isAuthenticated, user } = authContext;
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false); // Track if initial setup is done


  const selectedCompany = selectedCompanyId
    ? allCompanies.find(company => company.id === selectedCompanyId) || null
    : null;

  const selectedBranch = selectedBranchId
    ? allBranches.find(branch => branch.id === selectedBranchId) || null
    : null;

  const refreshCompanies = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('Not authenticated, skipping company loading');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.getCompanies();

      if (response.success && response.data) {
        setAllCompanies(response.data || []);
        console.log('🏢 Loaded companies:', response.data.length);
      } else {
        setError('Failed to load companies');
      }
    } catch (err) {
      console.error('Error loading companies:', err);
      setError('Failed to load companies');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const refreshBranches = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('Not authenticated, skipping branch loading');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.getBranches();

      if (response.success && response.data) {
        const branchesData = Array.isArray(response.data) ? response.data : response.data.branches;
        setAllBranches(branchesData || []);
        console.log('🏢 Loaded branches:', branchesData?.length || 0);
      } else {
        setError('Failed to load branches');
      }
    } catch (err) {
      console.error('Error loading branches:', err);
      setError('Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]); // Removed selectedBranchId dependency to prevent infinite loop

  // Memoize the context getter function
  const contextGetter = useCallback(() => ({
    companyId: selectedCompanyId || undefined,
    branchId: selectedBranchId || undefined
  }), [selectedCompanyId, selectedBranchId]);

  // Set up API context getter
  useEffect(() => {
    apiService.setContextGetter(contextGetter);
  }, [contextGetter]);

  // Reset hasInitialized when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setHasInitialized(false);
      setSelectedCompanyId(null);
      setSelectedBranchId(null);
    }
  }, [isAuthenticated]);

  // Load saved selections from localStorage on mount - ONLY ONCE per login
  useEffect(() => {
    if (isAuthenticated && user && !hasInitialized) {
      // Mark as initialized to prevent re-running this logic
      setHasInitialized(true);

      // For managers and cashiers, automatically set their assigned branch
      if ((user.role === 'MANAGER' || user.role === 'CASHIER') && user.branchId) {
        setSelectedBranchId(user.branchId);
        // Also set company from their branch
        if (user.companyId) {
          setSelectedCompanyId(user.companyId);
        }
        console.log('🏢 Auto-selected assigned branch:', user.branchId);
      } else if (user.role === 'ADMIN') {
        // For ADMIN users: Check if this is a fresh login
        const isFreshLogin = localStorage.getItem(`fresh_admin_login_${user.id}`);

        if (isFreshLogin) {
          // Fresh login - show Zapeera screen first
          console.log('🏢 Admin user - fresh login, will show Zapeera screen');
          // Remove the flag so next app open (without logging in again) can restore selections
          localStorage.removeItem(`fresh_admin_login_${user.id}`);
          // Keep selections null to show Zapeera
        } else {
          // Not a fresh login - restore selections from localStorage
          const savedCompanyId = localStorage.getItem(`selected_company_${user.id}`);
          const savedBranchId = localStorage.getItem(`selected_branch_${user.id}`);

          if (savedCompanyId) {
            setSelectedCompanyId(savedCompanyId);
            console.log('🏢 Admin user - restored company:', savedCompanyId);
          }
          if (savedBranchId) {
            setSelectedBranchId(savedBranchId);
            console.log('🏢 Admin user - restored branch:', savedBranchId);
          }
        }
      } else if (user.role === 'SUPERADMIN') {
        // For SUPERADMIN: Can optionally restore selections
        const savedCompanyId = localStorage.getItem(`selected_company_${user.id}`);
        const savedBranchId = localStorage.getItem(`selected_branch_${user.id}`);

        if (savedCompanyId) {
          setSelectedCompanyId(savedCompanyId);
          console.log('🏢 SuperAdmin restored selected company:', savedCompanyId);
        }

        if (savedBranchId) {
          setSelectedBranchId(savedBranchId);
          console.log('🏢 SuperAdmin restored selected branch:', savedBranchId);
        }
      }

      // Load companies and branches
      refreshCompanies();
      refreshBranches();
    }
  }, [isAuthenticated, user, hasInitialized, refreshCompanies, refreshBranches]);

  // Auto-select first branch for ADMIN/SUPERADMIN if no branch is selected (after branches are loaded)
  useEffect(() => {
    if (isAuthenticated && user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN') && hasInitialized) {
      // Only auto-select if no branch is currently selected and branches are loaded
      if (!selectedBranchId && allBranches.length > 0) {
        // Check if there's a saved branch first
        const savedBranchId = localStorage.getItem(`selected_branch_${user.id}`);
        if (savedBranchId && allBranches.find(b => b.id === savedBranchId)) {
          // Use saved branch if it exists
          setSelectedBranchId(savedBranchId);
          console.log('🏢 Auto-selected saved branch:', savedBranchId);
        } else {
          // Auto-select first branch
          const firstBranch = allBranches[0];
          if (firstBranch) {
            setSelectedBranchId(firstBranch.id);
            // Also set company if not already set
            if (!selectedCompanyId && firstBranch.companyId) {
              setSelectedCompanyId(firstBranch.companyId);
            }
            console.log('🏢 Auto-selected first branch:', firstBranch.name);
          }
        }
      }
    }
  }, [isAuthenticated, user, allBranches, selectedBranchId, selectedCompanyId, hasInitialized, setSelectedBranchId, setSelectedCompanyId]);

  // Save company selection to localStorage
  const handleSetSelectedCompanyId = useCallback((companyId: string | null) => {
    // For managers, prevent company selection changes
    if (user?.role === 'MANAGER') {
      console.warn('🏢 Manager cannot change company selection');
      return;
    }

    setSelectedCompanyId(companyId);
    if (user) {
      if (companyId) {
        localStorage.setItem(`selected_company_${user.id}`, companyId);
        console.log('🏢 Saved selected company:', companyId);

        // Don't auto-select branch - let user select from dropdown
        // Clear branch selection to show all branches data by default
        setSelectedBranchId(null);
        localStorage.removeItem(`selected_branch_${user.id}`);
        console.log('🏢 Cleared branch selection to show all branches by default');
      } else {
        localStorage.removeItem(`selected_company_${user.id}`);
        console.log('🏢 Cleared selected company');

        // Clear branch selection when company is cleared
        setSelectedBranchId(null);
        localStorage.removeItem(`selected_branch_${user.id}`);
        console.log('🏢 Cleared selected branch due to company change');
      }
    }
  }, [user, allBranches]);

  // Save branch selection to localStorage
  const handleSetSelectedBranchId = useCallback((branchId: string | null) => {
    // For managers, only allow their assigned branch
    if (user?.role === 'MANAGER') {
      if (branchId !== user.branchId) {
        console.warn('🏢 Manager cannot select different branch, using assigned branch:', user.branchId);
        setSelectedBranchId(user.branchId);
        return;
      }
    }

    setSelectedBranchId(branchId);
    if (user) {
      if (branchId) {
        localStorage.setItem(`selected_branch_${user.id}`, branchId);
        console.log('🏢 Saved selected branch:', branchId);
      } else {
        localStorage.removeItem(`selected_branch_${user.id}`);
        console.log('🏢 Cleared selected branch');
      }
    }
  }, [user]);

  const value: AdminContextType = useMemo(() => ({
    selectedCompanyId,
    setSelectedCompanyId: handleSetSelectedCompanyId,
    selectedBranchId,
    setSelectedBranchId: handleSetSelectedBranchId,
    allCompanies,
    allBranches,
    selectedCompany,
    selectedBranch,
    isLoading,
    error,
    refreshCompanies,
    refreshBranches
  }), [
    selectedCompanyId,
    handleSetSelectedCompanyId,
    selectedBranchId,
    handleSetSelectedBranchId,
    allCompanies,
    allBranches,
    selectedCompany,
    selectedBranch,
    isLoading,
    error,
    refreshCompanies,
    refreshBranches
  ]);

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};