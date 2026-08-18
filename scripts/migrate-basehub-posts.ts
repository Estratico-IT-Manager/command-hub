import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL! }),
});

const SITE_SLUG = "estratico-profile";
const TYPE_NAME = "posts";

async function fetchBasehubPosts(): Promise<any[]> {
  const token = process.env.BASEHUB_TOKEN;
  if (!token) {
    throw new Error("BASEHUB_TOKEN is required to migrate posts");
  }

  const query = `{ posts { items { _id _slug _title description author status createdAt updatedAt coverImage { url alt } content { json { content } } } } }`;

  const res = await fetch("https://api.basehub.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`BaseHub request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json?.data?.posts?.items ?? [];
}

function extractMarkdown(post: any): string {
  const nodes = post?.content?.json?.content ?? [];
  const textParts: string[] = [];
  for (const node of nodes) {
    if (node.type === "codeBlock" && node.attrs?.language === "markdown") {
      for (const child of node.content ?? []) {
        if (child.type === "text" && typeof child.text === "string") {
          textParts.push(child.text);
        }
      }
    }
  }
  return textParts.join("\n");
}

async function main() {
  const site = await prisma.site.findUnique({ where: { slug: SITE_SLUG } });
  if (!site) {
    throw new Error(`Site "${SITE_SLUG}" not found — run seed-estratico-content.ts first`);
  }

  const contentType = await prisma.contentType.findUnique({
    where: { siteId_name: { siteId: site.id, name: TYPE_NAME } },
  });
  if (!contentType) {
    throw new Error(`Content type "${TYPE_NAME}" not found on site "${SITE_SLUG}"`);
  }

  const posts = await fetchBasehubPosts();
  console.log(`fetched ${posts.length} posts from BaseHub`);

  let created = 0;
  let skipped = 0;

  for (const post of posts) {
    const slug = post._slug ?? "";
    const existing = await prisma.contentEntry.findUnique({
      where: { contentTypeId_slug: { contentTypeId: contentType.id, slug } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const content = extractMarkdown(post);
    if (!content.trim()) {
      console.log(`  SKIP ${slug}: empty content`);
      skipped++;
      continue;
    }

    await prisma.contentEntry.create({
      data: {
        siteId: site.id,
        contentTypeId: contentType.id,
        slug,
        title: post._title ?? slug,
        payload: {
          title: post._title ?? slug,
          slug,
          description: post.description ?? "",
          content,
          author: post.author ?? "",
          status: post.status === "published" ? "published" : "draft",
          cover_image: post.coverImage?.url ?? "",
          published_at: post.createdAt ?? null,
        },
        status: post.status === "published" ? "PUBLISHED" : "DRAFT",
        publishedAt: post.status === "published" ? new Date(post.createdAt ?? Date.now()) : null,
      },
    });
    created++;
    console.log(`  migrated: ${slug}`);
  }

  console.log(`done: ${created} migrated, ${skipped} skipped`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("migrate-basehub-posts FAILED:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });