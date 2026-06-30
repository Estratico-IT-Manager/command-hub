import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { ProjectDetailClient } from '@/components/projects/project-detail-client'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  return <ProjectDetailClient projectId={id} userId={session!.user.id} />
}
