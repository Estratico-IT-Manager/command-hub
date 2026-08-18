import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { entrySlug, slugify } from "@/lib/cms";
import type { Prisma } from "@/app/generated/prisma/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string; entryId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId, entryId } = await params;
  const entry = await prisma.contentEntry.findFirst({
    where: { id: entryId, contentTypeId: typeId, siteId },
  });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string; entryId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId, entryId } = await params;
  const contentType = await prisma.contentType.findFirst({
    where: { id: typeId, siteId },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!contentType) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  const entry = await prisma.contentEntry.findFirst({
    where: { id: entryId, contentTypeId: typeId, siteId },
  });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: {
    payload?: Prisma.InputJsonValue;
    status?: "DRAFT" | "PUBLISHED";
    slug?: string;
    title?: string;
    publishedAt?: Date | null;
    version?: number;
  } = {};

  const hasPayload = body.payload !== undefined && body.payload !== null;

  if (hasPayload) {
    data.payload = body.payload as Prisma.InputJsonValue;
    data.version = (entry.version ?? 1) + 1;
  }

  if (body.status === "DRAFT" || body.status === "PUBLISHED") {
    const canPublish = await can(session.user.id, PERMISSIONS.CONTENT_PUBLISH);
    if (body.status === "PUBLISHED" && !canPublish) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    data.status = body.status;
    data.publishedAt = body.status === "PUBLISHED" ? new Date() : null;
  }

  if (typeof body.slug === "string" && body.slug.trim()) {
    data.slug = slugify(body.slug);
  }
  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }

  if (!hasPayload && !data.status && !data.slug && !data.title) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  if (data.slug && data.slug !== entry.slug) {
    const clash = await prisma.contentEntry.findFirst({
      where: { contentTypeId: typeId, slug: data.slug, id: { not: entryId } },
      select: { slug: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `Slug "${data.slug}" is already in use` },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.contentEntry.update({
    where: { id: entryId },
    data,
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_entry",
      entityId: entryId,
      action: "update",
      oldValue: {
        title: entry.title,
        slug: entry.slug,
        status: entry.status,
        version: entry.version,
      },
      newValue: {
        title: updated.title,
        slug: updated.slug,
        status: updated.status,
        version: updated.version,
      },
    },
  });

  return NextResponse.json({ entry: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string; entryId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_DELETE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId, entryId } = await params;
  const entry = await prisma.contentEntry.findFirst({
    where: { id: entryId, contentTypeId: typeId, siteId },
  });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await prisma.contentEntry.update({
    where: { id: entryId },
    data: { isDeleted: true },
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_entry",
      entityId: entryId,
      action: "delete",
      oldValue: { title: entry.title, slug: entry.slug, status: entry.status },
    },
  });

  return NextResponse.json({ ok: true });
}