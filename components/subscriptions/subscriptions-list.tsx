'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CreditCard, Pencil, ExternalLink, HandCoins, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { addWeeks, addMonths, addYears, format } from 'date-fns'
import type { subscription, subscription_history, SubscriptionFrequency } from '@/app/generated/prisma/client'
import { EditSubscriptionDialog } from './edit-subscription-dialog'
import { DeleteSubscriptionDialog } from './delete-subscription-dialog'
import { AddPaymentHistoryDialog } from './add-payment-history-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toastSuccess, toastError, toastDefault } from '@/hooks/use-toast'
import { syncEngine } from '@/lib/sync-engine'
import { offlineDb } from '@/lib/offline-db'

interface SubscriptionWithHistory extends subscription {
  history: subscription_history[]
}

interface SubscriptionsListProps {
  subscriptions: (SubscriptionWithHistory & { team_name: string; pendingSync?: boolean })[]
}

const statusColors = {
  active: 'bg-[var(--estratico-success)]/10 text-[var(--estratico-success)] border-[var(--estratico-success)]/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  paused: 'bg-[var(--estratico-warning)]/10 text-[var(--estratico-warning)] border-[var(--estratico-warning)]/20',
}

const cycleLabels: Record<SubscriptionFrequency, string> = {
  MONTHLY: '/mo',
  QUARTERLY: '/qtr',
  YEARLY: '/yr',
  FORTNIGHTLY: '/2weeks',
  WEEKLY: '/week',
}

function getNextBillingDate(sub: SubscriptionWithHistory): string {
  if (!sub.history || sub.history.length === 0) return 'N/A'

  const sorted = [...sub.history].sort(
    (a, b) => new Date(b.dayPaid).getTime() - new Date(a.dayPaid).getTime()
  )
  const latestPaid = new Date(sorted[0].dayPaid)

  let nextDate: Date
  switch (sub.frequency) {
    case 'WEEKLY':
      nextDate = addWeeks(latestPaid, 1)
      break
    case 'FORTNIGHTLY':
      nextDate = addWeeks(latestPaid, 2)
      break
    case 'QUARTERLY':
      nextDate = addMonths(latestPaid, 3)
      break
    case 'YEARLY':
      nextDate = addYears(latestPaid, 1)
      break
    case 'MONTHLY':
    default:
      nextDate = addMonths(latestPaid, 1)
      break
  }

  return format(nextDate, 'MMM d, yyyy')
}

export function SubscriptionsList({ subscriptions }: SubscriptionsListProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [editSub, setEditSub] = useState<SubscriptionWithHistory | null>(null)
  const [deleteSub, setDeleteSub] = useState<SubscriptionWithHistory | null>(null)
  const [paymentSub, setPaymentSub] = useState<SubscriptionWithHistory | null>(null)

  const deleteMutation = useMutation({
    mutationFn: async (sub: SubscriptionWithHistory) => {
      toastDefault('Deleting subscription...')

      // Remove from local database immediately
      await offlineDb.subscriptions.delete(sub.id)

      // Queue change for sync engine
      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'subscription',
          recordId: sub.id,
          action: 'delete',
          queryKey: ['subscriptions'],
          payload: { id: sub.id },
        })
      }

      return { id: sub.id }
    },
    onSuccess: () => {
      toastSuccess('Subscription deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      setDeleteSub(null)
    },
    onError: (error: Error) => {
      toastError(`Failed to delete: ${error.message}`)
    },
  })

  if (subscriptions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CreditCard />
          </EmptyMedia>
          <EmptyTitle>No subscriptions yet</EmptyTitle>
        </EmptyHeader>
        <EmptyDescription>
          Add your first subscription to start tracking costs
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Subscriptions</CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[140px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sub.serviceName}</p>
                      <p className="text-sm text-muted-foreground">{sub.provider}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.team_name}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      ${Number(sub.cost).toFixed(2)}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {cycleLabels[sub.frequency]}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getNextBillingDate(sub)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn(statusColors[sub.isActive ? 'active' : 'paused'])}
                      >
                        {sub.isActive ? 'Active' : 'Paused'}
                      </Badge>
                      {sub.pendingSync && (
                        <Badge
                          variant="secondary"
                          className="bg-[var(--estratico-warning)]/10 text-[var(--estratico-warning)] border-[var(--estratico-warning)]/20"
                        >
                          Pending Sync
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setEditSub(sub)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => router.push(`/dashboard/subscriptions/${sub.id}`)}
                          >
                            <ExternalLink className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setPaymentSub(sub)}
                          >
                            <HandCoins className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Add Payment</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteSub(sub)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>

      {editSub && (
        <EditSubscriptionDialog
          subscription={editSub}
          open={!!editSub}
          onOpenChange={(open) => !open && setEditSub(null)}
        />
      )}

      {deleteSub && (
        <DeleteSubscriptionDialog
          open={!!deleteSub}
          onOpenChange={(open) => !open && setDeleteSub(null)}
          onConfirm={() => deleteMutation.mutate(deleteSub)}
          entityName={deleteSub.serviceName}
          entityType="subscription"
          isPending={deleteMutation.isPending}
        />
      )}

      {paymentSub && (
        <AddPaymentHistoryDialog
          subscriptionId={paymentSub.id}
          subscriptionCost={paymentSub.cost}
          subscriptionFrequency={paymentSub.frequency}
          subscriptionName={paymentSub.serviceName}
          open={!!paymentSub}
          onOpenChange={(open) => !open && setPaymentSub(null)}
        />
      )}
    </Card>
  )
}
