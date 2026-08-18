import { createHash, randomBytes, timingSafeEqual } from "crypto";
import type { Site } from "@/app/generated/prisma/client";

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "untitled";
}

export function generateApiKey(): string {
  return `est_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

export async function verifyApiKey(site: Site, apiKey: string): Promise<boolean> {
  if (!site.apiKeyHash || !apiKey) return false;
  const hash = hashApiKey(apiKey);
  const a = Buffer.from(hash);
  const b = Buffer.from(site.apiKeyHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

type ContentTypeWithFields = {
  id: string;
  fields: {
    name: string;
    type: string;
    isTitle: boolean;
    isSlugSource: boolean;
  }[];
};

export function entrySlug(
  payload: Record<string, unknown>,
  contentType: ContentTypeWithFields,
): string | null {
  const slugField = contentType.fields.find(
    (f) => f.name.toLowerCase() === "slug" && f.type === "TEXT",
  );
  const slugSource = contentType.fields.find((f) => f.isSlugSource);
  const titleField = contentType.fields.find((f) => f.isTitle);
  const title = typeof titleField?.name === "string" ? payload[titleField.name] : undefined;

  let raw: unknown = null;
  if (slugField) raw = payload[slugField.name];
  else if (slugSource) raw = payload[slugSource.name];
  else if (typeof title === "string") raw = title;

  if (typeof raw !== "string" || !raw.trim()) return null;
  return slugify(raw);
}
