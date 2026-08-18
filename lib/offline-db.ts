import { 
  ProjectStatus, 
  SubscriptionFrequency, 
  TaskPriority, 
  TaskStatus 
} from '@/app/generated/prisma/enums'
import Dexie, { type EntityTable } from 'dexie'

// --- Interfaces mirroring Prisma Models ---

export interface LocalUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  permissions: string[]
  bio: string | null
  whatsappNumber: string | null
  createdAt: string // Stored as ISO string for Dexie compatibility
  updatedAt: string
  synced: boolean
}

export interface LocalTeam {
  id: string
  name: string
  slug: string
  logo: string
  metadata: any // Prisma Json
  createdAt: string
  updatedAt: string
  synced: boolean
  pendingSync?: boolean
}

export interface LocalProject {
  id: string
  teamId: string
  name: string
  description: string
  status: ProjectStatus
  version: number
  createdBy: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  synced: boolean
  pendingSync?: boolean
}

export interface LocalTask {
  id: string
  projectId: string
  title: string
  description: string
  priority: TaskPriority
  status: TaskStatus
  assignedTo: string
  createdBy: string
  position: number
  dueDate: string
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  synced: boolean
  pendingSync?: boolean
}

export interface LocalSubscription {
  id: string
  teamId: string
  serviceName: string
  provider: string
  startDate: string
  lastPaymentDate?: string
  frequency: SubscriptionFrequency
  cost: number
  currency: string
  notes: string
  isActive: boolean
  version: number
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  synced: boolean
  pendingSync?: boolean
}

export interface LocalSubscriptionHistory {
  id: string
  subscriptionId: string
  transactionId: string
  cost: number
  dayPaid: string
  createdAt: string
  synced: boolean
  pendingSync?: boolean
}

export interface LocalAuditLog {
  id: string
  userId: string
  entityType: string
  entityId: string
  action: string
  oldValue: any | null
  newValue: any | null
  createdAt: string
  synced: boolean
  pendingSync?: boolean
}

export interface SyncQueueItem {
  id?: number
  tableName: 'user' | 'team' | 'project' | 'task' | 'subscription' | 'subscription_history' | 'audit_log'
  recordId: string
  action: 'create' | 'update' | 'delete'
  payload: Record<string, any>
  queryKey: string[]
  createdAt: string
  retries: number
}

// --- Database Class ---

class EstraticoOfflineDB extends Dexie {
  users!: EntityTable<LocalUser, 'id'>
  teams!: EntityTable<LocalTeam, 'id'>
  projects!: EntityTable<LocalProject, 'id'>
  tasks!: EntityTable<LocalTask, 'id'>
  subscriptions!: EntityTable<LocalSubscription, 'id'>
  subscription_history!: EntityTable<LocalSubscriptionHistory, 'id'>
  audit_log!: EntityTable<LocalAuditLog, 'id'>
  syncQueue!: EntityTable<SyncQueueItem, 'id'>

  constructor() {
    super('EstraticoOfflineDB')
    
    this.version(4).stores({
      // Primary Key followed by indexed fields
      users: 'id, &email, synced',
      teams: 'id, &slug, synced',
      projects: 'id, teamId, status, createdBy, synced',
      tasks: 'id, projectId, status, assignedTo, synced',
      subscriptions: 'id, teamId, synced',
      subscription_history: 'id, subscriptionId, synced',
      audit_log: 'id, entityType, entityId, userId, createdAt, synced',
      syncQueue: '++id, tableName, recordId, action, retries'
    })
  }
}

export const offlineDb = new EstraticoOfflineDB()

export function generateOfflineId(): string {
  return `offline_${crypto.randomUUID()}`
}