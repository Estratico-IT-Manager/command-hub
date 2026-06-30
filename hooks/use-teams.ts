'use client'

import { useQuery } from '@tanstack/react-query'

async function fetchTeams() {
  const res = await fetch('/api/teams')
  if (!res.ok) throw new Error('Failed to fetch teams')
  return res.json()
}

async function fetchTeam(id: string) {
  const res = await fetch(`/api/teams/${id}`)
  if (!res.ok) throw new Error('Failed to fetch team')
  return res.json()
}

export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: fetchTeams,
  })
}

export function useTeam(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: () => fetchTeam(teamId),
    enabled: !!teamId,
  })
}
