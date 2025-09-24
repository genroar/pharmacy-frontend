import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiService } from '@/services/api';

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
}

interface AdminContextType {
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string | null) => void;
  allBranches: Branch[];
  selectedBranch: Branch | null;
  isLoading: boolean;
  error: string | null;
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
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedBranch = selectedBranchId
    ? allBranches.find(branch => branch.id === selectedBranchId) || null
    : null;

  const refreshBranches = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.getBranches();

      if (response.success && response.data) {
        const branchesData = Array.isArray(response.data) ? response.data : response.data.branches;
        setAllBranches(branchesData || []);
      } else {
        setError('Failed to load branches');
      }
    } catch (err) {
      console.error('Error loading branches:', err);
      setError('Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshBranches();
  }, []);

  const value: AdminContextType = {
    selectedBranchId,
    setSelectedBranchId,
    allBranches,
    selectedBranch,
    isLoading,
    error,
    refreshBranches
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};