import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { InvitationStatus } from '@/app/generated/prisma/enums'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: teamId } = await params

  const membership = await prisma.teamMember.findFirst({
    where: { teamId, userId: session.user.id },
    select: { role: true },
  })

  if (!membership) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const userRole = membership.role

  const team = await prisma.team.findUnique({ where: { id: teamId } })
  if (!team) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: {
      user: { select: { name: true, email: true } },
      role: true,
      createdAt: true,
      userId: true,
      id: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  const invitations = await prisma.teamInvitation.findMany({
    where: { teamId, status: InvitationStatus.PENDING },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    team,
    members,
    invitations,
    userRole,
    canManage: userRole === 'OWNER',
  })
}
