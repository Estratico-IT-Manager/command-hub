import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";

async function guard(permission: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!(await can(session.user.id, permission))) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { session, error } = await guard(PERMISSIONS.CONTENT_VIEW);
  if (error) return error;

  const { siteId } = await params;
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      contentTypes: {
        include: { _count: { select: { entries: true } } },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { entries: true, media: true } },
    },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  void session;
  return NextResponse.json({ site });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { session, error } = await guard(PERMISSIONS.CONTENT_EDIT);
  if (error) return error;

  const { siteId } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const existing = await prisma.site.findUnique({ where: { id: siteId } });
  if (!existing) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const data: { name?: string; description?: string | null; isActive?: boolean } = {};
  if (typeof body.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (typeof body.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  const site = await prisma.site.update({
    where: { id: siteId },
    data,
  });

  await prisma.audit_log.create({
    data: {
      userId: session!.user.id,
      entityType: "site",
      entityId: site.id,
      action: "update",
      oldValue: { name: existing.name, description: existing.description, isActive: existing.isActive },
      newValue: data,
    },
  });

  return NextResponse.json({ site });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const { session, error } = await guard(PERMISSIONS.CONTENT_DELETE);
  if (error) return error;

  const { siteId } = await params;
  const existing = await prisma.site.findUnique({ where: { id: siteId } });
  if (!existing) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  await prisma.site.delete({ where: { id: siteId } });

  await prisma.audit_log.create({
    data: {
      userId: session!.user.id,
      entityType: "site",
      entityId: siteId,
      action: "delete",
      oldValue: { name: existing.name, slug: existing.slug },
    },
  });

  return NextResponse.json({ ok: true });
}