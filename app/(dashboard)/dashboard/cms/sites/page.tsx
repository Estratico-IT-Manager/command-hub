import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { SitesListClient } from "@/components/cms/sites-list-client";

export default async function CmsSitesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_VIEW))) redirect("/dashboard");

  return <SitesListClient />;
}