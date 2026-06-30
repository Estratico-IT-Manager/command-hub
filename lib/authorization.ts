import { UserRole, TeamRole } from '@/app/generated/prisma/enums'

// --- User Role Helpers ---

export function isSuperAdmin(role: UserRole | null): boolean {
  return role === UserRole.SUPER_ADMIN
}

export function isAdmin(role: UserRole | null): boolean {
  return role === UserRole.ADMIN
}

export function isEmployee(role: UserRole | null): boolean {
  return role === UserRole.EMPLOYEE
}

export function isIntern(role: UserRole | null): boolean {
  return role === UserRole.INTERN
}

// --- Team Role Helpers ---

export function isOwner(role: TeamRole | null): boolean {
  return role === TeamRole.OWNER
}

export function isTeamMember(role: TeamRole | null): boolean {
  return role === TeamRole.MEMBER
}

// --- Subscription History Permissions ---

/**
 * Can create a payment history record for a subscription
 * - SUPER_ADMIN: Yes (all data)
 * - OWNER: Yes (team data)
 * - Others: No
 */
export function canCreateSubscriptionHistory(userRole: UserRole | null, teamRole?: TeamRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN || teamRole === TeamRole.OWNER
}

/**
 * Can update a payment history record
 * - SUPER_ADMIN: Yes
 * - OWNER: Yes (team data)
 * - Others: No
 */
export function canUpdateSubscriptionHistory(userRole: UserRole | null, teamRole?: TeamRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN || teamRole === TeamRole.OWNER
}

/**
 * Can delete a payment history record
 * - SUPER_ADMIN: Yes
 * - OWNER: Yes (team data)
 * - Others: No
 */
export function canDeleteSubscriptionHistory(userRole: UserRole | null, teamRole?: TeamRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN || teamRole === TeamRole.OWNER
}

/**
 * Can view subscription history
 * - All authenticated users can view (within their team scope)
 */
export function canViewSubscriptionHistory(userRole: UserRole | null): boolean {
  return userRole !== null
}

// --- Audit Log Permissions ---

/**
 * Can view audit logs
 * - SUPER_ADMIN: Yes (all data)
 * - OWNER: Yes (team data)
 * - Others: No
 */
export function canViewAuditLog(userRole: UserRole | null, teamRole?: TeamRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN || teamRole === TeamRole.OWNER
}

/**
 * Audit logs are immutable - no one can update or delete them
 * This is intentional for data integrity
 */
export function canUpdateAuditLog(_userRole: UserRole | null): boolean {
  return false
}

export function canDeleteAuditLog(_userRole: UserRole | null): boolean {
  return false
}

// --- Subscription Permissions ---

/**
 * Can create a subscription
 * - SUPER_ADMIN: Yes
 * - OWNER: Yes (team data)
 * - Others: No
 */
export function canCreateSubscription(userRole: UserRole | null, teamRole?: TeamRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN || teamRole === TeamRole.OWNER
}

/**
 * Can update a subscription
 * - SUPER_ADMIN: Yes
 * - OWNER: Yes (team data)
 * - Others: No
 */
export function canUpdateSubscription(userRole: UserRole | null, teamRole?: TeamRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN || teamRole === TeamRole.OWNER
}

/**
 * Can delete a subscription
 * - SUPER_ADMIN: Yes
 * - OWNER: Yes (team data)
 * - Others: No
 */
export function canDeleteSubscription(userRole: UserRole | null, teamRole?: TeamRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN || teamRole === TeamRole.OWNER
}

// --- General Entity Permissions ---

/**
 * Can update any entity (super admin override)
 */
export function canUpdateAnyEntity(userRole: UserRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN
}

/**
 * Can delete any entity (super admin override)
 */
export function canDeleteAnyEntity(userRole: UserRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN
}

/**
 * Can view all data globally (super admin only)
 */
export function canViewAllData(userRole: UserRole | null): boolean {
  return userRole === UserRole.SUPER_ADMIN
}

// --- Team Management Permissions ---

/**
 * Can manage team members (invite, promote, demote, remove)
 * - OWNER: Yes
 * - Others: No
 */
export function canManageTeam(teamRole: TeamRole | null): boolean {
  return teamRole === TeamRole.OWNER
}

/**
 * Can invite members to a team
 * - OWNER: Yes
 * - Others: No
 */
export function canInviteMembers(teamRole: TeamRole | null): boolean {
  return teamRole === TeamRole.OWNER
}

// --- Error Messages ---

export function getUnauthorizedMessage(action: string, resource: string): string {
  return `You do not have permission to ${action} ${resource}`
}
