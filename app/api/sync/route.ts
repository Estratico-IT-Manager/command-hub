import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  Prisma,
  Project,
  ProjectStatus,
  UserRole,
  TeamRole,
  subscription,
  SubscriptionFrequency,
  Task,
  TaskPriority,
  TaskStatus,
  Team,
} from "@/app/generated/prisma/client";
import { Prisma } from "@/app/generated/prisma/client";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole | null;
  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  try {
    let teamIds: string[];

    // SUPER_ADMIN can access all data
    if (userRole === UserRole.SUPER_ADMIN) {
      const allTeams = await prisma.team.findMany({
        select: { id: true },
      });
      teamIds = allTeams.map((t) => t.id);
    } else {
      const teamMembers = await prisma.teamMember.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          teamId: true,
        },
      });
      teamIds = teamMembers.map((tm) => tm.teamId);
    }

    if (teamIds.length === 0) {
      return NextResponse.json({
        teams: [],
        projects: [],
        tasks: [],
        subscriptions: [],
        subscriptionHistory: [],
        auditLogs: [],
      });
    }

    let teams: Team[],
      projects: Project[],
      tasks: Task[],
      subscriptions: subscription[];

    const getFilterObj = () => {
      if (since) {
        const sinceDate = new Date(since);
        return {
          createdAt: {
            gt: sinceDate,
          },
        };
      } else {
        return {};
      }
    };

    const additionalFilters = getFilterObj();

    teams = await prisma.team.findMany({
      where: {
        id: {
          in: teamIds,
        },
        ...additionalFilters,
      },
    });

    projects = await prisma.project.findMany({
      where: {
        teamId: {
          in: teamIds,
        },
        ...additionalFilters,
      },
    });

    const projectIds = projects.map((p) => p.id);

    tasks = !projectIds
      ? []
      : await prisma.task.findMany({
          where: {
            projectId: {
              in: projectIds,
            },
            ...additionalFilters,
          },
        });

    subscriptions = await prisma.subscription.findMany({
      where: {
        teamId: {
          in: teamIds,
        },
        ...additionalFilters,
      },
    });

    // Fetch subscription history for all subscriptions
    const subscriptionIds = subscriptions.map((s) => s.id);
    const subscriptionHistory = subscriptionIds.length > 0
      ? await prisma.subscription_history.findMany({
          where: {
            subscriptionId: {
              in: subscriptionIds,
            },
            ...additionalFilters,
          },
        })
      : [];

    // Fetch audit logs for entities in these teams
    const entityTypes = ["subscription", "subscription_history", "project", "task", "team"];
    const allEntityIds = [
      ...subscriptionIds,
      ...subscriptions.map((s) => s.id),
      ...projects.map((p) => p.id),
      ...tasks.map((t) => t.id),
      ...teamIds,
    ];

    const auditLogs = allEntityIds.length > 0
      ? await prisma.audit_log.findMany({
          where: {
            OR: [
              {
                entityType: { in: entityTypes },
                entityId: { in: allEntityIds },
              },
              {
                entityType: "team",
                entityId: { in: teamIds },
              },
            ],
            ...additionalFilters,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        })
      : [];

    return NextResponse.json({
      teams,
      projects,
      tasks,
      subscriptions,
      subscriptionHistory,
      auditLogs,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync pull error:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = session.user.role as UserRole | null;

  try {
    const { tableName, recordId, action, payload } = await request.json();

    // Log sync operation
    await prisma.syncLog.create({
      data: {
        userId: session.user.id,
        tableName,
        recordId,
        action,
        payload: JSON.stringify(payload),
      },
    });

    let result;

    switch (tableName) {
      case "task":
        result = await handleTaskSync(
          action,
          recordId,
          payload,
          session.user.id,
          userRole,
        );
        break;
      case "project":
        result = await handleProjectSync(
          action,
          recordId,
          payload,
          session.user.id,
          userRole,
        );
        break;
      case "subscription":
        console.log("sync subscriptions");
        result = await handleSubscriptionSync(
          action,
          recordId,
          payload,
          session.user.id,
          userRole,
        );
        break;
      case "subscription_history":
        result = await handleSubscriptionHistorySync(
          action,
          recordId,
          payload,
          session.user.id,
          userRole,
        );
        break;
      case "team":
        result = await handleTeamSync(
          action,
          recordId,
          payload,
          session.user.id,
          userRole,
        );
        break;
      default:
        return NextResponse.json(
          { error: "Unknown entity type" },
          { status: 400 },
        );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Sync push error:", error);
    return NextResponse.json({ error: "Failed to sync data" }, { status: 500 });
  }
}

async function handleTaskSync(
  action: string,
  recordId: string,
  payload: Record<string, unknown>,
  userId: string,
  userRole: UserRole | null,
) {
  switch (action) {
    case "create": {
      const newId = recordId.startsWith("offline_")
        ? crypto.randomUUID()
        : recordId;

      const {
        projectId,
        title,
        description,
        status,
        priority,
        assignedTo,
        dueDate,
        position,
      } = payload as {
        projectId: string;
        title: string;
        description: string;
        status: TaskStatus;
        priority: TaskPriority;
        assignedTo: string;
        dueDate: string;
        position: number;
      };

      const result = await prisma.task.create({
        data: {
          projectId,
          title,
          description,
          status,
          priority,
          assignedTo,
          position,
          dueDate: new Date(dueDate ?? ""),
          createdBy: userId,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "task",
          entityId: result.id,
          action: "CREATE",
          newValue: result,
        },
      });

      return result;
    }
    case "update": {
      const existing = await prisma.task.findUnique({
        where: { id: recordId },
      });

      const {
        projectId,
        title,
        description,
        status,
        priority,
        assignedTo,
        dueDate,
        position,
      } = payload as Partial<{
        projectId: string;
        title: string;
        description: string;
        status: TaskStatus;
        priority: TaskPriority;
        assignedTo: string;
        dueDate: string;
        position: number;
      }>;

      const result = await prisma.task.update({
        where: {
          id: recordId,
        },
        data: {
          projectId,
          title,
          description,
          assignedTo,
          position,
          dueDate: new Date(dueDate ?? ""),
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "task",
          entityId: recordId,
          action: "UPDATE",
          oldValue: existing || Prisma.JsonNull,
          newValue: result,
        },
      });

      return result;
    }

    case "delete": {
      const existing = await prisma.task.findUnique({
        where: { id: recordId },
      });

      await prisma.task.delete({
        where: {
          id: recordId,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "task",
          entityId: recordId,
          action: "DELETE",
          oldValue: existing || Prisma.JsonNull,
        },
      });

      return { id: recordId, deleted: true };
    }

    default:
      throw new Error("Unknown action");
  }
}

async function handleProjectSync(
  action: string,
  recordId: string,
  payload: Record<string, unknown>,
  userId: string,
  userRole: UserRole | null,
) {
  switch (action) {
    case "create": {
      const newId = recordId.startsWith("offline_")
        ? crypto.randomUUID()
        : recordId;

      const { teamId, name, description, status } = payload as {
        teamId: string;
        name: string;
        description: string;
        status: ProjectStatus;
      };

      const projectData: Prisma.ProjectCreateInput = {
        name,
        description:description || "",
        status,
        creator: { connect: { id: userId } },
        team: {
          connect: {
            id: teamId,
          },
        },
      };

      const result = await prisma.project.create({
        data: projectData,
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "project",
          entityId: result.id,
          action: "CREATE",
          newValue: result,
        },
      });

      return result;
    }
    case "update": {
      const existing = await prisma.project.findUnique({
        where: { id: recordId },
      });

      const { teamId, name, description, status } = payload as Partial<{
        teamId: string;
        name: string;
        description: string;
        status: ProjectStatus;
      }>;

      const result = await prisma.project.update({
        where: {
          id: recordId,
        },
        data: {
          teamId,
          name,
          description,
          status,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "project",
          entityId: recordId,
          action: "UPDATE",
          oldValue: existing || Prisma.JsonNull,
          newValue: result,
        },
      });

      return result;
    }
    case "delete": {
      const existing = await prisma.project.findUnique({
        where: { id: recordId },
      });

      await prisma.project.delete({
        where: {
          id: recordId,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "project",
          entityId: recordId,
          action: "DELETE",
          oldValue: existing || Prisma.JsonNull,
        },
      });

      return { id: recordId, deleted: true };
    }
    default:
      throw new Error("Unknown action");
  }
}

async function handleSubscriptionSync(
  action: string,
  recordId: string,
  payload: Record<string, any>,
  userId: string,
  userRole: UserRole | null,
) {
  // Logic for handling offline IDs remains the same
  const id = recordId.startsWith("offline_") ? crypto.randomUUID() : recordId;

  switch (action) {
    case "create": {
      const result = await prisma.subscription.create({
        data: {
          id: id,
          teamId: payload.teamId,
          serviceName: payload.name,
          provider: payload.provider,
          cost: payload.cost,
          currency: payload.currency || "USD",
          frequency: payload.frequency as SubscriptionFrequency,
          startDate: payload.startDate
            ? new Date(payload.startDate)
            : new Date(),
          notes: payload.notes || "",
          isActive: payload.isActive,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "subscription",
          entityId: result.id,
          action: "CREATE",
          newValue: result,
        },
      });

      return result;
    }

    case "update": {
      const existing = await prisma.subscription.findUnique({
        where: { id: recordId },
      });

      const result = await prisma.subscription.update({
        where: { id: recordId },
        data: {
          ...data,
          notes: data.notes || "",
          version: data.version + 1,
          cost: Number(data.cost),
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          lastPaymentDate: data.lastPaymentDate
            ? new Date(data.lastPaymentDate)
            : undefined,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "subscription",
          entityId: recordId,
          action: "UPDATE",
          oldValue: existing || Prisma.JsonNull,
          newValue: result,
        },
      });

      return result;
    }

    case "delete": {
      const existing = await prisma.subscription.findUnique({
        where: { id: recordId },
      });

      await prisma.subscription.delete({
        where: { id: recordId },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "subscription",
          entityId: recordId,
          action: "DELETE",
          oldValue: existing || Prisma.JsonNull,
        },
      });

      return { id: recordId, deleted: true };
    }

    default:
      throw new Error("Unknown action");
  }
}

async function handleTeamSync(
  action: string,
  recordId: string,
  payload: Record<string, any>,
  userId: string,
  userRole: UserRole | null,
) {
  const id = recordId.startsWith("offline_") ? crypto.randomUUID() : recordId;

  switch (action) {
    case "create": {
      const result = await prisma.team.upsert({
        where:{
          slug:payload.slug
        },
        update: {
          name: payload.name,
          slug: payload.slug,
          logo: payload.logo || "",
          metadata: payload.metadata || {},
        },
        create: {
          name: payload.name,
          slug: payload.slug,
          logo: payload.logo || "",
          metadata: payload.metadata || {},
          members: {
            create: {
              userId: userId,
              role: TeamRole.OWNER,
            },
          },
        },
        include: {
          members: true,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "team",
          entityId: result.id,
          action: "CREATE",
          newValue: result,
        },
      });

      return result;
    }

    case "update": {
      const existing = await prisma.team.findUnique({
        where: { id: recordId },
      });

      const result = await prisma.team.update({
        where: { id: recordId },
        data: {
          name: payload.name,
          slug: payload.slug,
          logo: payload.logo,
          metadata: payload.metadata,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "team",
          entityId: recordId,
          action: "UPDATE",
          oldValue: existing || Prisma.JsonNull,
          newValue: result,
        },
      });

      return result;
    }

    case "delete": {
      const existing = await prisma.team.findUnique({
        where: { id: recordId },
      });

      await prisma.team.delete({
        where: { id: recordId },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "team",
          entityId: recordId,
          action: "DELETE",
          oldValue: existing || Prisma.JsonNull,
        },
      });

      return { id: recordId, deleted: true };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function handleSubscriptionHistorySync(
  action: string,
  recordId: string,
  payload: Record<string, any>,
  userId: string,
  userRole: UserRole | null,
) {
  // SUPER_ADMIN can modify any subscription history
  if (userRole !== UserRole.SUPER_ADMIN) {
    // For OWNER, check team ownership via subscription
    if (payload.subscriptionId) {
      const subscription = await prisma.subscription.findUnique({
        where: { id: payload.subscriptionId },
        select: { teamId: true },
      })

      if (!subscription) {
        throw new Error("Subscription not found");
      }

      const membership = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: subscription.teamId,
            userId: userId,
          },
        },
      })

      if (!membership || membership.role !== TeamRole.OWNER) {
        throw new Error("Unauthorized: Only SUPER_ADMIN and team OWNER can modify subscription history");
      }
    } else {
      throw new Error("Unauthorized: Only SUPER_ADMIN and team OWNER can modify subscription history");
    }
  }

  const id = recordId.startsWith("offline_") ? crypto.randomUUID() : recordId;

  switch (action) {
    case "create": {
      const result = await prisma.subscription_history.create({
        data: {
          id: id,
          subscriptionId: payload.subscriptionId,
          transactionId: payload.transactionId,
          cost: payload.cost,
          dayPaid: new Date(payload.dayPaid),
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "subscription_history",
          entityId: result.id,
          action: "CREATE",
          newValue: result,
        },
      });

      return result;
    }

    case "update": {
      const existing = await prisma.subscription_history.findUnique({
        where: { id: recordId },
      });

      const result = await prisma.subscription_history.update({
        where: { id: recordId },
        data: {
          transactionId: payload.transactionId,
          cost: payload.cost,
          dayPaid: payload.dayPaid ? new Date(payload.dayPaid) : undefined,
        },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "subscription_history",
          entityId: recordId,
          action: "UPDATE",
          oldValue: existing || Prisma.JsonNull,
          newValue: result,
        },
      });

      return result;
    }

    case "delete": {
      const existing = await prisma.subscription_history.findUnique({
        where: { id: recordId },
      });

      await prisma.subscription_history.delete({
        where: { id: recordId },
      });

      // Create audit log entry
      await prisma.audit_log.create({
        data: {
          userId,
          entityType: "subscription_history",
          entityId: recordId,
          action: "DELETE",
          oldValue: existing || Prisma.JsonNull,
        },
      });

      return { id: recordId, deleted: true };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
