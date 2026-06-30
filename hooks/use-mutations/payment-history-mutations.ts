'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toastDefault, toastSuccess, toastError } from '@/hooks/use-toast'
import { syncEngine } from '@/lib/sync-engine'
import { offlineDb, generateOfflineId } from '@/lib/offline-db'

export function useCreatePaymentHistory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      subscriptionId: string
      transactionId: string
      dayPaid: string
      cost: number // The subscription's current cost at time of payment
    }) => {
      const historyId = generateOfflineId()
      const now = new Date().toISOString()

      // Add to local database immediately for offline support
      await offlineDb.subscription_history.add({
        id: historyId,
        subscriptionId: data.subscriptionId,
        transactionId: data.transactionId,
        cost: data.cost,
        dayPaid: data.dayPaid,
        createdAt: now,
        synced: false,
        pendingSync: true,
      })

      // Queue change for sync engine
      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'subscription_history',
          recordId: historyId,
          action: 'create',
          queryKey: ['subscription', data.subscriptionId],
          payload: {
            subscriptionId: data.subscriptionId,
            transactionId: data.transactionId,
            cost: data.cost,
            dayPaid: data.dayPaid,
          },
        })
      }

      return { historyId }
    },
    onMutate: () => {
      toastDefault('Adding payment record...')
    },
    onSuccess: (_, variables) => {
      toastSuccess('Payment record added successfully')
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription', variables.subscriptionId] })
    },
    onError: (error: Error) => {
      toastError(`Failed to add payment: ${error.message}`)
    },
  })
}
