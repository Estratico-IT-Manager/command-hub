import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { canViewAuditLog, getUnauthorizedMessage } from "@/lib/authorization"
import { UserRole } from "@/app/generated/prisma/enums"

// GET /api/audit-log
// Query params:
//   - entityType: Filter by entity type (e.g., "subscription", "task", "project")
//   - entityId: Filter by specific entity ID
//   - userId: Filter by user who performed the action
//   - action: Filter by action type (CREATE, UPDATE, DELETE)
//   - limit: Number of results (default 50)
//   - offset: Pagination offset (default 0)
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userRole = session.user.role as UserRole | null

  // For audit log viewing, check if user is SUPER_ADMIN or OWNER of any team
  if (userRole !== UserRole.SUPER_ADMIN) {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: session.user.id },
      select: { role: true },
    })
    const isOwner = memberships.some(m => m.role === 'OWNER')
    if (!isOwner) {
      return NextResponse.json(
        { error: getUnauthorizedMessage("view", "audit log") },
        { status: 403 }
      )
    }
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get("entityType")
  const entityId = searchParams.get("entityId")
  const userId = searchParams.get("userId")
  const action = searchParams.get("action")
  const limit = parseInt(searchParams.get("limit") || "50")
  const offset = parseInt(searchParams.get("offset") || "0")

  try {
    const where: Record<string, any> = {}

    // For non-SUPER_ADMIN users, only show audit logs for their teams
    if (userRole !== UserRole.SUPER_ADMIN) {
      // Get user's team IDs
      const teamMembers = await prisma.teamMember.findMany({
        where: { userId: session.user.id },
        select: { teamId: true },
      })
      const teamIds = teamMembers.map((tm) => tm.teamId)

      // Get all entity IDs owned by these teams
      const [subscriptions, projects, tasks] = await Promise.all([
        prisma.subscription.findMany({
          where: { teamId: { in: teamIds } },
          select: { id: true },
        }),
        prisma.project.findMany({
          where: { teamId: { in: teamIds } },
          select: { id: true },
        }),
        prisma.task.findMany({
          where: { project: { teamId: { in: teamIds } } },
          select: { id: true },
        }),
      ])

      const subscriptionIds = subscriptions.map((s) => s.id)
      const projectIds = projects.map((p) => p.id)
      const taskIds = tasks.map((t) => t.id)

      // Build entity filter
      const entityConditions = []
      if (subscriptionIds.length > 0) {
        entityConditions.push({
          AND: [
            { entityType: "subscription" },
            { entityId: { in: subscriptionIds } },
          ],
        })
        entityConditions.push({
          AND: [
            { entityType: "subscription_history" },
            { entityId: { in: subscriptionIds } },
          ],
        })
      }
      if (projectIds.length > 0) {
        entityConditions.push({
          AND: [
            { entityType: "project" },
            { entityId: { in: projectIds } },
          ],
        })
      }
      if (taskIds.length > 0) {
        entityConditions.push({
          AND: [
            { entityType: "task" },
            { entityId: { in: taskIds } },
          ],
        })
      }

      if (entityConditions.length > 0) {
        where.OR = entityConditions
      } else {
        // No accessible entities
        return NextResponse.json([])
      }
    }

    // Apply filters
    if (entityType) {
      where.entityType = entityType
    }
    if (entityId) {
      where.entityId = entityId
    }
    if (userId) {
      where.userId = userId
    }
    if (action) {
      where.action = action
    }

    const [auditLogs, total] = await Promise.all([
      prisma.audit_log.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.audit_log.count({ where }),
    ])

    return NextResponse.json({
      data: auditLogs,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    })
  } catch (error) {
    console.error("Fetch audit log error:", error)
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 }
    )
  }
}
