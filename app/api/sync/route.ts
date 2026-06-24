import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  Prisma,
  Project,
  ProjectStatus,
  Role,
  subscription,
  SubscriptionFrequency,
  Task,
  TaskPriority,
  TaskStatus,
  Team,
} from "@/app/generated/prisma/client";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get("since");

  try {
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        teamId: true,
      },
    });

    const teamIds = teamMembers.map((tm) => tm.teamId);

    if (teamIds.length === 0) {
      return NextResponse.json({
        teams: [],
        projects: [],
        tasks: [],
        subscriptions: [],
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

    //teams = await sql`SELECT * FROM teams WHERE id = ANY(${teamIds}) AND updated_at > ${sinceDate}`
    teams = await prisma.team.findMany({
      where: {
        id: {
          in: teamIds,
        },
        ...additionalFilters,
      },
    });

    //projects = await sql`SELECT * FROM projects WHERE team_id = ANY(${teamIds}) AND updated_at > ${sinceDate}`
    projects = await prisma.project.findMany({
      where: {
        teamId: {
          in: teamIds,
        },
        ...additionalFilters,
      },
    });

    const projectIds = projects.map((p) => p.id);
    const projectsExist = projectIds.length > 0;

    /* tasks = projectIds.length > 0 
        ? await sql`SELECT * FROM tasks WHERE project_id = ANY(${projectIds}) AND updated_at > ${sinceDate}`
        : [] */

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

    //subscriptions = await sql`SELECT * FROM subscriptions WHERE team_id = ANY(${teamIds}) AND updated_at > ${sinceDate}`
    subscriptions = await prisma.subscription.findMany({
      where: {
        teamId: {
          in: teamIds,
        },
        ...additionalFilters,
      },
    });

    return NextResponse.json({
      teams,
      projects,
      tasks,
      subscriptions,
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
        );
        break;
      case "project":
        result = await handleProjectSync(
          action,
          recordId,
          payload,
          session.user.id,
        );
        break;
      case "subscription":
        console.log("sync subscriptions");
        result = await handleSubscriptionSync(
          action,
          recordId,
          payload,
          session.user.id,
        );
        break;
      case "team":
        result = await handleTeamSync(
          action,
          recordId,
          payload,
          session.user.id,
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
) {
  switch (action) {
    case "create": {
      const newId = recordId.startsWith("offline_")
        ? crypto.randomUUID()
        : recordId;
      /* const result = await sql`
        INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, due_date, position, created_by)
        VALUES (${newId}, ${payload.projectId as string}, ${payload.title as string}, ${payload.description as string | null}, 
                ${payload.status as string}, ${payload.priority as string}, ${payload.assignedTo as string | null}, 
                ${payload.dueDate ? new Date(payload.dueDate as string) : null}, ${payload.position as number}, ${userId})
        RETURNING *
      `; */
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

      return result;
    }
    case "update": {
      /* const result = await sql`
        UPDATE tasks 
        SET title = ${payload.title as string}, description = ${payload.description as string | null},
            status = ${payload.status as string}, priority = ${payload.priority as string},
            assigned_to = ${payload.assignedTo as string | null}, 
            due_date = ${payload.dueDate ? new Date(payload.dueDate as string) : null},
            position = ${payload.position as number}, updated_at = NOW()
        WHERE id = ${recordId}
        RETURNING *
      `; */
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

      return result;
    }

    case "delete":
      //await sql`DELETE FROM tasks WHERE id = ${recordId}`;
      const result = await prisma.task.delete({
        where: {
          id: recordId,
        },
      });
      return { id: recordId, deleted: true };

    default:
      throw new Error("Unknown action");
  }
}

async function handleProjectSync(
  action: string,
  recordId: string,
  payload: Record<string, unknown>,
  userId: string,
) {
  switch (action) {
    case "create": {
      const newId = recordId.startsWith("offline_")
        ? crypto.randomUUID()
        : recordId;

      /* const result = await sql`
        INSERT INTO projects (id, team_id, name, description, status, created_by)
        VALUES (${newId}, ${payload.teamId as string}, ${payload.name as string}, 
                ${payload.description as string | null}, ${(payload.status as string) || "active"}, ${userId})
        RETURNING *
      `; */
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

      return result;
    }
    case "update": {
      /* const result = await sql`
        UPDATE projects 
        SET name = ${payload.name as string}, description = ${payload.description as string | null},
            status = ${payload.status as string}, updated_at = NOW()
        WHERE id = ${recordId}
        RETURNING *
      `; */
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

      return result;
    }
    case "delete":
      /* await sql`DELETE FROM projects WHERE id = ${recordId}`; */
      await prisma.project.delete({
        where: {
          id: recordId,
        },
      });
      return { id: recordId, deleted: true };
    default:
      throw new Error("Unknown action");
  }
}

async function handleSubscriptionSync(
  action: string,
  recordId: string,
  payload: Record<string, any>,
  userId: string,
) {
  // Logic for handling offline IDs remains the same
  const id = recordId.startsWith("offline_") ? crypto.randomUUID() : recordId;

  switch (action) {
    case "create": {
      console.log("Payload: ", payload);
      return await prisma.subscription.create({
        data: {
          id: id,
          teamId: payload.teamId,
          serviceName: payload.serviceName,
          provider: payload.provider,
          cost: payload.cost,
          currency: payload.currency || "USD",
          frequency: payload.frequency as SubscriptionFrequency,
          startDate: payload.startDate
            ? new Date(payload.startDate)
            : new Date(),
          lastPaymentDate: payload.lastPaymentDate
            ? new Date(payload.lastPaymentDate)
            : new Date(),
          notes: payload.notes || "",
          isActive: payload.isActive,
        },
      });
    }

    case "update": {
      const { teamId, team, team_name, status, ...data } = payload;
      console.log("Data: ", data);
      return await prisma.subscription.update({
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
    }

    case "delete":
      await prisma.subscription.delete({
        where: { id: recordId },
      });
      return { id: recordId, deleted: true };

    default:
      throw new Error("Unknown action");
  }
}

async function handleTeamSync(
  action: string,
  recordId: string,
  payload: Record<string, any>,
  userId: string,
) {
  const id = recordId.startsWith("offline_") ? crypto.randomUUID() : recordId;

  switch (action) {
    case "create": {
      /**
       * Using a Nested Write:
       * This creates the Team and the TeamMember (Owner) in a single
       * atomic database transaction.
       */
      return await prisma.team.upsert({
        where: {
          slug: payload.slug,
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
              role: Role.OWNER,
            },
          },
        },
        // Include members in the return if you need the full object immediately
        include: {
          members: true,
        },
      });
    }

    case "update": {
      return await prisma.team.update({
        where: { id: recordId },
        data: {
          name: payload.name,
          slug: payload.slug,
          logo: payload.logo,
          metadata: payload.metadata,
        },
      });
    }

    case "delete":
      /**
       * Because your schema now has 'onDelete: Cascade' on the
       * TeamMember -> Team relation, deleting the team will
       * automatically delete all its members.
       */
      await prisma.team.delete({
        where: { id: recordId },
      });
      return { id: recordId, deleted: true };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
