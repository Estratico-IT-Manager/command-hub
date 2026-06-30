import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { DashboardClient } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  return <DashboardClient userId={session!.user.id} userName={session?.user.name || 'User'} />
}
