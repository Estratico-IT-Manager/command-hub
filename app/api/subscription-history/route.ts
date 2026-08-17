import prisma from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { TeamRole } from "@/app/generated/prisma/enums"
import { can } from "@/lib/rbac"
import { PERMISSIONS } from "@/lib/rbac/permissions"

// GET /api/subscription-history?subscriptionId=xxx
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const subscriptionId = searchParams.get("subscriptionId")

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "subscriptionId is required" },
      { status: 400 }
    )
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { teamId: true },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      )
    }

    // For users without global view permission, check team membership
    if (!(await can(session.user.id, PERMISSIONS.SUBSCRIPTION_HISTORY_VIEW))) {
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: subscription.teamId,
            userId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "You do not have access to this subscription" },
          { status: 403 }
        )
      }
    }

    const history = await prisma.subscription_history.findMany({
      where: { subscriptionId },
      orderBy: { dayPaid: "desc" },
    })

    return NextResponse.json(history)
  } catch (error) {
    console.error("Fetch subscription history error:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription history" },
      { status: 500 }
    )
  }
}

// POST /api/subscription-history
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasPermission = await can(session.user.id, PERMISSIONS.SUBSCRIPTION_HISTORY_CREATE)

  try {
    const body = await request.json()
    const { subscriptionId, transactionId, dayPaid } = body

    if (!subscriptionId || !transactionId || !dayPaid) {
      return NextResponse.json(
        { error: "subscriptionId, transactionId, and dayPaid are required" },
        { status: 400 }
      )
    }

    // Verify subscription exists and user has access
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { teamId: true, cost: true },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      )
    }

    // Check team membership and role
    if (!hasPermission) {
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: subscription.teamId,
            userId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "You do not have access to this subscription" },
          { status: 403 }
        )
      }

      if (membership.role !== TeamRole.OWNER) {
        return NextResponse.json(
          { error: "You do not have permission to create subscription history" },
          { status: 403 }
        )
      }
    }

    // Use the subscription's current cost (cost at time of payment)
    const history = await prisma.subscription_history.create({
      data: {
        subscriptionId,
        transactionId,
        cost: subscription.cost,
        dayPaid: new Date(dayPaid),
      },
    })

    // Create audit log entry
    await prisma.audit_log.create({
      data: {
        userId: session.user.id,
        entityType: "subscription_history",
        entityId: history.id,
        action: "CREATE",
        newValue: history,
      },
    })

    return NextResponse.json(history, { status: 201 })
  } catch (error) {
    console.error("Create subscription history error:", error)
    return NextResponse.json(
      { error: "Failed to create subscription history" },
      { status: 500 }
    )
  }
}

// PUT /api/subscription-history
export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasPermission = await can(session.user.id, PERMISSIONS.SUBSCRIPTION_HISTORY_EDIT)

  try {
    const body = await request.json()
    const { id, transactionId, cost, dayPaid } = body

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      )
    }

    // Get existing record for audit log
    const existing = await prisma.subscription_history.findUnique({
      where: { id },
      include: { subscription: { select: { teamId: true } } },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Subscription history record not found" },
        { status: 404 }
      )
    }

    // Check team membership and role
    if (!hasPermission) {
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: existing.subscription.teamId,
            userId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "You do not have access to this subscription history" },
          { status: 403 }
        )
      }

      if (membership.role !== TeamRole.OWNER) {
        return NextResponse.json(
          { error: "You do not have permission to update subscription history" },
          { status: 403 }
        )
      }
    }

    const updated = await prisma.subscription_history.update({
      where: { id },
      data: {
        ...(transactionId && { transactionId }),
        ...(cost !== undefined && { cost: parseFloat(cost) }),
        ...(dayPaid && { dayPaid: new Date(dayPaid) }),
      },
    })

    // Create audit log entry
    await prisma.audit_log.create({
      data: {
        userId: session.user.id,
        entityType: "subscription_history",
        entityId: id,
        action: "UPDATE",
        oldValue: existing,
        newValue: updated,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Update subscription history error:", error)
    return NextResponse.json(
      { error: "Failed to update subscription history" },
      { status: 500 }
    )
  }
}

// DELETE /api/subscription-history
export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hasPermission = await can(session.user.id, PERMISSIONS.SUBSCRIPTION_HISTORY_DELETE)

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      )
    }

    // Get existing record for audit log
    const existing = await prisma.subscription_history.findUnique({
      where: { id },
      include: { subscription: { select: { teamId: true } } },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Subscription history record not found" },
        { status: 404 }
      )
    }

    // Check team membership and role
    if (!hasPermission) {
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: existing.subscription.teamId,
            userId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "You do not have access to this subscription history" },
          { status: 403 }
        )
      }

      if (membership.role !== TeamRole.OWNER) {
        return NextResponse.json(
          { error: "You do not have permission to delete subscription history" },
          { status: 403 }
        )
      }
    }

    await prisma.subscription_history.delete({
      where: { id },
    })

    // Create audit log entry
    await prisma.audit_log.create({
      data: {
        userId: session.user.id,
        entityType: "subscription_history",
        entityId: id,
        action: "DELETE",
        oldValue: existing,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete subscription history error:", error)
    return NextResponse.json(
      { error: "Failed to delete subscription history" },
      { status: 500 }
    )
  }
}
