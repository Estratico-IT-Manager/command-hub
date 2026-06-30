import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { InvitationStatus, TeamRole } from "@/app/generated/prisma/enums";
import { addDays } from "date-fns";
import { resend } from "@/lib/resend";
import { EmailTemplate } from "@/components/email-template";
import { ALLOWED_DOMAIN } from "@/lib/constants";
import { env } from "@/lib/env";


export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { teamId, email } = await request.json();

    // Validate email domain
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return NextResponse.json(
        { error: `Only @${ALLOWED_DOMAIN} email addresses can be invited` },
        { status: 400 },
      );
    }

    // Check if user has permission to invite

    const membership = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId: session.user.id,
      },
      select: {
        role: true,
        team: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const userRole = membership.role;
    if (userRole !== TeamRole.OWNER) {
      return NextResponse.json(
        { error: "You do not have permission to invite members" },
        { status: 403 }
      );
    }

    // Check if user is already a member

    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        teamMemberships: {
          some: {
            teamId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "This user is already a team member" },
        { status: 400 },
      );
    }

    // Check for existing pending invitation

    const existingInvitation = await prisma.teamInvitation.findFirst({
      where: {
        teamId,
        email,
        status: InvitationStatus.PENDING,
      },
      select: {
        id: true,
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: "An invitation has already been sent to this email" },
        { status: 400 },
      );
    }

    // Create invitation

    const invitation = await prisma.teamInvitation.create({
      data: {
        teamId,
        email,
        role: TeamRole.MEMBER,
        invitedBy: session.user.id,
        expiresAt: addDays(new Date(), 1),
      },
    });

    // In production, send email here

    const { data, error } = await resend.emails.send({
      from: `Estratico <${session.user.email}>`,
      to: [email],
      subject: `Invitation to join team '${membership.team.name}'`,
      react: EmailTemplate({
        type: "team-invite",
        data: {
          invitedBy: session.user.name,
          teamName: membership.team.name,
          inviteLink: `${env.BETTER_AUTH_URL}/invite/${invitation.id}`,
        },
      }),
    });

    if (error) {
      console.error(error);
      return Response.json({ error }, { status: 500 });
    }

    return NextResponse.json({ success: true, invitation: invitation });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 },
    );
  }
}
