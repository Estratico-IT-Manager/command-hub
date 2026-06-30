'use client'

import { useQuery } from '@tanstack/react-query'

async function fetchDashboardStats() {
  const res = await fetch('/api/dashboard')
  if (!res.ok) throw new Error('Failed to fetch dashboard stats')
  return res.json()
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardStats,
  })
}
