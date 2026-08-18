import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

export default async function CmsEntriesPage({
  params,
}: {
  params: Promise<{ siteId: string; typeId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_VIEW))) redirect("/dashboard");

  const { siteId, typeId } = await params;
  redirect(`/dashboard/cms/sites/${siteId}/types/${typeId}?view=content`);
}