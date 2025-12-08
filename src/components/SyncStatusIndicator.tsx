/**
 * Sync Status Indicator - Shows online/offline status and sync information
 */

import React, { useEffect, useState } from 'react';
import { syncService, SyncStatus } from '@/services/syncService';
import { Wifi, WifiOff, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SyncStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  className,
  showDetails = false
}) => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Subscribe to status updates
    const unsubscribe = syncService.subscribe(setStatus);

    // Start polling
    syncService.startPolling(5000);

    // Initial fetch
    syncService.getStatus().then(setStatus);

    return () => {
      unsubscribe();
      syncService.stopPolling();
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await syncService.getStatus();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (!status) {
    return (
      <div className={cn("flex items-center gap-2 text-gray-500", className)}>
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-sm">Checking...</span>
      </div>
    );
  }

  const isOnline = status.connection.isOnline;
  const isOffline = status.connection.isOffline;
  const syncInProgress = status.sync.inProgress;
  const pendingItems = status.sync.pendingItems;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Status Icon */}
      <div className="relative">
        {isOnline ? (
          <Wifi className={cn(
            "h-5 w-5",
            syncInProgress ? "text-blue-500 animate-pulse" : "text-green-500"
          )} />
        ) : (
          <WifiOff className="h-5 w-5 text-orange-500" />
        )}
        {pendingItems > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
            {pendingItems}
          </span>
        )}
      </div>

      {/* Status Text */}
      <div className="flex flex-col">
        <span className={cn(
          "text-sm font-medium",
          isOnline ? "text-green-600" : "text-orange-600"
        )}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
        {showDetails && (
          <span className="text-xs text-gray-500">
            {isOnline ? 'PostgreSQL' : 'SQLite'}
            {syncInProgress && ' • Syncing...'}
            {pendingItems > 0 && ` • ${pendingItems} pending`}
          </span>
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="ml-2 p-1 hover:bg-gray-100 rounded transition-colors"
        title="Refresh status"
      >
        <RefreshCw className={cn(
          "h-4 w-4 text-gray-500",
          isRefreshing && "animate-spin"
        )} />
      </button>

      {/* Detailed Status (if showDetails) */}
      {showDetails && (
        <div className="ml-4 flex items-center gap-4 text-xs">
          {status.sync.lastSync && (
            <span className="text-gray-500">
              Last sync: {new Date(status.sync.lastSync).toLocaleTimeString()}
            </span>
          )}
          {status.sync.failedItems > 0 && (
            <span className="text-red-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              {status.sync.failedItems} failed
            </span>
          )}
          {status.sync.syncedItems > 0 && (
            <span className="text-green-500 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              {status.sync.syncedItems} synced
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Compact Sync Status Badge - For use in headers/navbars
 */
export const SyncStatusBadge: React.FC<{ className?: string }> = ({ className }) => {
  const [status, setStatus] = useState<SyncStatus | null>(null);

  useEffect(() => {
    const unsubscribe = syncService.subscribe(setStatus);
    syncService.startPolling(5000);
    syncService.getStatus().then(setStatus);

    return () => {
      unsubscribe();
      syncService.stopPolling();
    };
  }, []);

  if (!status) {
    return null;
  }

  const isOnline = status.connection.isOnline;
  const pendingItems = status.sync.pendingItems;

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
      isOnline
        ? "bg-green-100 text-green-700 border border-green-200"
        : "bg-orange-100 text-orange-700 border border-orange-200",
      className
    )}>
      {isOnline ? (
        <Wifi className="h-3.5 w-3.5" />
      ) : (
        <WifiOff className="h-3.5 w-3.5" />
      )}
      <span>{isOnline ? 'Online' : 'Offline'}</span>
      {pendingItems > 0 && (
        <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white rounded-full">
          {pendingItems}
        </span>
      )}
    </div>
  );
};
