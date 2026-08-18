"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  CreditCard,
  Users,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import { useSignOut } from "@/hooks/use-mutations/auth-mutations";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { useSession } from "@/lib/auth-client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mainNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Projects",
    href: "/dashboard/projects",
    icon: KanbanSquare,
  },
  {
    title: "Subscriptions",
    href: "/dashboard/subscriptions",
    icon: CreditCard,
  },
  {
    title: "Team",
    href: "/dashboard/team",
    icon: Users,
  },
];

const bottomNavItems = [
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { isOnline, isSyncing, pendingChanges } = useSyncStatus();
  const signOut = useSignOut();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <span className="text-sm font-bold">
              {session?.user.name
                ? session.user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                : "E"}
            </span>
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground">
            {session?.user.name || "Estratico"}
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="overflow-x-hidden">
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.href === "/dashboard"
                        ? pathname === item.href
                        : pathname === item.href ||
                          pathname.startsWith(item.href + "/")
                    }
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNavItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="size-4 text-[var(--estratico-success)]" />
            ) : (
              <WifiOff className="size-4 text-destructive" />
            )}
            <span className="text-xs text-sidebar-foreground/70">
              {isOnline ? "Online" : "Offline"}
            </span>
            {isSyncing && (
              <RefreshCw className="size-3 animate-spin text-sidebar-foreground/70" />
            )}
          </div>
          {pendingChanges > 0 && (
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                isOnline
                  ? "bg-[var(--estratico-warning)]/20 text-[var(--estratico-warning)]"
                  : "bg-destructive/20 text-destructive",
              )}
            >
              {pendingChanges} pending
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => signOut.mutate()}
        >
          <LogOut className="mr-2 size-4" />
          Sign out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
