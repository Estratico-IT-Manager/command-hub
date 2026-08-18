import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyApiKey } from "@/lib/cms";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteSlug: string }> },
) {
  const { siteSlug } = await params;
  const site = await prisma.site.findUnique({ where: { slug: siteSlug } });
  if (!site || !site.isActive) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const apiKey = request.headers.get("x-api-key") ?? "";
  if (!(await verifyApiKey(site, apiKey))) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const media = await prisma.mediaAsset.findMany({
    where: { siteId: site.id },
    orderBy: { createdAt: "desc" },
  });

  const response = NextResponse.json({
    media: media.map((m) => ({
      id: m.id,
      fileName: m.fileName,
      mimeType: m.mimeType,
      size: m.size,
      url: m.url,
      createdAt: m.createdAt,
    })),
  });
  response.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return response;
}