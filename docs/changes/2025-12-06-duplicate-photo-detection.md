# Duplicate Photo Detection Before Upload

**Date:** 2025-12-06  
**Type:** Feature Enhancement  
**Status:** Implemented  

## Table of Contents

- [Background](#background)
- [Solution Design](#solution-design)
- [Implementation Details](#implementation-details)
- [Module Changes](#module-changes)
- [Error Handling & Graceful Degradation](#error-handling--graceful-degradation)
- [UI/UX Changes](#uiux-changes)
- [Technical Notes](#technical-notes)

---

## Background

When uploading photos to the gallery, users may accidentally upload the same photo multiple times. This creates duplicate entries in the database and wastes storage space in R2.

### Problem Statement

1. **No duplicate detection**: The system had no way to detect if a photo already exists
2. **Wasted resources**: Duplicate uploads consume storage and processing time
3. **Manual cleanup required**: Users had to manually identify and delete duplicates

### Existing Infrastructure

The `assets` table already has a `checksum` field that stores a SHA-256 hash of the original file, calculated during server-side processing. This field can be leveraged for duplicate detection.

---

## Solution Design

### Pre-Upload Duplicate Check Flow

```
┌─────────┐         ┌────────────────┐         ┌──────────────────┐
│ Client  │────────▶│ Calculate Hash │────────▶│ Check Duplicate  │
└─────────┘         └────────────────┘         │      API         │
     │                     │                   └──────────────────┘
     │ 1. User drops file  │                           │
     │                     │                           │
     │ 2. Calculate SHA-256 (Web Crypto API)           │
     │                     │                           │
     │ 3. POST /api/admin/photos/check-duplicate       │
     │─────────────────────────────────────────────────▶
     │◀─────────────────────────────────────────────────
     │     {exists: true, existingPhoto: {...}}        │
     │                                                  │
     │ 4. Show confirmation dialog                     │
     │    ┌─────────────────────────────┐              │
     │    │ Duplicate Photo Detected    │              │
     │    │ ┌───┐ "Photo Title"         │              │
     │    │ │ 🖼 │ View existing →       │              │
     │    │ └───┘                       │              │
     │    │ [Skip Upload] [Upload Anyway]│              │
     │    └─────────────────────────────┘              │
     │                                                  │
     │ 5a. Skip → Mark as "skipped"                    │
     │ 5b. Continue → Proceed with normal upload       │
```

### Design Principles

1. **Optional check**: The duplicate check is a best-effort enhancement, not a blocker
2. **Graceful degradation**: If check fails for any reason, upload proceeds normally
3. **User control**: Users can choose to upload duplicates if intentional
4. **Consistent hashing**: Client and server use identical SHA-256 algorithm

---

## Implementation Details

### Checksum Calculation

Both client and server calculate checksums identically:

**Server-side (Node.js)**:
```typescript
import { createHash } from "node:crypto";
const checksum = createHash("sha256").update(buffer).digest("hex");
```

**Client-side (Web Crypto API)**:
```typescript
const buffer = await file.arrayBuffer();
const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
const hashArray = Array.from(new Uint8Array(hashBuffer));
return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
```

Both produce identical 64-character lowercase hexadecimal strings.

### Upload Status States

| Status | Description | Visual |
|--------|-------------|--------|
| `idle` | Waiting in queue | Gray cloud icon, "Pending Upload" |
| `checking` | Calculating hash & checking | Spinner, "Checking..." |
| `presigning` | Getting presigned URL | Spinner, "Preparing..." |
| `uploading` | Uploading to R2 | Spinner + progress bar |
| `processing` | Server processing | Spinner, "Processing..." |
| `success` | Upload complete | Green checkmark |
| `skipped` | Duplicate skipped by user | Amber warning icon |
| `error` | Upload failed | Red X icon |

---

## Module Changes

### New Files

| File | Purpose |
|------|---------|
| `app/api/admin/photos/check-duplicate/route.ts` | API endpoint to check if checksum exists in database |

### Modified Files

| File | Changes |
|------|---------|
| `components/admin/upload/upload-manager.tsx` | Added duplicate detection flow, confirmation dialog, new status states, and pending upload UI |

---

## Error Handling & Graceful Degradation

The duplicate check is designed to fail silently and allow uploads to proceed:

### Scenarios Where Check is Skipped

1. **Web Crypto API unavailable**
   - Occurs in non-HTTPS environments (except localhost)
   - Check: `!crypto?.subtle?.digest`
   - Action: Skip check, proceed with upload

2. **API request fails**
   - Network error, server error, etc.
   - Check: `!response.ok`
   - Action: Log warning, proceed with upload

3. **Checksum calculation throws**
   - File read error, memory issues, etc.
   - Check: try/catch wrapper
   - Action: Log warning, proceed with upload

### Console Logging

```typescript
// When Web Crypto not available
console.log("[upload] Web Crypto API not available, skipping duplicate check");

// When API fails
console.warn("[upload] Duplicate check API error, proceeding with upload");

// When any error occurs
console.warn("[upload] Duplicate check failed, proceeding with upload:", error);
```

---

## UI/UX Changes

### Duplicate Confirmation Dialog

When a duplicate is detected, a modal dialog appears with:

- **Warning icon**: Amber triangle alert
- **Title**: "Duplicate Photo Detected"
- **Description**: Shows the filename being uploaded
- **Existing photo preview**: Thumbnail, title, and link to view
- **Actions**:
  - "Skip Upload" (outline button) - Marks upload as skipped
  - "Upload Anyway" (primary button) - Proceeds with upload

### Pending Upload State

For batch uploads, files waiting in queue now show:

- Semi-transparent image preview with blur
- Cloud upload icon (gray, static)
- "Pending Upload" text

This distinguishes waiting files from successfully uploaded ones.

### Skipped State

Files skipped due to duplicate detection show:

- Amber background overlay
- Warning triangle icon
- "Duplicate skipped" text

---

## Technical Notes

### SHA-256 Collision Probability

SHA-256 produces a 256-bit hash, making collision probability approximately 1/2^128. This is effectively impossible for practical purposes:

- Even with billions of photos, collision is astronomically unlikely
- Industry standard for file deduplication (used by Google Photos, iCloud, etc.)

### Browser Compatibility

Web Crypto API (`crypto.subtle`) support:

| Browser | Minimum Version | Released |
|---------|-----------------|----------|
| Chrome | 37+ | Aug 2014 |
| Firefox | 34+ | Dec 2014 |
| Safari | 11+ | Sep 2017 |
| Edge | 12+ | Jul 2015 |

**Global support**: ~97%+

**Requirements**:
- HTTPS environment (or localhost)
- Modern browser

### Performance Considerations

| File Size | Checksum Calculation Time |
|-----------|--------------------------|
| 5 MB | ~100-200ms |
| 20 MB | ~300-500ms |
| 50 MB | ~800-1200ms |

This overhead is acceptable as it happens before the actual upload, and the "Checking..." status keeps users informed.

### Database Index Recommendation

For optimal query performance, add an index on the checksum field:

```sql
CREATE INDEX IF NOT EXISTS idx_assets_checksum ON assets(checksum);
```

---

## Testing Checklist

- [x] Upload new photo (no duplicate) - proceeds normally
- [x] Upload duplicate photo - shows confirmation dialog
- [x] Click "Skip Upload" - marks as skipped with amber overlay
- [x] Click "Upload Anyway" - proceeds with upload
- [x] Batch upload with duplicates - handles each file independently
- [x] Pending files show "Pending Upload" state
- [x] Non-HTTPS environment - gracefully skips check
- [x] API error - gracefully skips check and proceeds
- [x] Dialog shows existing photo thumbnail and link

---

## Future Improvements

1. **Bulk duplicate handling**: "Skip All Duplicates" option for batch uploads
2. **Duplicate resolution UI**: Show side-by-side comparison of new vs existing
3. **Replace existing**: Option to update existing photo with new upload
4. **Fuzzy matching**: Detect similar (but not identical) photos using perceptual hashing

