/**
 * Sync Service - Frontend service for monitoring sync status and connectivity
 */

import { apiService } from './api';

export interface SyncStatus {
  connection: {
    status: 'online' | 'offline' | 'checking' | 'error';
    type: 'sqlite' | 'postgresql';
    isOnline: boolean;
    isOffline: boolean;
  };
  sync: {
    inProgress: boolean;
    lastSync: string | null;
    pendingItems: number;
    syncedItems: number;
    failedItems: number;
    currentOperation: string | null;
    queueItems: number;
  };
  databases: {
    sqlite: {
      connected: boolean;
      path: string;
    };
    postgresql: {
      connected: boolean;
      configured: boolean;
    };
  };
}

class SyncService {
  private status: SyncStatus | null = null;
  private listeners: Array<(status: SyncStatus) => void> = [];
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;

  /**
   * Get current sync status
   */
  async getStatus(): Promise<SyncStatus> {
    try {
      const response = await apiService.request<{ data: SyncStatus }>('/sync/status', {
        method: 'GET'
      });
      if (response.success && response.data) {
        this.status = response.data;
        this.notifyListeners();
        return this.status;
      }
      throw new Error('Failed to get sync status');
    } catch (error: any) {
      console.error('Get sync status error:', error);
      // Return cached status or default
      return this.status || this.getDefaultStatus();
    }
  }

  /**
   * Get default status
   */
  private getDefaultStatus(): SyncStatus {
    return {
      connection: {
        status: 'checking',
        type: 'sqlite',
        isOnline: false,
        isOffline: true
      },
      sync: {
        inProgress: false,
        lastSync: null,
        pendingItems: 0,
        syncedItems: 0,
        failedItems: 0,
        currentOperation: null,
        queueItems: 0
      },
      databases: {
        sqlite: {
          connected: false,
          path: ''
        },
        postgresql: {
          connected: false,
          configured: false
        }
      }
    };
  }

  /**
   * Check connectivity
   */
  async checkConnectivity(): Promise<{ status: string; isOnline: boolean; isOffline: boolean; type: string }> {
    try {
      const response = await apiService.request<{ data: { status: string; isOnline: boolean; isOffline: boolean; type: string } }>('/sync/connectivity', {
        method: 'GET'
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to check connectivity');
    } catch (error: any) {
      console.error('Check connectivity error:', error);
      return {
        status: 'error',
        isOnline: false,
        isOffline: true,
        type: 'sqlite'
      };
    }
  }

  /**
   * Trigger sync to PostgreSQL
   */
  async syncToPostgreSQL(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.request<{ success: boolean; message: string }>('/sync/to-postgresql', {
        method: 'POST'
      });
      return response;
    } catch (error: any) {
      console.error('Sync to PostgreSQL error:', error);
      return {
        success: false,
        message: error.message || 'Failed to sync to PostgreSQL'
      };
    }
  }

  /**
   * Trigger sync to SQLite
   */
  async syncToSQLite(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.request<{ success: boolean; message: string }>('/sync/to-sqlite', {
        method: 'POST'
      });
      return response;
    } catch (error: any) {
      console.error('Sync to SQLite error:', error);
      return {
        success: false,
        message: error.message || 'Failed to sync to SQLite'
      };
    }
  }

  /**
   * Get sync queue
   */
  async getQueue(): Promise<{ queue: any[]; total: number; pending: number; synced: number }> {
    try {
      const response = await apiService.request<{ data: { queue: any[]; total: number; pending: number; synced: number } }>('/sync/queue', {
        method: 'GET'
      });
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('Failed to get sync queue');
    } catch (error: any) {
      console.error('Get sync queue error:', error);
      return {
        queue: [],
        total: 0,
        pending: 0,
        synced: 0
      };
    }
  }

  /**
   * Clear synced items from queue
   */
  async clearQueue(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.request<{ success: boolean; message: string }>('/sync/queue', {
        method: 'DELETE'
      });
      return response;
    } catch (error: any) {
      console.error('Clear sync queue error:', error);
      return {
        success: false,
        message: error.message || 'Failed to clear sync queue'
      };
    }
  }

  /**
   * Start polling for status updates
   */
  startPolling(intervalMs: number = 5000): void {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    // Initial fetch immediately
    this.getStatus().catch(err => {
      console.error('Initial sync status fetch failed:', err);
    });

    // Then poll at interval
    this.pollingInterval = setInterval(async () => {
      try {
        await this.getStatus();
      } catch (error) {
        console.error('Polling sync status failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.isPolling = false;
    }
  }

  /**
   * Subscribe to status updates
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener);

    // Immediately notify with current status
    if (this.status) {
      listener(this.status);
    }

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    if (this.status) {
      this.listeners.forEach(listener => listener(this.status!));
    }
  }

  /**
   * Get current status (cached)
   */
  getCurrentStatus(): SyncStatus | null {
    return this.status;
  }
}

// Singleton instance
export const syncService = new SyncService();
