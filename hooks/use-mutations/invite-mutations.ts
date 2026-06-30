'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { toastDefault, toastSuccess, toastError } from '@/hooks/use-toast'

export function useAcceptInvite(inviteId: string) {
  const router = useRouter()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/teams/invite/${inviteId}`)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to join team')
      }

      return res.json()
    },
    onMutate: () => {
      toastDefault('Joining team...')
    },
    onSuccess: (data: any) => {
      toastSuccess('Successfully joined the team!')
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      if (data?.url) {
        router.push(data.url)
      } else {
        router.push('/dashboard/team')
      }
    },
    onError: (error: Error) => {
      toastError(`Failed to join team: ${error.message}`)
    },
  })
}
