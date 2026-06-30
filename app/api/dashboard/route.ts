import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { TaskStatus } from '@/app/generated/prisma/enums'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    select: { teamId: true },
  })

  const teamIds = teamMembers.map((tm) => tm.teamId)

  if (teamIds.length === 0) {
    return NextResponse.json({
      projects: 0,
      tasks: 0,
      completedTasks: 0,
      subscriptions: 0,
      monthlySpend: 0,
      teamMembers: 0,
    })
  }

  const [projectsCount, subscriptionsAgg, totalTeamMembers] = await Promise.all([
    prisma.project.count({ where: { teamId: { in: teamIds } } }),
    prisma.subscription.aggregate({
      where: { teamId: { in: teamIds }, isActive: true },
      _count: { _all: true },
      _sum: { cost: true },
    }),
    prisma.teamMember.count({ where: { teamId: { in: teamIds } } }),
  ])

  const projects = await prisma.project.findMany({
    where: { teamId: { in: teamIds } },
    select: { id: true },
  })
  const projectIdArray = projects.map((p) => p.id)

  let tasksCount = 0
  let completedTasks = 0

  if (projectIdArray.length > 0) {
    const taskStats = await prisma.task.groupBy({
      by: ['status'],
      where: { projectId: { in: projectIdArray } },
      _count: { _all: true },
    })

    tasksCount = taskStats.reduce((acc, curr) => acc + curr._count._all, 0)
    completedTasks =
      taskStats.find((s) => s.status === TaskStatus.DONE)?._count._all || 0
  }

  return NextResponse.json({
    projects: projectsCount,
    tasks: tasksCount,
    completedTasks,
    subscriptions: subscriptionsAgg._count._all || 0,
    monthlySpend: Number(subscriptionsAgg._sum.cost || 0),
    teamMembers: totalTeamMembers,
  })
}
