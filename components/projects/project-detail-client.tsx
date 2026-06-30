'use client'

import { KanbanBoard } from '@/components/projects/kanban-board'
import { CreateTaskDialog } from '@/components/projects/create-task-dialog'
import { Spinner } from '@/components/ui/spinner'
import { useProject } from '@/hooks/use-projects'

interface ProjectDetailClientProps {
  projectId: string
  userId: string
}

export function ProjectDetailClient({ projectId, userId }: ProjectDetailClientProps) {
  const { data, isLoading, error } = useProject(projectId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Project not found or you don't have access.
      </div>
    )
  }

  const { project, tasks, teamMembers } = data

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{project.name}</h1>
          <p className="text-muted-foreground">{project.team_name}</p>
        </div>
        <CreateTaskDialog projectId={project.id} teamMembers={teamMembers} />
      </div>

      <KanbanBoard
        projectId={project.id}
        initialTasks={tasks}
        teamMembers={teamMembers}
      />
    </div>
  )
}
