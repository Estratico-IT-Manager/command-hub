'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useCreateSubscription } from '@/hooks/use-mutations/subscription-mutations'
import type { SubscriptionFrequency, Team } from '@/app/generated/prisma/client'

interface CreateSubscriptionDialogProps {
  teams: (Team & { role: string })[]
}

const subscriptionFrequency = {
  WEEKLY: 'WEEKLY',
  FORTNIGHTLY: 'FORTNIGHTLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  YEARLY: 'YEARLY',
} as const

export function CreateSubscriptionDialog({ teams }: CreateSubscriptionDialogProps) {
  const createSubscription = useCreateSubscription()
  const [open, setOpen] = useState(false)
  const [serviceName, setServiceName] = useState('')
  const [provider, setProvider] = useState('')
  const [cost, setCost] = useState('')
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('MONTHLY')
  const [teamId, setTeamId] = useState('')
  const [version, setVersion] = useState('')
  const [startDate, setStartDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  function resetForm() {
    setServiceName('')
    setProvider('')
    setCost('')
    setFrequency('MONTHLY')
    setTeamId('')
    setVersion('')
    setNotes('')
    setStartDate('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!serviceName.trim()) {
      setError('Subscription name is required')
      return
    }
    if (!startDate.trim()) {
      setError('The date when the subscription started is required')
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
    if (!teamId) {
      setError('Please select a team')
      return
    }

    createSubscription.mutate(
      {
        serviceName: serviceName.trim(),
        provider: provider.trim(),
        cost: Number(cost),
        frequency,
        teamId,
        startDate,
        notes: notes.trim(),
        version,
      },
      {
        onSuccess: () => {
          setOpen(false)
          resetForm()
        },
        onError: (err) => {
          setError(err.message)
        },
      }
    )
  }

  if (teams.length === 0) {
    return (
      <Button disabled>
        <Plus className="mr-2 size-4" />
        Add Subscription
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Add Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add subscription</DialogTitle>
          <DialogDescription>Track a new subscription for your team</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="py-4 max-h-[60vh] overflow-y-auto">
            <Field>
              <FieldLabel htmlFor="name">Service name</FieldLabel>
              <Input
                id="name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g., GitHub Enterprise"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="provider">Provider</FieldLabel>
              <Input
                id="provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g., GitHub"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="startDate">Start Date</FieldLabel>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="cost">Cost</FieldLabel>
                <Input
                  id="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="frequency">Frequency</FieldLabel>
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
              <FieldLabel htmlFor="team">Team</FieldLabel>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="notes">Notes (optional)</FieldLabel>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes"
                rows={2}
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createSubscription.isPending}>
              {createSubscription.isPending ? <Spinner className="mr-2" /> : null}
              Add subscription
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
