import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamMembersData = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    include: { team: true },
  })

  if (teamMembersData.length === 0) {
    return NextResponse.json({
      subscriptions: [],
      teams: [],
      stats: { total: 0, monthly: 0, yearly: 0 },
    })
  }

  const teamIds = teamMembersData.map((tm) => tm.teamId)

  const subscriptionsData = await prisma.subscription.findMany({
    where: { teamId: { in: teamIds }, isDeleted: false },
    include: {
      team: { select: { name: true } },
      history: { orderBy: { dayPaid: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const subscriptions = subscriptionsData.map((s) => ({
    ...s,
    team_name: s.team.name,
    status: s.isActive ? 'active' : 'inactive',
  }))

  const teams = teamMembersData.map((tm) => ({
    ...tm.team,
    role: tm.role,
    team_id: tm.teamId,
  }))

  const activeSubscriptions = subscriptions.filter((s) => s.isActive)

  const monthlyTotal = activeSubscriptions.reduce((sum, s) => {
    const cost = s.cost || 0
    if (s.frequency === 'MONTHLY') return sum + cost
    if (s.frequency === 'QUARTERLY') return sum + cost / 3
    if (s.frequency === 'YEARLY') return sum + cost / 12
    return sum
  }, 0)

  return NextResponse.json({
    subscriptions,
    teams,
    stats: {
      total: activeSubscriptions.length,
      monthly: monthlyTotal,
      yearly: monthlyTotal * 12,
    },
  })
}
