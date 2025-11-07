## dogrod Studio Admin

Admin console for managing the dogrod Studio photo library. Authenticated administrators can upload originals to Cloudflare R2, generate renditions and histograms, edit metadata, and toggle public visibility.

## Prerequisites

- Node.js 20+
- pnpm (preferred) or npm/yarn/bun
- Supabase project with email/password auth enabled
- Cloudflare R2 bucket configured for S3-compatible API access

## Environment configuration

Create a `.env.local` file at the project root (Next.js automatically loads it). All variables are required for the app to boot. None of the Supabase credentials are exposed to the browser—authentication flows run through server actions. See sample values below and replace placeholders with your Supabase and Cloudflare credentials.

```bash
# Supabase credentials (server-only)
SUPABASE_URL="https://<project>.supabase.co"
SUPABASE_ANON_KEY="public-anon-key"
SUPABASE_SERVICE_ROLE_KEY="service-role-key"

# Cloudflare R2 (S3-compatible) storage
R2_ENDPOINT="https://<accountid>.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="r2-access-key"
R2_SECRET_ACCESS_KEY="r2-secret"
R2_BUCKET="dogrod-studio"
R2_PUBLIC_BASE_URL="https://cdn.example.com"
```

Restart the dev server after editing `.env.local`. If any variable is missing or malformed, the app raises a descriptive error summarising the issue.

## Local development

Install dependencies and start the dev server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) and sign in with a Supabase Auth user. Once authenticated, you can browse the admin list, upload photos, and edit details.

## Deployment notes

- Ensure the same environment variables are configured in your hosting platform.
- The upload API route (`/api/admin/photos/upload`) must run in a Node.js runtime (not Edge) because it relies on `sharp`.
- Cloudflare R2 objects are written with immutable keys (`photos/<uuid>/...`). Update logic should create new object keys to avoid stale caches.
