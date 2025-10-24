/**
 * OnboardingTour Usage Examples
 *
 * This file demonstrates how to use the OnboardingTour component
 * across different pages in your POS application.
 */

import React from 'react';
import OnboardingTour, { OnboardingStep } from '@/components/OnboardingTour';

// Example 1: POS Interface Tour
export const POSInterfaceTour = () => {
  const posSteps: OnboardingStep[] = [
    {
      target: '.product-search',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Product Search</h3>
          <p>Search for products by name, barcode, or SKU. You can also scan barcodes directly.</p>
        </div>
      ),
      title: "Find Products",
      placement: 'bottom',
    },
    {
      target: '.product-grid',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Product Grid</h3>
          <p>Browse through your product catalog. Click on any product to add it to the cart.</p>
        </div>
      ),
      title: "Browse Products",
      placement: 'top',
    },
    {
      target: '.cart-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Shopping Cart</h3>
          <p>Review items in your cart, adjust quantities, and apply discounts before checkout.</p>
        </div>
      ),
      title: "Manage Cart",
      placement: 'left',
    },
    {
      target: '.payment-section',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Payment Processing</h3>
          <p>Process payments using cash, card, or digital wallets. Generate receipts and manage transactions.</p>
        </div>
      ),
      title: "Complete Sale",
      placement: 'top',
    }
  ];

  return (
    <OnboardingTour
      steps={posSteps}
      storageKey="pos-interface-tour"
      onComplete={(data) => {
        console.log('POS tour completed!', data);
        // You can add analytics tracking here
      }}
    />
  );
};

// Example 2: Reports Dashboard Tour
export const ReportsDashboardTour = () => {
  const reportsSteps: OnboardingStep[] = [
    {
      target: '.date-filter',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Date Range Filter</h3>
          <p>Select custom date ranges to analyze your business performance over specific periods.</p>
        </div>
      ),
      title: "Filter Reports",
      placement: 'bottom',
    },
    {
      target: '.sales-chart',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Sales Analytics</h3>
          <p>View your sales trends, top-selling products, and revenue insights in real-time.</p>
        </div>
      ),
      title: "Sales Insights",
      placement: 'left',
    },
    {
      target: '.inventory-status',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Inventory Status</h3>
          <p>Monitor stock levels, low inventory alerts, and product performance metrics.</p>
        </div>
      ),
      title: "Inventory Management",
      placement: 'right',
    },
    {
      target: '.export-options',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Export Reports</h3>
          <p>Export your reports in various formats (PDF, Excel, CSV) for external analysis.</p>
        </div>
      ),
      title: "Export Data",
      placement: 'top',
    }
  ];

  return (
    <OnboardingTour
      steps={reportsSteps}
      storageKey="reports-dashboard-tour"
      onComplete={(data) => {
        console.log('Reports tour completed!', data);
      }}
    />
  );
};

// Example 3: Settings Page Tour
export const SettingsPageTour = () => {
  const settingsSteps: OnboardingStep[] = [
    {
      target: '.company-settings',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Company Settings</h3>
          <p>Configure your business information, tax settings, and company preferences.</p>
        </div>
      ),
      title: "Business Setup",
      placement: 'right',
    },
    {
      target: '.user-management',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">User Management</h3>
          <p>Add team members, assign roles, and manage permissions for your staff.</p>
        </div>
      ),
      title: "Team Management",
      placement: 'left',
    },
    {
      target: '.payment-settings',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Payment Configuration</h3>
          <p>Set up payment methods, configure tax rates, and manage billing preferences.</p>
        </div>
      ),
      title: "Payment Setup",
      placement: 'top',
    }
  ];

  return (
    <OnboardingTour
      steps={settingsSteps}
      storageKey="settings-page-tour"
      onComplete={(data) => {
        console.log('Settings tour completed!', data);
      }}
    />
  );
};

// Example 4: Inventory Management Tour
export const InventoryManagementTour = () => {
  const inventorySteps: OnboardingStep[] = [
    {
      target: '.product-list',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Product Catalog</h3>
          <p>View and manage all your products. Add new items, update details, and organize your inventory.</p>
        </div>
      ),
      title: "Product Management",
      placement: 'right',
    },
    {
      target: '.stock-alerts',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Stock Alerts</h3>
          <p>Monitor low stock levels and set up automatic reorder notifications.</p>
        </div>
      ),
      title: "Stock Monitoring",
      placement: 'bottom',
    },
    {
      target: '.bulk-actions',
      content: (
        <div>
          <h3 className="text-lg font-semibold mb-2">Bulk Operations</h3>
          <p>Perform bulk updates, import/export products, and manage inventory efficiently.</p>
        </div>
      ),
      title: "Bulk Management",
      placement: 'top',
    }
  ];

  return (
    <OnboardingTour
      steps={inventorySteps}
      storageKey="inventory-management-tour"
      onComplete={(data) => {
        console.log('Inventory tour completed!', data);
      }}
    />
  );
};

/**
 * How to use these tours in your pages:
 *
 * 1. Import the tour component:
 * ```tsx
 * import { POSInterfaceTour } from '@/components/examples/OnboardingTourExamples';
 * ```
 *
 * 2. Add the tour to your component:
 * ```tsx
 * const POSInterface = () => {
 *   return (
 *     <div>
 *       <POSInterfaceTour />
 *       {/* Your POS interface content */}
 *     </div>
 *   );
 * };
 * ```
 *
 * 3. Add CSS classes to target elements:
 * ```tsx
 * <div className="product-search">
 *   {/* Search input */}
 * </div>
 * ```
 *
 * 4. Customize tour behavior:
 * ```tsx
 * <OnboardingTour
 *   steps={customSteps}
 *   storageKey="custom-tour"
 *   run={false} // Don't auto-run
 *   continuous={true} // Show all steps
 *   showProgress={true} // Show progress bar
 *   showSkipButton={true} // Allow skipping
 *   onComplete={(data) => {
 *     // Handle completion
 *   }}
 * />
 * ```
 *
 * 5. Reset tour for testing:
 * ```tsx
 * // Clear localStorage to reset tour
 * localStorage.removeItem('your-tour-key');
 * ```
 */
