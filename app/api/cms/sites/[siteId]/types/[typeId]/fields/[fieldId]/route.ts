import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { Prisma } from "@/app/generated/prisma/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string; fieldId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId, fieldId } = await params;
  const field = await prisma.contentTypeField.findFirst({
    where: { id: fieldId, contentTypeId: typeId, contentType: { siteId } },
  });
  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const data: Partial<Prisma.ContentTypeFieldUncheckedUpdateInput> = {};

  if (typeof body.label === "string" && body.label.trim()) {
    data.label = body.label.trim();
  }
  if (typeof body.required === "boolean") data.required = body.required;
  if (body.options !== undefined) data.options = body.options as Prisma.InputJsonValue;
  if (body.relationTypeId !== undefined) data.relationTypeId = body.relationTypeId || null;
  if (typeof body.order === "number") data.order = body.order;
  if (typeof body.isSlugSource === "boolean") data.isSlugSource = body.isSlugSource;

  if (typeof body.isTitle === "boolean") {
    if (body.isTitle) {
      await prisma.contentTypeField.updateMany({
        where: { contentTypeId: typeId, isTitle: true, id: { not: fieldId } },
        data: { isTitle: false },
      });
    }
    data.isTitle = body.isTitle;
  }

  const updated = await prisma.contentTypeField.update({
    where: { id: fieldId },
    data,
  });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_type_field",
      entityId: fieldId,
      action: "update",
      oldValue: {
        label: field.label,
        required: field.required,
        isTitle: field.isTitle,
        isSlugSource: field.isSlugSource,
      },
      newValue: data as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ field: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ siteId: string; typeId: string; fieldId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await can(session.user.id, PERMISSIONS.CONTENT_EDIT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { siteId, typeId, fieldId } = await params;
  const field = await prisma.contentTypeField.findFirst({
    where: { id: fieldId, contentTypeId: typeId, contentType: { siteId } },
  });
  if (!field) {
    return NextResponse.json({ error: "Field not found" }, { status: 404 });
  }

  if (field.isTitle) {
    return NextResponse.json({ error: "Cannot delete the title field" }, { status: 409 });
  }

  await prisma.contentTypeField.delete({ where: { id: fieldId } });

  await prisma.audit_log.create({
    data: {
      userId: session.user.id,
      entityType: "content_type_field",
      entityId: fieldId,
      action: "delete",
      oldValue: { contentTypeId: typeId, name: field.name, label: field.label },
    },
  });

  return NextResponse.json({ ok: true });
}