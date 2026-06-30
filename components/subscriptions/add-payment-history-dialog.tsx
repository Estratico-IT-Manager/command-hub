'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { useCreatePaymentHistory } from '@/hooks/use-mutations/payment-history-mutations'
import type { SubscriptionFrequency } from '@/app/generated/prisma/client'

interface AddPaymentHistoryDialogProps {
  subscriptionId: string
  subscriptionCost: number
  subscriptionFrequency: SubscriptionFrequency
  subscriptionName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const frequencyLabels: Record<SubscriptionFrequency, string> = {
  WEEKLY: 'Weekly',
  FORTNIGHTLY: 'Fortnightly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
}

export function AddPaymentHistoryDialog({
  subscriptionId,
  subscriptionCost,
  subscriptionFrequency,
  subscriptionName,
  open,
  onOpenChange,
}: AddPaymentHistoryDialogProps) {
  const createPaymentHistory = useCreatePaymentHistory()
  const [transactionId, setTransactionId] = useState('')
  const [dayPaid, setDayPaid] = useState('')
  const [error, setError] = useState('')

  function resetForm() {
    setTransactionId('')
    setDayPaid('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!transactionId.trim()) {
      setError('Transaction ID is required')
      return
    }
    if (!dayPaid) {
      setError('Day of payment is required')
      return
    }

    createPaymentHistory.mutate(
      {
        subscriptionId,
        transactionId: transactionId.trim(),
        dayPaid,
        cost: subscriptionCost, // Pass the subscription's current cost
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          resetForm()
        },
        onError: (err) => {
          setError(err.message)
        },
      }
    )
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) resetForm()
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payment Record</DialogTitle>
          <DialogDescription>
            Record a payment for <strong>{subscriptionName}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="py-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="text-muted-foreground">
                Payment Amount: <strong className="text-foreground">${subscriptionCost.toFixed(2)}</strong>
              </p>
              <p className="text-muted-foreground">
                Billing Cycle: <strong className="text-foreground">{frequencyLabels[subscriptionFrequency]}</strong>
              </p>
            </div>

            <Field>
              <FieldLabel htmlFor="transactionId">Transaction ID</FieldLabel>
              <Input
                id="transactionId"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g., INV-2024-001"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="dayPaid">Day of Payment</FieldLabel>
              <Input
                id="dayPaid"
                type="date"
                value={dayPaid}
                onChange={(e) => setDayPaid(e.target.value)}
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createPaymentHistory.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPaymentHistory.isPending}>
              {createPaymentHistory.isPending ? <Spinner className="mr-2" /> : null}
              Add Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
