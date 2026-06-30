import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { InvitationStatus } from "@/app/generated/prisma/enums";
import { env } from "@/lib/env";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() });
  const p = await params
  const inviteId = p.id;

  // 1. Check if user is logged in
  if (!session) {
    // Redirect to login but save the return URL
    return NextResponse.redirect(
      `${env.BETTER_AUTH_URL}/login?callbackUrl=/invite/${inviteId}`
    );
  }

  try {
    const invitation = await prisma.teamInvitation.findUnique({
      where: { id: inviteId },
      include: { team: true },
    });

    // 2. Validate Invitation
    if (!invitation || invitation.status !== InvitationStatus.PENDING) {
      return NextResponse.json({ error: "Invitation not found or already processed" }, { status: 404 });
    }

    if (new Date() > invitation.expiresAt) {
      await prisma.teamInvitation.update({
        where: { id: inviteId },
        data: { status: InvitationStatus.EXPIRED },
      });
      return NextResponse.json({ error: "Invitation expired" }, { status: 410 });
    }

    // 3. Email Match (Optional security step)
    if (invitation.email !== session.user.email) {
      return NextResponse.json(
        { error: "This invitation was sent to a different email address." },
        { status: 403 }
      );
    }

    // 4. Atomic Transaction: Join Team & Mark Invite Accepted
    await prisma.$transaction([
      prisma.teamMember.create({
        data: {
          teamId: invitation.teamId,
          userId: session.user.id,
          role: invitation.role,
        },
      }),
      prisma.teamInvitation.update({
        where: { id: inviteId },
        data: { status: InvitationStatus.ACCEPTED },
      }),
    ]);

    // 5. Redirect to the team dashboard
    return NextResponse.redirect(`${env.BETTER_AUTH_URL}/dashboard/team/${invitation.teamId}`);

  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}