import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { SyncInitializer } from '@/components/sync-initializer'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ThemeToggle } from '@/components/theme-toggle'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session) {
    redirect('/login')
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 items-center gap-4 border-b px-4 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <div className='grow'/>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto min-w-0 p-4 lg:p-6">
          {children}
        </main>
      </SidebarInset>
      <SyncInitializer />
    </SidebarProvider>
  )
}
