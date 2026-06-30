import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { UserRole } from '@/app/generated/prisma/enums'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userRole = session.user.role as UserRole | null

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id, isDeleted: false },
      include: {
        team: { select: { id: true, name: true } },
        history: { orderBy: { dayPaid: 'desc' } },
      },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // SUPER_ADMIN can access all data
    if (userRole !== UserRole.SUPER_ADMIN) {
      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: subscription.teamId,
            userId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    return NextResponse.json(subscription)
  } catch (error) {
    console.error('Fetch subscription error:', error)
    return NextResponse.json({ error: 'Failed to fetch subscription' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const userRole = session.user.role as UserRole | null

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id },
      select: { id: true, teamId: true },
    })

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // SUPER_ADMIN can delete any subscription
    if (userRole === UserRole.SUPER_ADMIN) {
      const deleted = await prisma.subscription.update({
        where: { id },
        data: { isDeleted: true },
      })

      await prisma.audit_log.create({
        data: {
          userId: session.user.id,
          entityType: 'subscription',
          entityId: id,
          action: 'DELETE',
          oldValue: deleted as any,
        },
      })

      return NextResponse.json({ success: true })
    }

    // For non-super-admins, check team ownership
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId: subscription.teamId,
          userId: session.user.id,
        },
      },
    })

    if (!membership || membership.role !== 'OWNER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const deleted = await prisma.subscription.update({
      where: { id },
      data: { isDeleted: true },
    })

    await prisma.audit_log.create({
      data: {
        userId: session.user.id,
        entityType: 'subscription',
        entityId: id,
        action: 'DELETE',
        oldValue: deleted as any,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete subscription error:', error)
    return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
  }
}
