'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSubscription } from '@/hooks/use-subscription'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, Pencil, HandCoins, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { SubscriptionFrequency } from '@/app/generated/prisma/client'
import { EditSubscriptionDialog } from './edit-subscription-dialog'
import { DeleteSubscriptionDialog } from './delete-subscription-dialog'
import { AddPaymentHistoryDialog } from './add-payment-history-dialog'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toastSuccess, toastError, toastDefault } from '@/hooks/use-toast'
import { syncEngine } from '@/lib/sync-engine'
import { offlineDb } from '@/lib/offline-db'

interface SubscriptionDetailClientProps {
  subscriptionId: string
  userId: string
}

interface SubscriptionData {
  id: string
  teamId: string
  serviceName: string
  provider: string
  cost: number
  frequency: SubscriptionFrequency
  currency: string
  notes: string
  isActive: boolean
  version: number
  isDeleted: boolean
  startDate: string | Date
  lastPaymentDate: string | Date | null
  createdAt: string | Date
  updatedAt: string | Date
  team?: { id: string; name: string }
  history: Array<{
    id: string
    transactionId: string
    cost: number
    dayPaid: string | Date
  }>
}

const frequencyLabels: Record<SubscriptionFrequency, string> = {
  WEEKLY: 'Weekly',
  FORTNIGHTLY: 'Fortnightly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

const statusColors = {
  active: 'bg-[var(--estratico-success)]/10 text-[var(--estratico-success)] border-[var(--estratico-success)]/20',
  paused: 'bg-[var(--estratico-warning)]/10 text-[var(--estratico-warning)] border-[var(--estratico-warning)]/20',
}

export function SubscriptionDetailClient({ subscriptionId, userId }: SubscriptionDetailClientProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: subscription, isLoading, error } = useSubscription(subscriptionId) as {
    data: SubscriptionData | undefined
    isLoading: boolean
    error: Error | null
  }

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: async (sub: SubscriptionData) => {
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
      router.push('/dashboard/subscriptions')
    },
    onError: (error: Error) => {
      toastError(`Failed to delete: ${error.message}`)
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="size-8" />
      </div>
    )
  }

  if (error || !subscription) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Failed to load subscription. Please try again.
      </div>
    )
  }

  const history: SubscriptionData['history'] = subscription.history ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/subscriptions')}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {subscription.serviceName}
            </h1>
            <p className="text-muted-foreground">{subscription.provider}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPaymentOpen(true)}>
            <HandCoins className="mr-2 size-4" />
            Add Payment
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-medium">
                ${Number(subscription.cost).toFixed(2)}
                <span className="text-muted-foreground text-sm ml-1">
                  {frequencyLabels[subscription.frequency]}
                </span>
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Team</span>
              <span className="font-medium">{subscription.team?.name ?? '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span className="font-medium">
                {subscription.startDate
                  ? format(new Date(subscription.startDate), 'MMM d, yyyy')
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Currency</span>
              <span className="font-medium">{subscription.currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant="outline"
                className={cn(statusColors[subscription.isActive ? 'active' : 'paused'])}
              >
                {subscription.isActive ? 'Active' : 'Paused'}
              </Badge>
            </div>
            {subscription.notes && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground text-sm">Notes</span>
                <p className="text-sm mt-1">{subscription.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No payment records yet
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Day Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.transactionId}
                      </TableCell>
                      <TableCell>${Number(record.cost).toFixed(2)}</TableCell>
                      <TableCell>
                        {format(new Date(record.dayPaid), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <EditSubscriptionDialog
        subscription={{
          ...subscription,
          startDate: new Date(subscription.startDate),
          lastPaymentDate: subscription.lastPaymentDate
            ? new Date(subscription.lastPaymentDate)
            : null,
          createdAt: new Date(subscription.createdAt),
          updatedAt: new Date(subscription.updatedAt),
        }}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <DeleteSubscriptionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => deleteMutation.mutate(subscription)}
        entityName={subscription.serviceName}
        entityType="subscription"
        isPending={deleteMutation.isPending}
      />

      <AddPaymentHistoryDialog
        subscriptionId={subscription.id}
        subscriptionCost={subscription.cost}
        subscriptionFrequency={subscription.frequency}
        subscriptionName={subscription.serviceName}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />
    </div>
  )
}
