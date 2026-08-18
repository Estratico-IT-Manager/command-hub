import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { slugify } from "@/lib/cms";
import type { ContentFieldType } from "@/app/generated/prisma/client";

const FIELD_TYPES: ContentFieldType[] = [
  "TEXT",
  "TEXTAREA",
  "MARKDOWN",
  "IMAGE",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "MULTISELECT",
  "DATE",
  "DATETIME",
  "RELATION",
  "REPEATER",
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_VIEW))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const contentTypes = await prisma.contentType.findMany({
    where: { siteId },
    include: {
      fields: { orderBy: { order: "asc" } },
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ contentTypes });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_CREATE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : null;
  if (!label) {
    return NextResponse.json({ error: "Label is required" }, { status: 400 });
  }

  const name = typeof body?.name === "string" && body.name.trim()
    ? slugify(body.name)
    : slugify(label);

  const existing = await prisma.contentType.findUnique({
    where: { siteId_name: { siteId, name } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `A content type named "${name}" already exists` },
      { status: 409 },
    );
  }

  const contentType = await prisma.contentType.create({
    data: {
      siteId,
      name,
      label,
      description,
      fields: {
        create: {
          name: "title",
          label: "Title",
          type: "TEXT",
          required: true,
          isTitle: true,
          order: 0,
        },
      },
    },
    include: { fields: { orderBy: { order: "asc" } } },
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_type",
      entityId: contentType.id,
      action: "create",
      newValue: { siteId, name, label },
    },
  });

  return NextResponse.json({ contentType }, { status: 201 });
}

export { FIELD_TYPES };