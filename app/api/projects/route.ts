import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: { userId: session.user.id },
    include: { team: true },
  })

  if (teamMembers.length === 0) {
    return NextResponse.json({ projects: [], teams: [] })
  }

  const teamIds = teamMembers.map((tm) => tm.teamId)

  const projects = await prisma.project.findMany({
    where: { teamId: { in: teamIds } },
    include: { team: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    projects: projects.map((p) => ({ ...p, team_name: p.team.name })),
    teams: teamMembers.map((tm) => ({
      ...tm.team,
      role: tm.role,
      team_id: tm.teamId,
    })),
  })
}
