'use client'

import { TeamMembers } from '@/components/team/team-members'
import { InviteMemberDialog } from '@/components/team/invite-member-dialog'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useTeam } from '@/hooks/use-teams'

interface TeamDetailClientProps {
  teamId: string
  userId: string
}

export function TeamDetailClient({ teamId, userId }: TeamDetailClientProps) {
  const { data, isLoading, error } = useTeam(teamId)

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
        Team not found or you don't have access.
      </div>
    )
  }

  const { team, members, invitations, userRole, canManage } = data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{team.name}</h1>
          <p className="text-muted-foreground">@{team.slug}</p>
        </div>
        {canManage && <InviteMemberDialog teamId={team.id} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TeamMembers
            members={members}
            currentUserId={userId}
            userRole={userRole}
            teamId={team.id}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Role</CardTitle>
              <CardDescription>Your permissions in this team</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="capitalize font-medium">{userRole}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {userRole === 'OWNER' &&
                  'Full access to manage team settings and members'}
                {userRole === 'MEMBER' &&
                  'Can view and contribute to team projects'}
              </p>
            </CardContent>
          </Card>

          {canManage && invitations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pending Invitations</CardTitle>
                <CardDescription>{invitations.length} pending</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-muted-foreground">
                  {invitations.map((inv: { id: string; email: string }) => (
                    <li key={inv.id} className="py-1">
                      {inv.email}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
