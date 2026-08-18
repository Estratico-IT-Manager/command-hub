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

const REPEATER_SUB_TYPES: ContentFieldType[] = [
  "TEXT",
  "TEXTAREA",
  "MARKDOWN",
  "IMAGE",
  "NUMBER",
  "BOOLEAN",
  "SELECT",
  "DATE",
];

export async function POST(
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
  const contentType = await prisma.contentType.findFirst({
    where: { id: typeId, siteId },
    include: { fields: true },
  });
  if (!contentType) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label.trim() : "";
  const type = typeof body.type === "string" ? body.type : "";
  if (!label) {
    return NextResponse.json({ error: "Field label is required" }, { status: 400 });
  }
  if (!FIELD_TYPES.includes(type as ContentFieldType)) {
    return NextResponse.json({ error: `Invalid field type: ${type}` }, { status: 400 });
  }

  const name = typeof body.name === "string" && body.name.trim()
    ? slugify(body.name)
    : slugify(label);

  const existing = contentType.fields.find((f) => f.name === name);
  if (existing) {
    return NextResponse.json(
      { error: `A field named "${name}" already exists` },
      { status: 409 },
    );
  }

  if (name === "title" && body.isTitle) {
    return NextResponse.json({ error: `"title" is already the title field` }, { status: 409 });
  }

  const isTitle = Boolean(body.isTitle);
  if (isTitle) {
    await prisma.contentTypeField.updateMany({
      where: { contentTypeId: typeId, isTitle: true },
      data: { isTitle: false },
    });
  }

  const isSlugSource = Boolean(body.isSlugSource);

  const options = body.options ?? undefined;
  const relationTypeId = typeof body.relationTypeId === "string" ? body.relationTypeId : null;
  if (type === "RELATION") {
    if (!relationTypeId) {
      return NextResponse.json(
        { error: "Relation fields require a target content type" },
        { status: 400 },
      );
    }
    const target = await prisma.contentType.findFirst({
      where: { id: relationTypeId, siteId },
    });
    if (!target) {
      return NextResponse.json({ error: "Target content type not found" }, { status: 400 });
    }
  }
  if ((type === "SELECT" || type === "MULTISELECT") && !Array.isArray(options?.options)) {
    return NextResponse.json(
      { error: "Select fields require an options array" },
      { status: 400 },
    );
  }
  if (type === "REPEATER" && !Array.isArray(options?.fields)) {
    return NextResponse.json(
      { error: "Repeater fields require a block field schema" },
      { status: 400 },
    );
  }
  if (type === "REPEATER" && Array.isArray(options?.fields)) {
    for (const sub of options.fields) {
      if (!sub?.name || !sub?.label || !REPEATER_SUB_TYPES.includes(sub.type)) {
        return NextResponse.json(
          { error: "Repeater block fields must have name, label, and a valid type" },
          { status: 400 },
        );
      }
    }
  }

  const maxOrder = contentType.fields.reduce((max, f) => Math.max(max, f.order), -1);

  const field = await prisma.contentTypeField.create({
    data: {
      contentTypeId: typeId,
      name,
      label,
      type: type as ContentFieldType,
      required: Boolean(body.required),
      options: options ?? undefined,
      relationTypeId,
      isTitle,
      isSlugSource,
      order: maxOrder + 1,
    },
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_type_field",
      entityId: field.id,
      action: "create",
      newValue: { contentTypeId: typeId, name, label, type },
    },
  });

  return NextResponse.json({ field }, { status: 201 });
}