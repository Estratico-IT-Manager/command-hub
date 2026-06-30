import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { SubscriptionsListClient } from '@/components/subscriptions/subscriptions-list-client'

export default async function SubscriptionsPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  return <SubscriptionsListClient userId={session!.user.id} />
}
