import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { TeamDetailClient } from '@/components/team/team-detail-client'

interface TeamPageProps {
  params: Promise<{ id: string }>
}

export default async function TeamDetailPage({ params }: TeamPageProps) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  return <TeamDetailClient teamId={id} userId={session!.user.id} />
}
