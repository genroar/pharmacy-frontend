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
  const { isAuthenticated, user } = useAuth();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


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
  }, [isAuthenticated]);

  // Memoize the context getter function
  const contextGetter = useCallback(() => ({
    companyId: selectedCompanyId || undefined,
    branchId: selectedBranchId || undefined
  }), [selectedCompanyId, selectedBranchId]);

  // Set up API context getter
  useEffect(() => {
    apiService.setContextGetter(contextGetter);
  }, [contextGetter]);

  // Load saved selections from localStorage on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      const savedCompanyId = localStorage.getItem(`selected_company_${user.id}`);
      const savedBranchId = localStorage.getItem(`selected_branch_${user.id}`);

      if (savedCompanyId) {
        setSelectedCompanyId(savedCompanyId);
        console.log('🏢 Restored selected company:', savedCompanyId);
      }

      if (savedBranchId) {
        setSelectedBranchId(savedBranchId);
        console.log('🏢 Restored selected branch:', savedBranchId);
      }

      // Load companies and branches
      refreshCompanies();
      refreshBranches();
    }
  }, [isAuthenticated, user, refreshCompanies, refreshBranches]);

  // Save company selection to localStorage
  const handleSetSelectedCompanyId = useCallback((companyId: string | null) => {
    setSelectedCompanyId(companyId);
    if (user) {
      if (companyId) {
        localStorage.setItem(`selected_company_${user.id}`, companyId);
        console.log('🏢 Saved selected company:', companyId);
      } else {
        localStorage.removeItem(`selected_company_${user.id}`);
        console.log('🏢 Cleared selected company');
      }
    }

    // Clear branch selection when company changes
    setSelectedBranchId(null);
    if (user) {
      localStorage.removeItem(`selected_branch_${user.id}`);
    }
  }, [user]);

  // Save branch selection to localStorage
  const handleSetSelectedBranchId = useCallback((branchId: string | null) => {
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