'use client'

import { offlineDb, type SyncQueueItem } from './offline-db'
import { getQueryClient } from './query-client'

const SYNC_ENDPOINT = '/api/sync'
const MAX_RETRIES = 20

export class SyncEngine {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  private isSyncing: boolean = false
  private listeners: Set<(status: SyncStatus) => void> = new Set()

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline())
      window.addEventListener('offline', () => this.handleOffline())
    }
  }

  private handleOnline() {
    this.isOnline = true
    this.notifyListeners({ isOnline: true, isSyncing: false, pendingChanges: 0 })
    this.syncPendingChanges()
  }

  private handleOffline() {
    this.isOnline = false
    this.notifyListeners({ isOnline: false, isSyncing: false, pendingChanges: 0 })
  }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async notifyListeners(status: Partial<SyncStatus>) {
    const pendingChanges = await offlineDb.syncQueue.count()
    const fullStatus: SyncStatus = {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingChanges,
      ...status
    }
    this.listeners.forEach(listener => listener(fullStatus))
  }

  async queueChange(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>) {
    await offlineDb.syncQueue.add({
      ...item,
      createdAt: new Date().toISOString(),
      retries: 0
    })
     
    if (this.isOnline) {
      this.syncPendingChanges()
    }
    
    this.notifyListeners({})
  }

  async syncPendingChanges() {
    if (this.isSyncing || !this.isOnline) return

    this.isSyncing = true
    this.notifyListeners({ isSyncing: true })

    try {
      const pendingItems = await offlineDb.syncQueue
        .where('retries')
        .below(MAX_RETRIES)
        .toArray()

      for (const item of pendingItems) {
        console.log("item:", item)
        try {
          const response = await fetch(SYNC_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tableName: item.tableName,
              recordId: item.recordId,
              action: item.action,
              payload: item.payload
            })
          })

          if (response.ok) {
            const result = await response.json()
            
            // Update local entity with server response
            await this.updateLocalEntity(item.tableName, item.recordId, result.data)
            
            // Remove from sync queue
            if (item.id) {
              await offlineDb.syncQueue.delete(item.id)
            }

            // Invalidate the associated query to refetch fresh data
            if (item.queryKey) {
              const queryClient = getQueryClient()
              queryClient.invalidateQueries({ queryKey: item.queryKey })
            }
          } else if (response.status >= 500) {
            // Server error - retry later
            if (item.id) {
              await offlineDb.syncQueue.update(item.id, { retries: item.retries + 1 })
            }
          } else {
            // Client error - remove from queue (won't succeed on retry)
            if (item.id) {
              await offlineDb.syncQueue.delete(item.id)
            }
          }
        } catch(e) {
          // Network error - increment retry count
          console.error(e)
          if (item.id) {
            await offlineDb.syncQueue.update(item.id, { retries: item.retries + 1 })
          }
        }
      }
    } finally {
      this.isSyncing = false
      this.notifyListeners({ isSyncing: false })
    }
  }

  private async updateLocalEntity(
    tableName: string, 
    recordId: string, 
    serverData: Record<string, unknown>
  ) {
    // Map sync table names to Dexie store names
    const tableMap: Record<string, string> = {
      user: 'users',
      team: 'teams',
      project: 'projects',
      task: 'tasks',
      subscription: 'subscriptions',
      subscription_history: 'subscription_history',
      audit_log: 'audit_log',
    }

    const storeName = tableMap[tableName] || tableName
    const table = offlineDb.table(storeName)
    await offlineDb.transaction('rw', table, async () => {
    // 1. Check if the server returned a new ID
    const newId = serverData.id;

    if (newId && newId !== recordId) {
      // 2. Delete the temporary offline record first
      // This "frees up" the 'command' slug in the unique index
      await table.delete(recordId);

      // 3. Add the server record as a fresh entry
      await table.put({
        ...serverData,
        synced: true,
        pendingSync: false
      });
    } else {
      // 4. If IDs are the same, a simple update works
      await table.update(recordId, { 
        ...serverData, 
        synced: true, 
        pendingSync: false 
      });
    }
  });
  }

  async pullChanges(lastSyncTimestamp?: string) {
    if (!this.isOnline) return

    try {
      const response = await fetch(`${SYNC_ENDPOINT}?since=${lastSyncTimestamp || ''}`)
      if (response.ok) {
        const data = await response.json()
        
        // Update local database with server changes
        if (data.teams) {
          await offlineDb.teams.bulkPut(data.teams.map((t: Record<string, unknown>) => ({ ...t, synced: true })))
        }
        if (data.projects) {
          await offlineDb.projects.bulkPut(data.projects.map((p: Record<string, unknown>) => ({ ...p, synced: true })))
        }
        if (data.tasks) {
          await offlineDb.tasks.bulkPut(data.tasks.map((t: Record<string, unknown>) => ({ ...t, synced: true })))
        }
        if (data.subscriptions) {
          await offlineDb.subscriptions.bulkPut(data.subscriptions.map((s: Record<string, unknown>) => ({ ...s, synced: true })))
        }
        if (data.subscriptionHistory) {
          await offlineDb.subscription_history.bulkPut(data.subscriptionHistory.map((sh: Record<string, unknown>) => ({ ...sh, synced: true })))
        }
        if (data.auditLogs) {
          await offlineDb.audit_log.bulkPut(data.auditLogs.map((al: Record<string, unknown>) => ({ ...al, synced: true })))
        }
      }
    } catch {
      // Silently fail - will retry on next pull
    }
  }

  getStatus(): { isOnline: boolean; isSyncing: boolean } {
    return { isOnline: this.isOnline, isSyncing: this.isSyncing }
  }
}

export interface SyncStatus {
  isOnline: boolean
  isSyncing: boolean
  pendingChanges: number
  lastSyncedAt?: string
  error?: string
}

// Singleton instance
export const syncEngine = typeof window !== 'undefined' ? new SyncEngine() : null
