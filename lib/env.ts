import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters for security"),
  BETTER_AUTH_URL: z.string().url(),
  RESEND_API_KEY: z.string().min(3),
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error("Invalid environment variables. Fix configurations before boot.");
}

export const env = parsed.data;
