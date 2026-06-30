'use client'

import { TeamsList } from '@/components/team/teams-list'
import { CreateTeamDialog } from '@/components/team/create-team-dialog'
import { Spinner } from '@/components/ui/spinner'
import { useTeams } from '@/hooks/use-teams'

interface TeamListClientProps {
  userId: string
}

export function TeamListClient({ userId }: TeamListClientProps) {
  const { data: teams, isLoading, error } = useTeams()

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
        Failed to load teams. Please try again.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Teams</h1>
          <p className="text-muted-foreground">Manage your teams and members</p>
        </div>
        <CreateTeamDialog />
      </div>

      <TeamsList teams={teams ?? []} currentUserId={userId} />
    </div>
  )
}
