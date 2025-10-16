import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';

interface BusinessTypeGuardProps {
  children: React.ReactNode;
}

const BusinessTypeGuard = ({ children }: BusinessTypeGuardProps) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  // Get user's companies to check if any need business type selection
  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => apiService.getCompanies(),
    enabled: isAuthenticated && !!user
  });

  useEffect(() => {
    if (isAuthenticated && user && companies && !isLoading) {
      // Check if user has no companies or if any company doesn't have a business type set
      const hasNoCompanies = companies.data?.length === 0;
      const companyNeedingType = companies.data?.find((company: any) => !company.businessType);

      // No longer redirect to business type selection - let the dashboard handle it
      // The dashboard will show company selection if needed
    }
  }, [isAuthenticated, user, companies, isLoading, navigate]);

  // Show loading while checking companies
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render children
  if (!isAuthenticated || !user) {
    return null;
  }

  // If all companies have business types, render children
  return <>{children}</>;
};

export default BusinessTypeGuard;
