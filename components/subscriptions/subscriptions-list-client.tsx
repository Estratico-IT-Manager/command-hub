'use client'

import { SubscriptionsList } from '@/components/subscriptions/subscriptions-list'
import { CreateSubscriptionDialog } from '@/components/subscriptions/create-subscription-dialog'
import { SubscriptionStats } from '@/components/subscriptions/subscription-stats'
import { Spinner } from '@/components/ui/spinner'
import { useSubscriptions } from '@/hooks/use-subscriptions'

interface SubscriptionsListClientProps {
  userId: string
}

export function SubscriptionsListClient({ userId }: SubscriptionsListClientProps) {
  const { data, isLoading, error } = useSubscriptions()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Failed to load subscriptions. Please try again.
      </div>
    )
  }

  const subscriptions = data?.subscriptions ?? []
  const teams = data?.teams ?? []
  const stats = data?.stats ?? { total: 0, monthly: 0, yearly: 0 }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground">Track and manage your team subscriptions</p>
        </div>
        <CreateSubscriptionDialog teams={teams} />
      </div>

      <SubscriptionStats stats={stats} />

      <SubscriptionsList subscriptions={subscriptions} />
    </div>
  )
}
