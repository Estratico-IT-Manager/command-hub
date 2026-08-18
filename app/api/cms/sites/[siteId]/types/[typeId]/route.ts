import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId } = await params;
  const contentType = await prisma.contentType.findFirst({
    where: { id: typeId, siteId },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!contentType) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  return NextResponse.json({ contentType });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId } = await params;
  const existing = await prisma.contentType.findFirst({
    where: { id: typeId, siteId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: { label?: string; description?: string | null } = {};
  if (typeof body.label === "string" && body.label.trim()) {
    data.label = body.label.trim();
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }

  const contentType = await prisma.contentType.update({
    where: { id: typeId },
    data,
    include: { fields: { orderBy: { order: "asc" } } },
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_type",
      entityId: typeId,
      action: "update",
      oldValue: { label: existing.label, description: existing.description },
      newValue: data,
    },
  });

  return NextResponse.json({ contentType });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_DELETE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId } = await params;
  const existing = await prisma.contentType.findFirst({
    where: { id: typeId, siteId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  const entryCount = await prisma.contentEntry.count({ where: { contentTypeId: typeId } });
  if (entryCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete a content type with ${entryCount} entries` },
      { status: 409 },
    );
  }

  await prisma.contentType.delete({ where: { id: typeId } });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_type",
      entityId: typeId,
      action: "delete",
      oldValue: { siteId, name: existing.name, label: existing.label },
    },
  });

  return NextResponse.json({ ok: true });
}