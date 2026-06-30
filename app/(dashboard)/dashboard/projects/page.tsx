import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { ProjectsListClient } from '@/components/projects/projects-list-client'

export default async function ProjectsPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  return <ProjectsListClient userId={session!.user.id} />
}
