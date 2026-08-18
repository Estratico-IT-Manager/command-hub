import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { entrySlug, slugify } from "@/lib/cms";

async function resolveType(siteId: string, typeId: string) {
  return prisma.contentType.findFirst({
    where: { id: typeId, siteId },
    include: { fields: { orderBy: { order: "asc" } } },
  });
}

async function ensureUniqueSlug(
  contentTypeId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const candidate = slugify(base);
  const existing = await prisma.contentEntry.findFirst({
    where: {
      contentTypeId,
      slug: candidate,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { slug: true },
  });
  if (!existing) return candidate;

  let n = 2;
  while (true) {
    const next = `${candidate}-${n}`;
    const clash = await prisma.contentEntry.findFirst({
      where: {
        contentTypeId,
        slug: next,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { slug: true },
    });
    if (!clash) return next;
    n++;
  }
}

export async function GET(
  request: Request,
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
  const contentType = await resolveType(siteId, typeId);
  if (!contentType) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search")?.trim();

  const entries = await prisma.contentEntry.findMany({
    where: {
      contentTypeId: typeId,
      isDeleted: false,
      ...(status === "DRAFT" || status === "PUBLISHED" ? { status } : {}),
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { slug: { contains: search, mode: "insensitive" } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ entries });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_CREATE))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId } = await params;
  const contentType = await resolveType(siteId, typeId);
  if (!contentType) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const payload = body?.payload && typeof body.payload === "object" ? body.payload : {};
  const status = body?.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  const titleField = contentType.fields.find((f) => f.isTitle);
  const title = titleField && typeof payload[titleField.name] === "string"
    ? payload[titleField.name].trim()
    : "";

  const rawSlug = entrySlug(payload, contentType);
  const slug = await ensureUniqueSlug(typeId, rawSlug ?? (title || "untitled"));

  const entry = await prisma.contentEntry.create({
    data: {
      siteId,
      contentTypeId: typeId,
      slug,
      title: title || slug,
      payload,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
    },
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_entry",
      entityId: entry.id,
      action: "create",
      newValue: { contentTypeId: typeId, slug, title: entry.title, status },
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}