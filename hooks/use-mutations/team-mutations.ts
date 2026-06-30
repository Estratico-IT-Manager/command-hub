'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toastDefault, toastSuccess, toastError } from '@/hooks/use-toast'
import { offlineDb, generateOfflineId } from '@/lib/offline-db'
import { syncEngine } from '@/lib/sync-engine'

export function useCreateTeam() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: { name: string; slug: string }) => {
      const teamId = generateOfflineId()

      await offlineDb.teams.add({
        id: teamId,
        name: data.name,
        slug: data.slug,
        logo: '',
        metadata: '',
        createdAt: '',
        updatedAt: '',
        synced: false,
        pendingSync: true,
      })

      // Optimistic update: add team to query cache with pendingSync
      queryClient.setQueryData(['teams'], (old: any) => {
        if (!old) return old
        const newTeam = {
          id: teamId,
          name: data.name,
          slug: data.slug,
          logo: '',
          metadata: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          synced: false,
          pendingSync: true,
          role: 'owner',
          member_count: 1,
        }
        return [newTeam, ...(Array.isArray(old) ? old : [])]
      })

      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'team',
          recordId: teamId,
          action: 'create',
          queryKey: ['teams'],
          payload: { name: data.name, slug: data.slug },
        })
      }

      return { teamId }
    },
    onMutate: () => {
      toastDefault('Creating team...')
    },
    onSuccess: () => {
      toastSuccess('Team created successfully')
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      router.refresh()
    },
    onError: (error: Error) => {
      toastError(`Failed to create team: ${error.message}`)
    },
  })
}

export function useInviteMember(teamId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await fetch('/api/teams/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, email: data.email }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to send invitation')
      }

      return res.json()
    },
    onMutate: () => {
      toastDefault('Sending invitation...')
    },
    onSuccess: () => {
      toastSuccess('Invitation sent successfully')
      queryClient.invalidateQueries({ queryKey: ['team', teamId] })
      router.refresh()
    },
    onError: (error: Error) => {
      toastError(`Failed to send invitation: ${error.message}`)
    },
  })
}

export function useUpdateMemberRole(teamId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: { memberId: string; role: string }) => {
      const res = await fetch(`/api/teams/${teamId}/members/${data.memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: data.role }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update member role')
      }

      return res.json()
    },
    onMutate: () => {
      toastDefault('Updating member role...')
    },
    onSuccess: () => {
      toastSuccess('Member role updated successfully')
      queryClient.invalidateQueries({ queryKey: ['team', teamId] })
      router.refresh()
    },
    onError: (error: Error) => {
      toastError(`Failed to update member role: ${error.message}`)
    },
  })
}

export function useRemoveMember(teamId: string) {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: { memberId: string }) => {
      const res = await fetch(`/api/teams/${teamId}/members/${data.memberId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to remove member')
      }

      return res.json()
    },
    onMutate: () => {
      toastDefault('Removing member...')
    },
    onSuccess: () => {
      toastSuccess('Member removed successfully')
      queryClient.invalidateQueries({ queryKey: ['team', teamId] })
      router.refresh()
    },
    onError: (error: Error) => {
      toastError(`Failed to remove member: ${error.message}`)
    },
  })
}
