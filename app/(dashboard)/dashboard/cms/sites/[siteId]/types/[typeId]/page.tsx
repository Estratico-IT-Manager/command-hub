import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TypeViewTabs } from "@/components/cms/type-view-tabs";
import { EntriesListClient } from "@/components/cms/entries-list-client";
import { TypeDetailClient } from "@/components/cms/type-detail-client";

export default async function CmsTypeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; typeId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_VIEW))) redirect("/dashboard");

  const { siteId, typeId } = await params;
  const { view: viewParam } = await searchParams;
  const view = viewParam === "schema" ? "schema" : "content";

  const type = await prisma.contentType.findUnique({ where: { id: typeId } });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/cms/sites/${siteId}`} aria-label="Back to site">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-xl font-semibold">{type?.label ?? "Content type"}</h2>
            {type && (
              <p className="text-sm text-muted-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{type.name}</code>
              </p>
            )}
          </div>
        </div>
        <TypeViewTabs siteId={siteId} typeId={typeId} active={view} />
      </div>

      {view === "schema" ? <TypeDetailClient /> : <EntriesListClient />}
    </div>
  );
}