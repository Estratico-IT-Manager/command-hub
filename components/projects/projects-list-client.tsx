'use client'

import { ProjectsList } from '@/components/projects/projects-list'
import { CreateProjectDialog } from '@/components/projects/create-project-dialog'
import { Spinner } from '@/components/ui/spinner'
import { useProjects } from '@/hooks/use-projects'

interface ProjectsListClientProps {
  userId: string
}

export function ProjectsListClient({ userId }: ProjectsListClientProps) {
  const { data, isLoading, error } = useProjects()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Failed to load projects. Please try again.
      </div>
    )
  }

  const projects = data?.projects ?? []
  const teams = data?.teams ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
          <p className="text-muted-foreground">Manage your team projects and tasks</p>
        </div>
        <CreateProjectDialog teams={teams} />
      </div>

      <ProjectsList projects={projects} />
    </div>
  )
}
