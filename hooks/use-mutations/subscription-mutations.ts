'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toastDefault, toastSuccess, toastError } from '@/hooks/use-toast'
import { offlineDb, generateOfflineId } from '@/lib/offline-db'
import { syncEngine } from '@/lib/sync-engine'

export function useCreateSubscription() {
  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async (data: {
      serviceName: string
      provider: string
      cost: number
      frequency: string
      teamId: string
      startDate: string
      notes: string
      version: string
    }) => {
      const subscriptionId = generateOfflineId()
      const now = new Date().toISOString()

      await offlineDb.subscriptions.add({
        id: subscriptionId,
        teamId: data.teamId,
        startDate: data.startDate,
        notes: data.notes || '',
        serviceName: data.serviceName,
        provider: data.provider,
        cost: data.cost,
        currency: 'USD',
        frequency: data.frequency as any,
        isActive: true,
        version: parseInt(data.version) || 1,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        synced: false,
        pendingSync: true,
      })

      // Optimistic update: add subscription to query cache with pendingSync
      queryClient.setQueryData(['subscriptions'], (old: any) => {
        if (!old) return old
        const newSubscription = {
          id: subscriptionId,
          teamId: data.teamId,
          serviceName: data.serviceName,
          provider: data.provider,
          cost: data.cost,
          currency: 'USD',
          frequency: data.frequency,
          startDate: data.startDate,
          notes: data.notes || '',
          isActive: true,
          version: parseInt(data.version) || 1,
          isDeleted: false,
          createdAt: now,
          updatedAt: now,
          synced: false,
          pendingSync: true,
          team_name: old.teams?.find((t: any) => t.id === data.teamId)?.name ?? '',
          status: 'active',
        }
        return {
          ...old,
          subscriptions: [newSubscription, ...(old.subscriptions ?? [])]
        }
      })

      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'subscription',
          recordId: subscriptionId,
          action: 'create',
          queryKey: ['subscriptions'],
          payload: {
            teamId: data.teamId,
            name: data.serviceName,
            provider: data.provider,
            cost: data.cost,
            currency: 'USD',
            frequency: data.frequency,
            isActive: true,
            version: data.version ? parseInt(data.version) : '',
            notes: data.notes || null,
          },
        })
      }

      return { subscriptionId }
    },
    onMutate: () => {
      toastDefault('Adding subscription...')
    },
    onSuccess: () => {
      toastSuccess('Subscription added successfully')
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      router.refresh()
    },
    onError: (error: Error) => {
      toastError(`Failed to add subscription: ${error.message}`)
    },
  })
}
