import { NextResponse } from "next/server";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { uploadToDrive } from "@/lib/google-drive";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "application/pdf"];

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
  const media = await prisma.mediaAsset.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ media });
}

export async function POST(
  request: Request,
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
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
  if (!allowed) {
    return NextResponse.json(
      { error: `File type "${mimeType}" is not allowed` },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File exceeds the 10 MB limit (${Math.round(file.size / 1024 / 1024)} MB)` },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const uploaded = await uploadToDrive({
      fileName: file.name,
      mimeType,
      body: buffer,
    });

    const media = await prisma.mediaAsset.create({
      data: {
        siteId,
        fileName: file.name,
        mimeType,
        size: uploaded.size,
        driveFileId: uploaded.fileId,
        url: uploaded.url,
        uploadedById: session.user.id,
      },
    });

    await prisma.audit_log.create({
      data: {
        userId: session.user.id,
        entityType: "media_asset",
        entityId: media.id,
        action: "create",
        newValue: { siteId, fileName: file.name, mimeType },
      },
    });

    return NextResponse.json({ media }, { status: 201 });
  } catch (error) {
    console.error("Drive upload error:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}