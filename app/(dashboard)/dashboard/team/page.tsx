import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { TeamListClient } from '@/components/team/team-list-client'

export default async function TeamPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  return <TeamListClient userId={session!.user.id} />
}
