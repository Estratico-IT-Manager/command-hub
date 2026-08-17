import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  KanbanSquare,
  CreditCard,
  Users,
  CheckCircle2,
  Clock,
  CalendarClock,
} from "lucide-react";
import prisma from "@/lib/prisma";
import {
  TaskStatus,
  SubscriptionFrequency,
} from "@/app/generated/prisma/enums";
import {
  formatDistanceToNow,
  format,
  addWeeks,
  addMonths,
  addYears,
} from "date-fns";

async function getDashboardStats(userId: string) {
  // 1. Get user's teams
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });

  const teamIds = teamMembers.map((tm) => tm.teamId);

  // Early return if no teams
  if (teamIds.length === 0) {
    return {
      projects: 0,
      tasks: 0,
      completedTasks: 0,
      subscriptions: 0,
      monthlySpend: 0,
      teamMembers: 0,
    };
  }

  // 2. Run core counts in parallel
  const [projectsCount, subscriptionsAgg, totalTeamMembers] = await Promise.all(
    [
      prisma.project.count({ where: { teamId: { in: teamIds } } }),
      prisma.subscription.aggregate({
        where: { teamId: { in: teamIds }, isActive: true, isDeleted: false },
        _count: { _all: true },
        _sum: { cost: true },
      }),
      prisma.teamMember.count({ where: { teamId: { in: teamIds } } }),
    ],
  );

  // 3. Get Project IDs for Task filtering
  const projects = await prisma.project.findMany({
    where: { teamId: { in: teamIds } },
    select: { id: true },
  });
  const projectIdArray = projects.map((p) => p.id);

  // 4. Calculate Task stats
  let tasksCount = 0;
  let completedTasks = 0;

  if (projectIdArray.length > 0) {
    const taskStats = await prisma.task.groupBy({
      by: ["status"],
      where: { projectId: { in: projectIdArray } },
      _count: { _all: true },
    });

    tasksCount = taskStats.reduce((acc, curr) => acc + curr._count._all, 0);
    completedTasks =
      taskStats.find((s) => s.status === TaskStatus.DONE)?._count._all || 0;
  }

  // 5. Final Return (Cleaned up variable names)
  return {
    projects: projectsCount,
    tasks: tasksCount,
    completedTasks: completedTasks,
    subscriptions: subscriptionsAgg._count._all || 0,
    monthlySpend: Number(subscriptionsAgg._sum.cost || 0),
    teamMembers: totalTeamMembers,
  };
}

async function getRecentActivity(userId: string) {
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });

  const teamIds = teamMembers.map((tm) => tm.teamId);

  if (teamIds.length === 0) {
    return [];
  }

  const projects = await prisma.project.findMany({
    where: { teamId: { in: teamIds } },
    select: { id: true },
  });
  const projectIdArray = projects.map((p) => p.id);

  if (projectIdArray.length === 0) {
    return [];
  }

  // Get recent tasks (created or updated)
  const recentTasks = await prisma.task.findMany({
    where: { projectId: { in: projectIdArray } },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      project: {
        select: { name: true },
      },
    },
  });

  return recentTasks.map((task) => ({
    id: task.id,
    title: task.title,
    projectName: task.project.name,
    status: task.status,
    updatedAt: task.updatedAt,
  }));
}

function calculateNextBillingDate(
  lastPaymentDate: Date,
  frequency: SubscriptionFrequency,
): Date {
  switch (frequency) {
    case SubscriptionFrequency.WEEKLY:
      return addWeeks(lastPaymentDate, 1);
    case SubscriptionFrequency.FORTNIGHTLY:
      return addWeeks(lastPaymentDate, 2);
    case SubscriptionFrequency.MONTHLY:
      return addMonths(lastPaymentDate, 1);
    case SubscriptionFrequency.QUARTERLY:
      return addMonths(lastPaymentDate, 3);
    case SubscriptionFrequency.YEARLY:
      return addYears(lastPaymentDate, 1);
    default:
      return addMonths(lastPaymentDate, 1);
  }
}

async function getUpcomingRenewals(userId: string) {
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });

  const teamIds = teamMembers.map((tm) => tm.teamId);

  if (teamIds.length === 0) {
    return [];
  }

  // Get all active subscriptions
  const subscriptions = await prisma.subscription.findMany({
    where: {
      teamId: { in: teamIds },
      isActive: true,
      isDeleted: false,
    },
    include: {
      team: {
        select: { name: true },
      },
    },
  });

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Calculate next billing date and filter for upcoming renewals
  const upcomingRenewals = subscriptions
    .map((sub) => {
      const nextBillingDate = calculateNextBillingDate(
        sub.lastPaymentDate,
        sub.frequency,
      );
      return {
        id: sub.id,
        serviceName: sub.serviceName,
        cost: Number(sub.cost),
        currency: sub.currency,
        nextBillingDate,
        teamName: sub.team.name,
        frequency: sub.frequency,
      };
    })
    .filter(
      (sub) =>
        sub.nextBillingDate >= now && sub.nextBillingDate <= thirtyDaysFromNow,
    )
    .sort((a, b) => a.nextBillingDate.getTime() - b.nextBillingDate.getTime())
    .slice(0, 5);

  return upcomingRenewals;
}

function getStatusColor(status: TaskStatus) {
  switch (status) {
    case TaskStatus.DONE:
      return "text-green-600";
    case TaskStatus.IN_PROGRESS:
      return "text-blue-600";
    case TaskStatus.TODO:
      return "text-yellow-600";
    default:
      return "text-muted-foreground";
  }
}

function getStatusLabel(status: TaskStatus) {
  switch (status) {
    case TaskStatus.DONE:
      return "Completed";
    case TaskStatus.IN_PROGRESS:
      return "In Progress";
    case TaskStatus.TODO:
      return "To Do";
    default:
      return status;
  }
}

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  return <DashboardClient userId={session!.user.id} userName={session?.user.name || 'User'} />
}
