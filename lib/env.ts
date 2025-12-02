import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string(),
  R2_ENDPOINT: z.string().url(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET: z.string(),
  R2_PUBLIC_BASE_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/, "")),
  // Optional: enables reverse geocoding for photo locations
  MAPBOX_ACCESS_TOKEN: z.string().optional(),
});

const globalForEnv = globalThis as typeof globalThis & {
  __dogrodEnv__?: Env;
};

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  if (!globalForEnv.__dogrodEnv__) {
    const envResult = envSchema.safeParse({
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      R2_ENDPOINT: process.env.R2_ENDPOINT,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: process.env.R2_BUCKET,
      R2_PUBLIC_BASE_URL: process.env.R2_PUBLIC_BASE_URL,
      MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN,
    });

    if (!envResult.success) {
      const messages = envResult.error.issues
        .map((issue) => `${issue.path.join(".") || "unknown"}: ${issue.message}`)
        .join("\n");

      throw new Error(
        `Invalid environment configuration:\n${messages}\n\n` +
          "Create or update your `.env.local` file—see the README for required variables.",
      );
    }

    globalForEnv.__dogrodEnv__ = envResult.data;
  }
  return globalForEnv.__dogrodEnv__;
}
