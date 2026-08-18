import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyApiKey } from "@/lib/cms";

export const dynamic = "force-dynamic";

async function authorize(siteSlug: string, request: Request) {
  const site = await prisma.site.findUnique({
    where: { slug: siteSlug },
    include: { contentTypes: true },
  });
  if (!site || !site.isActive) {
    return { error: NextResponse.json({ error: "Site not found" }, { status: 404 }) };
  }

  const apiKey = request.headers.get("x-api-key") ?? "";
  if (!(await verifyApiKey(site, apiKey))) {
    return { error: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };
  }

  return { site };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteSlug: string; typeName: string }> },
) {
  const { siteSlug, typeName } = await params;
  const { site, error } = await authorize(siteSlug, request);
  if (error) return error;

  const contentType = site!.contentTypes.find((t) => t.name === typeName);
  if (!contentType) {
    return NextResponse.json({ error: "Content type not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const onlyPublished = status !== "DRAFT";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10) || 50));
  const sortBy = searchParams.get("sort") === "createdAt" ? "createdAt" : "updatedAt";
  const sortDir = searchParams.get("order") === "asc" ? "asc" : "desc";
  const slugFilter = searchParams.get("slug")?.trim();

  const where = {
    contentTypeId: contentType.id,
    isDeleted: false,
    ...(onlyPublished ? { status: "PUBLISHED" as const } : {}),
    ...(slugFilter ? { slug: slugFilter } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.contentEntry.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.contentEntry.count({ where }),
  ]);

  const response = NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      slug: e.slug,
      title: e.title,
      payload: e.payload,
      publishedAt: e.publishedAt,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  });
  response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return response;
}