'use client'

import { useQuery } from '@tanstack/react-query'

async function fetchSubscription(id: string) {
  const res = await fetch(`/api/subscriptions/${id}`)
  if (!res.ok) throw new Error('Failed to fetch subscription')
  return res.json()
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: ['subscription', id],
    queryFn: () => fetchSubscription(id),
    enabled: !!id,
  })
}
