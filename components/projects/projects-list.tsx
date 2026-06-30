"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { KanbanSquare } from "lucide-react";
import type { Project, ProjectStatus } from "@/app/generated/prisma/client";

interface ProjectsListProps {
  projects: (Project & { team_name: string; pendingSync?: boolean })[];
}

const statusColors: Record<ProjectStatus,string> = {
  "DONE":
    "bg-[var(--estratico-success)]/10 text-[var(--estratico-success)] border-[var(--estratico-success)]/20",
  
  "IN_PROGRESS": 
    "bg-[var(--estratico-info)]/10 text-[var(--estratico-info)] border-[var(--estratico-info)]/20",
  
  "BACKLOG":
    "bg-muted text-muted-foreground border-muted",
};

export function ProjectsList({ projects }: ProjectsListProps) {
  if (projects.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <KanbanSquare />
          </EmptyMedia>
          <EmptyTitle>No projects yet</EmptyTitle>
        </EmptyHeader>
        <EmptyDescription>
          Create your first project to start managing tasks
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{project.name}</CardTitle>
                <div className="flex items-center gap-2">
                  {project.pendingSync && (
                    <Badge variant="secondary" className="bg-[var(--estratico-warning)]/10 text-[var(--estratico-warning)] border-[var(--estratico-warning)]/20">
                      Pending Sync
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={statusColors[project.status]}
                  >
                    {project.status}
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-xs">
                {project.team_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description || "No description"}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
