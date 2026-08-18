import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyApiKey } from "@/lib/cms";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteSlug: string; typeName: string; slug: string }> },
) {
  const { siteSlug, typeName, slug } = await params;
  const site = await prisma.site.findUnique({
    where: { slug: siteSlug },
    include: { contentTypes: true },
  });
  if (!site || !site.isActive) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const apiKey = request.headers.get("x-api-key") ?? "";
  if (!(await verifyApiKey(site, apiKey))) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const contentType = site.contentTypes.find((t) => t.name === typeName);
  if (!contentType) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const entry = await prisma.contentEntry.findFirst({
    where: {
      contentTypeId: contentType.id,
      slug,
      isDeleted: false,
      ...(status !== "DRAFT" ? { status: "PUBLISHED" } : {}),
    },
  });

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const response = NextResponse.json({
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    payload: entry.payload,
    publishedAt: entry.publishedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
  response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return response;
}