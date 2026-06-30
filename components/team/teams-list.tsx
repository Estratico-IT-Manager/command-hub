'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Users, ChevronRight } from 'lucide-react'

interface TeamWithMembers {
  id: string
  name: string
  slug: string
  role: string
  member_count: number
  createdAt: string
  updatedAt: string
  logo: string
  metadata: any
  pendingSync?: boolean
}

interface TeamsListProps {
  teams: TeamWithMembers[]
  currentUserId: string
}

const roleColors = {
  owner: 'bg-[var(--estratico-primary)] text-[var(--estratico-primary-foreground)]',
  admin: 'bg-[var(--estratico-accent)] text-[var(--estratico-accent-foreground)]',
  member: 'bg-muted text-muted-foreground'
}

export function TeamsList({ teams }: TeamsListProps) {
  if (teams.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>No teams yet</EmptyTitle>
        </EmptyHeader>
        <EmptyDescription>
          Create your first team to start collaborating
        </EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {teams.map((team) => (
        <Link key={team.id} href={`/dashboard/team/${team.id}`}>
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--estratico-primary)] text-[var(--estratico-primary-foreground)]">
                    <span className="text-sm font-bold">{team.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <CardDescription className="text-xs">
                      @{team.slug}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={roleColors[team.role as keyof typeof roleColors]}>
                    {team.role}
                  </Badge>
                  {team.pendingSync && (
                    <Badge variant="secondary" className="bg-[var(--estratico-warning)]/10 text-[var(--estratico-warning)] border-[var(--estratico-warning)]/20">
                      Pending Sync
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="size-4" />
                  <span>{team.member_count} {team.member_count === 1 ? 'member' : 'members'}</span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
