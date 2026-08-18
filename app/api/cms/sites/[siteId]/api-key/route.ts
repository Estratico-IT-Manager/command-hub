import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { generateApiKey, hashApiKey } from "@/lib/cms";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await params;
  const existing = await prisma.site.findUnique({ where: { id: siteId } });
  if (!existing) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const plaintext = generateApiKey();
  const apiKeyHash = hashApiKey(plaintext);

  await prisma.site.update({
    where: { id: siteId },
    data: { apiKeyHash },
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "site",
      entityId: siteId,
      action: "regenerate-api-key",
    },
  });

  return NextResponse.json({ apiKey: plaintext });
}