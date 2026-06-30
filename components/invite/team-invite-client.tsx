'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle } from 'lucide-react'
import { useAcceptInvite } from '@/hooks/use-mutations/invite-mutations'

export function TeamInviteClient({ inviteId }: { inviteId: string }) {
  const acceptInvite = useAcceptInvite(inviteId)
  const [errorMsg, setErrorMsg] = useState('')

  const handleAccept = () => {
    setErrorMsg('')
    acceptInvite.mutate(undefined, {
      onError: (err) => {
        setErrorMsg(err.message)
      },
    })
  }

  if (acceptInvite.isError || errorMsg) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <AlertCircle className="h-4 w-4" />
          <p>{errorMsg || 'Failed to join team'}</p>
        </div>
        <Button onClick={handleAccept} variant="outline" className="w-full">
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <Button onClick={handleAccept} disabled={acceptInvite.isPending} className="w-full">
      {acceptInvite.isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Joining Team...
        </>
      ) : (
        'Accept Invitation'
      )}
    </Button>
  )
}
