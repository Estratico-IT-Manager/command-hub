'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { toastSuccess, toastError } from '@/hooks/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { syncEngine } from '@/lib/sync-engine'
import type { subscription, SubscriptionFrequency } from '@/app/generated/prisma/client'

interface EditSubscriptionDialogProps {
  subscription: subscription
  open: boolean
  onOpenChange: (open: boolean) => void
}

const subscriptionFrequency = {
  WEEKLY: 'WEEKLY',
  FORTNIGHTLY: 'FORTNIGHTLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const

export function EditSubscriptionDialog({ subscription: sub, open, onOpenChange }: EditSubscriptionDialogProps) {
  const queryClient = useQueryClient()
  const [serviceName, setServiceName] = useState(sub.serviceName)
  const [provider, setProvider] = useState(sub.provider)
  const [cost, setCost] = useState(String(sub.cost))
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(sub.frequency)
  const [startDate, setStartDate] = useState(
    sub.startDate ? new Date(sub.startDate).toISOString().split('T')[0] : ''
  )
  const [notes, setNotes] = useState(sub.notes ?? '')
  const [error, setError] = useState('')
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsPending(true)

    try {
      if (!serviceName.trim()) {
        setError('Subscription name is required')
        return
      }
      if (!provider.trim()) {
        setError('Provider is required')
        return
      }
      if (!cost || isNaN(Number(cost)) || Number(cost) < 0) {
        setError('Please enter a valid cost')
        return
      }

      if (syncEngine) {
        await syncEngine.queueChange({
          tableName: 'subscription',
          recordId: sub.id,
          action: 'update',
          queryKey: ['subscriptions'],
          payload: {
            name: serviceName.trim(),
            provider: provider.trim(),
            cost: Number(cost),
            currency: sub.currency,
            billingCycle: frequency,
            isActive: sub.isActive,
            notes: notes.trim() || null,
          },
        })
      }

      toastSuccess('Subscription updated successfully')
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription', sub.id] })
      onOpenChange(false)
    } catch (err) {
      toastError(`Failed to update subscription: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setError(err instanceof Error ? err.message : 'Failed to update subscription')
    } finally {
      setIsPending(false)
    }
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      setServiceName(sub.serviceName)
      setProvider(sub.provider)
      setCost(String(sub.cost))
      setFrequency(sub.frequency)
      setStartDate(sub.startDate ? new Date(sub.startDate).toISOString().split('T')[0] : '')
      setNotes(sub.notes ?? '')
      setError('')
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit subscription</DialogTitle>
          <DialogDescription>Update subscription details</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="py-4 max-h-[60vh] overflow-y-auto">
            <Field>
              <FieldLabel htmlFor="edit-name">Service name</FieldLabel>
              <Input
                id="edit-name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g., GitHub Enterprise"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-provider">Provider</FieldLabel>
              <Input
                id="edit-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g., GitHub"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-startDate">Start Date</FieldLabel>
              <Input
                id="edit-startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="edit-cost">Cost</FieldLabel>
                <Input
                  id="edit-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="edit-frequency">Frequency</FieldLabel>
                <Select
                  name="frequency"
                  value={frequency}
                  onValueChange={(v: SubscriptionFrequency) => setFrequency(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="select payment frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(subscriptionFrequency).map((v) => (
                      <SelectItem className="capitalize" value={v} key={v}>
                        {v.toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="edit-notes">Notes (optional)</FieldLabel>
              <Textarea
                id="edit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes"
                rows={2}
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner className="mr-2" /> : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
