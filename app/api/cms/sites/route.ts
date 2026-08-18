import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { slugify } from "@/lib/cms";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sites = await prisma.site.findMany({
    include: { _count: { select: { contentTypes: true, entries: true, media: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    sites: sites.map((s) => ({ ...s, hasApiKey: Boolean(s.apiKeyHash) })),
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_CREATE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;

  if (!name) {
    return NextResponse.json({ error: "Site name is required" }, { status: 400 });
  }

  const slug = slugify(name);
  const existing = await prisma.site.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: `A site with slug "${slug}" already exists` },
      { status: 409 },
    );
  }

  const site = await prisma.site.create({
    data: { name, slug, description },
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "site",
      entityId: site.id,
      action: "create",
      newValue: { name: site.name, slug: site.slug },
    },
  });

  return NextResponse.json({ site }, { status: 201 });
}