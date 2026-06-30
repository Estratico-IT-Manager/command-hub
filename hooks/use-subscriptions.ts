'use client'

import { useQuery } from '@tanstack/react-query'

async function fetchSubscriptions() {
  const res = await fetch('/api/subscriptions')
  if (!res.ok) throw new Error('Failed to fetch subscriptions')
  return res.json()
}

export function useSubscriptions() {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: fetchSubscriptions,
  })
}
