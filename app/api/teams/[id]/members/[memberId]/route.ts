import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { TeamRole } from '@/app/generated/prisma/enums'

// PATCH /api/teams/[id]/members/[memberId] — Update member role
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: teamId, memberId } = await params

  // Check if requester is OWNER of the team
  const requesterMembership = await prisma.teamMember.findFirst({
    where: { teamId, userId: session.user.id },
    select: { role: true },
  })

  if (!requesterMembership || requesterMembership.role !== TeamRole.OWNER) {
    return NextResponse.json(
      { error: 'Only the team owner can update member roles' },
      { status: 403 }
    )
  }

  // Get the target member
  const targetMember = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, teamId: true, role: true, userId: true },
  })

  if (!targetMember || targetMember.teamId !== teamId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Cannot modify yourself
  if (targetMember.userId === session.user.id) {
    return NextResponse.json(
      { error: 'You cannot modify your own role' },
      { status: 400 }
    )
  }

  const body = await request.json()
  const { role } = body

  if (!role || !Object.values(TeamRole).includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${Object.values(TeamRole).join(', ')}` },
      { status: 400 }
    )
  }

  // Only demotion is supported (OWNER → MEMBER)
  // Promotion to OWNER requires ownership transfer (separate flow)
  if (role === TeamRole.OWNER) {
    return NextResponse.json(
      { error: 'Cannot promote to owner. Use ownership transfer instead.' },
      { status: 400 }
    )
  }

  if (targetMember.role === TeamRole.OWNER) {
    return NextResponse.json(
      { error: 'Cannot demote the owner' },
      { status: 400 }
    )
  }

  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: { role: TeamRole.MEMBER },
  })

  // Create audit log entry
  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: 'teamMember',
      entityId: memberId,
      action: 'UPDATE',
      oldValue: { role: targetMember.role },
      newValue: { role: TeamRole.MEMBER },
    },
  })

  return NextResponse.json({ success: true, member: updated })
}

// DELETE /api/teams/[id]/members/[memberId] — Remove member from team
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: teamId, memberId } = await params

  // Check if requester is OWNER of the team
  const requesterMembership = await prisma.teamMember.findFirst({
    where: { teamId, userId: session.user.id },
    select: { role: true },
  })

  if (!requesterMembership || requesterMembership.role !== TeamRole.OWNER) {
    return NextResponse.json(
      { error: 'Only the team owner can remove members' },
      { status: 403 }
    )
  }

  // Get the target member
  const targetMember = await prisma.teamMember.findUnique({
    where: { id: memberId },
    select: { id: true, teamId: true, role: true, userId: true },
  })

  if (!targetMember || targetMember.teamId !== teamId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Cannot remove yourself
  if (targetMember.userId === session.user.id) {
    return NextResponse.json(
      { error: 'You cannot remove yourself from the team' },
      { status: 400 }
    )
  }

  // Cannot remove the owner
  if (targetMember.role === TeamRole.OWNER) {
    return NextResponse.json(
      { error: 'Cannot remove the team owner' },
      { status: 400 }
    )
  }

  await prisma.teamMember.delete({
    where: { id: memberId },
  })

  // Create audit log entry
  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: 'teamMember',
      entityId: memberId,
      action: 'DELETE',
      oldValue: { role: targetMember.role, userId: targetMember.userId },
    },
  })

  return NextResponse.json({ success: true })
}
