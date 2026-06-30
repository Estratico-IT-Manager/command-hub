import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { SubscriptionDetailClient } from '@/components/subscriptions/subscription-detail-client'

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const { id } = await params

  return <SubscriptionDetailClient subscriptionId={id} userId={session!.user.id} />
}
