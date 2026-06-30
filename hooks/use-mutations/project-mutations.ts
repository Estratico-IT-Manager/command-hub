'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toastDefault, toastSuccess, toastError } from '@/hooks/use-toast'
import { offlineDb, generateOfflineId } from '@/lib/offline-db'
import { syncEngine } from '@/lib/sync-engine'

export function useCreateProject() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: {
      name: string
      description: string
      teamId: string
    }) => {
      const projectId = generateOfflineId()
      const now = new Date().toISOString()

      await offlineDb.projects.add({
        id: projectId,
        teamId: data.teamId,
        name: data.name,
        description: data.description || '',
        status: 'IN_PROGRESS',
        createdBy: '',
        createdAt: now,
        updatedAt: now,
        synced: false,
        pendingSync: true,
        version: 1,
        isDeleted: false,
      })

      // Optimistic update: add project to query cache with pendingSync
      queryClient.setQueryData(['projects'], (old: any) => {
        if (!old) return old
        return {
          ...old,
          projects: [
            {
              id: projectId,
              teamId: data.teamId,
              name: data.name,
              description: data.description || '',
              status: 'IN_PROGRESS',
              createdBy: '',
              createdAt: now,
              updatedAt: now,
              synced: false,
              pendingSync: true,
              version: 1,
              isDeleted: false,
              team_name: old.teams?.find((t: any) => t.id === data.teamId)?.name ?? '',
            },
            ...(old.projects ?? [])
          ]
        }
      })

      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'project',
          recordId: projectId,
          action: 'create',
          queryKey: ['projects'],
          payload: {
            teamId: data.teamId,
            name: data.name,
            description: data.description || null,
            status: 'IN_PROGRESS',
          },
        })
      }

      return { projectId }
    },
    onMutate: () => {
      toastDefault('Creating project...')
    },
    onSuccess: () => {
      toastSuccess('Project created successfully')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      router.refresh()
    },
    onError: (error: Error) => {
      toastError(`Failed to create project: ${error.message}`)
    },
  })
}
