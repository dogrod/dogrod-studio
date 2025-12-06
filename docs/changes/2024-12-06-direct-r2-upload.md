# Direct R2 Upload with Presigned URLs

**Date:** 2024-12-06  
**Type:** Architecture Change  
**Status:** Implemented  

## Table of Contents

- [Background](#background)
- [Problem Statement](#problem-statement)
- [Solution Design](#solution-design)
- [Implementation Details](#implementation-details)
- [Module Changes](#module-changes)
- [Risks & Limitations](#risks--limitations)
- [Configuration Requirements](#configuration-requirements)
- [Migration Notes](#migration-notes)

---

## Background

The photo upload feature was originally implemented using a traditional server-side upload approach where the client sends the file to a Next.js API route, which then processes and uploads the file to Cloudflare R2 storage.

### Original Flow

```
Client → Vercel API Route → R2 Storage
         (file in request body)
```

This worked well during local development but encountered issues when deployed to Vercel.

---

## Problem Statement

### Primary Issue: Vercel Body Size Limit

When deployed to Vercel, uploads of files larger than **4.5MB** failed with a **403 Forbidden** error. Investigation revealed:

1. **Vercel Hobby Plan Limitation**: Request body size is capped at 4.5MB
2. **No Function Logs**: The 403 was returned at the Edge layer before reaching the serverless function
3. **Misleading Error**: No clear indication that body size was the cause

### Secondary Issues Identified

1. **Auth Error Handling**: `AuthApiError` for invalid refresh tokens was not properly caught, causing crashes instead of redirects to login
2. **HTML Nesting**: `<a>` tags nested inside `<a>` tags in `AppCard` component caused hydration errors

---

## Solution Design

### Architecture: Presigned URL Direct Upload

Bypass Vercel's body size limit by having clients upload directly to R2 using presigned URLs.

### New Upload Flow

```
┌─────────┐         ┌─────────────┐         ┌────┐         ┌──────────────┐
│ Client  │────────▶│ Presign API │────────▶│ R2 │────────▶│ Complete API │
└─────────┘         └─────────────┘         └────┘         └──────────────┘
     │                     │                   │                   │
     │ 1. Request presign  │                   │                   │
     │────────────────────▶│                   │                   │
     │◀────────────────────│                   │                   │
     │  {uploadUrl, key}   │                   │                   │
     │                                         │                   │
     │ 2. PUT file directly (up to 50MB)       │                   │
     │────────────────────────────────────────▶│                   │
     │◀────────────────────────────────────────│                   │
     │                                         │                   │
     │ 3. Notify completion                                        │
     │────────────────────────────────────────────────────────────▶│
     │◀────────────────────────────────────────────────────────────│
     │  {photoId, detailUrl}                                       │
```

### Design Principles

1. **Server-side secrets**: All sensitive configuration (R2 credentials, public base URL) remains on the server
2. **Retry resilience**: R2 operations have retry logic (max 3 attempts) with exponential backoff
3. **Phased processing**: Database writes happen in stages - critical data first, derived data later
4. **Serial renditions**: Generate image renditions one at a time to minimize peak memory usage
5. **Explicit risk documentation**: All known limitations documented at function/file level

---

## Implementation Details

### Processing Phases

The `processPhotoFromR2` function executes in 7 distinct phases:

| Phase | Description | Retriable | Notes |
|-------|-------------|-----------|-------|
| 1 | Read original from R2 | ✅ (3x) | Loads entire file into memory |
| 2 | Extract metadata (EXIF, dimensions) | ❌ | Single pass through buffer |
| 3 | Write basic data to DB | ❌ | assets, photos, photo_exif |
| 4 | Generate renditions (serial) | ❌ | thumb → list → detail |
| 5 | Upload renditions to R2 | ✅ (3x) | Each rendition retried independently |
| 6 | Compute derived data | ❌ | histogram, blurhash, dominant_color |
| 7 | Write derived data, finalize | ❌ | Update photo status to "published" |

### Photo Status Flow

```
Initial insert: status = "draft"
        ↓
After Phase 7:  status = "published"
```

### Retry Configuration

```typescript
const R2_RETRY_OPTIONS = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
};
```

Uses exponential backoff with jitter via the existing `withRetry` utility.

---

## Module Changes

### New Files

| File | Purpose |
|------|---------|
| `app/api/admin/photos/upload/presign/route.ts` | Generate presigned URL for direct R2 upload |
| `app/api/admin/photos/upload/complete/route.ts` | Process uploaded file after client completes R2 upload |

### Modified Files

| File | Changes |
|------|---------|
| `lib/uploads/photo-processor.ts` | Complete rewrite - new `processPhotoFromR2()` function with phased processing, retry logic, and risk documentation |
| `components/admin/upload/upload-manager.tsx` | New 3-step upload flow (presign → R2 direct → complete) |
| `app/api/admin/photos/upload/route.ts` | Deprecated - returns 410 Gone with migration instructions |
| `lib/auth.ts` | Added `AuthApiError` handling for invalid refresh tokens |
| `components/admin/app-card.tsx` | Fixed nested `<a>` tag issue using `useRouter` for navigation |

### New Dependencies

```json
{
  "@aws-sdk/s3-request-presigner": "^3.922.0"
}
```

---

## Risks & Limitations

### Memory Usage (Risk: Medium)

| Metric | Value |
|--------|-------|
| Vercel Hobby Plan | 1024 MB |
| Vercel Pro Plan | Up to 3008 MB |
| 50MB image processing | ~300-500 MB peak |

**Mitigation**: Serial rendition generation reduces peak memory. Monitor logs for OOM errors.

**If OOM occurs**:
1. Reduce `MAX_FILE_SIZE` in presign API
2. Upgrade to Pro plan for more memory
3. Consider streaming processing (major refactor)

### Execution Time (Risk: Medium)

| Plan | Limit | Configured |
|------|-------|------------|
| Hobby | 60s max | 120s (capped to 60s) |
| Pro | 300s max | 120s |

**Typical processing**: 15-30s for large images

**If timeout occurs**:
1. Upgrade to Pro plan
2. Implement async job queue (e.g., Inngest, QStash)

### R2 Operations (Risk: Low)

- Presigned URL validity: 10 minutes
- Retry mechanism handles transient failures
- Cleanup on failure removes orphaned R2 objects

### Database Consistency (Risk: Low)

- Phase 3 creates records with `status: "draft"`
- Only Phase 7 success updates to `status: "published"`
- Partial failures leave photo in draft state (recoverable)

---

## Configuration Requirements

### R2 CORS Configuration

Add CORS rules in Cloudflare Dashboard → R2 → Your Bucket → Settings → CORS:

```json
[
  {
    "AllowedOrigins": [
      "https://your-production-domain.com",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

### Environment Variables

No new environment variables required. Existing R2 configuration is reused:

- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

---

## Migration Notes

### For Existing Clients

The old upload endpoint (`POST /api/admin/photos/upload`) now returns:

```json
{
  "error": "This upload endpoint is deprecated...",
  "migration": {
    "step1": "POST /api/admin/photos/upload/presign",
    "step2": "PUT directly to the returned uploadUrl",
    "step3": "POST /api/admin/photos/upload/complete"
  }
}
```

HTTP Status: `410 Gone`

### Breaking Changes

1. Old upload endpoint no longer processes files
2. Client must implement 3-step upload flow
3. R2 CORS must be configured for direct uploads

### Rollback Plan

To rollback:

1. Restore `app/api/admin/photos/upload/route.ts` from git
2. Restore `lib/uploads/photo-processor.ts` from git
3. Restore `components/admin/upload/upload-manager.tsx` from git
4. Remove `/presign` and `/complete` route directories

Note: Rollback will reintroduce the 4.5MB upload limit on Vercel Hobby plan.

---

## Related Fixes

### Auth Error Handling

**File**: `lib/auth.ts`

Added handling for `AuthApiError` when refresh token is invalid:

```typescript
if (error instanceof AuthApiError && error.message.includes("Refresh Token")) {
  return null; // Triggers redirect to login
}
```

### AppCard Hydration Fix

**File**: `components/admin/app-card.tsx`

Replaced `<Link>` wrapper with `onClick` navigation to avoid nested `<a>` tags:

```typescript
// Before: <Link href={href}><Card>...<a href={externalUrl}>...</a>...</Card></Link>
// After:  <Card onClick={() => router.push(href)}>...<a href={externalUrl}>...</a>...</Card>
```

---

## Testing Checklist

- [x] Upload file < 4.5MB
- [x] Upload file > 4.5MB (was failing before, now works)
- [x] Upload multiple files sequentially
- [x] Verify EXIF data extracted correctly
- [x] Verify renditions generated (thumb, list, detail)
- [x] Verify photo status transitions (draft → published)
- [x] Verify error handling (invalid file type, oversized file)
- [x] Verify auth redirect on expired session

---

## Future Improvements

1. **Parallel rendition uploads**: After generation, upload all renditions in parallel
2. **Progress streaming**: Use Server-Sent Events for real-time processing progress
3. **Async processing**: Move to job queue for better reliability and longer timeouts
4. **Resumable uploads**: Implement multipart upload for very large files
