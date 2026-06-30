import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  const projectData = await prisma.project.findFirst({
    where: {
      id: projectId,
      team: {
        members: { some: { userId: session.user.id } },
      },
    },
    include: { team: { select: { name: true } } },
  })

  if (!projectData) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const project = { ...projectData, team_name: projectData.team.name }

  const taskData = await prisma.task.findMany({
    where: { projectId },
    include: { assignee: { select: { name: true } } },
    orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
  })

  const tasks = taskData.map((t) => ({
    ...t,
    assigned_to_name: t.assignee?.name ?? null,
  }))

  const memberData = await prisma.teamMember.findMany({
    where: { teamId: projectData.teamId },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  const teamMembers = memberData.map((tm) => ({
    id: tm.user.id,
    name: tm.user.name,
    email: tm.user.email,
    role: tm.role,
  }))

  return NextResponse.json({ project, tasks, teamMembers })
}
