/**
 * Complete API - Process uploaded photo after direct R2 upload
 *
 * ⚠️ KNOWN LIMITATIONS & BOTTLENECKS:
 *
 * 1. MEMORY USAGE (Risk: Medium)
 *    - Loads entire original file into memory for processing
 *    - 50MB image -> ~300-500MB peak memory usage
 *    - Vercel limit: 1024MB (Hobby) / 3008MB (Pro)
 *    - If OOM: check logs for memory spike, reduce file size limit
 *
 * 2. EXECUTION TIME (Risk: Medium)
 *    - maxDuration set to 120s, but Hobby plan caps at 60s
 *    - Typical processing: 15-30s for large images
 *    - If timeout: upgrade plan or implement async queue processing
 *
 * 3. R2 OPERATIONS (Risk: Low)
 *    - Read original + upload 3 renditions
 *    - Retry mechanism handles transient failures (max 3 attempts each)
 *
 * Flow:
 * 1. Validate request and authenticate user
 * 2. Call processPhotoFromR2 which handles all processing
 * 3. Return photo ID and detail URL
 */
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  processPhotoFromR2,
  type ProcessFromR2Context,
} from "@/lib/uploads/photo-processor";

export const runtime = "nodejs";

/**
 * ⚠️ EXECUTION TIME LIMIT:
 * - Hobby plan: max 60s (this setting will be capped)
 * - Pro plan: max 300s
 * If processing consistently times out, consider:
 * 1. Upgrading to Pro plan
 * 2. Implementing async processing with a job queue
 */
export const maxDuration = 120;

interface CompleteRequest {
  storageId: string;
  key: string;
  filename: string;
  contentType: string;
}

interface CompleteResponse {
  photoId: string;
  detailUrl: string;
}

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] ========== Complete API Start ==========`);

  try {
    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log(`[${requestId}] Auth failed:`, authError?.message ?? "No user");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[${requestId}] User authenticated:`, user.id);

    // Parse request body
    const body = (await request.json()) as CompleteRequest;
    const { storageId, key, filename, contentType } = body;

    // Validate required fields
    if (!storageId || typeof storageId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid storageId" },
        { status: 400 }
      );
    }

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid key" },
        { status: 400 }
      );
    }

    if (!filename || typeof filename !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid filename" },
        { status: 400 }
      );
    }

    if (!contentType || typeof contentType !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid contentType" },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Processing request:`, {
      storageId,
      key,
      filename,
      contentType,
    });

    // Process the uploaded photo
    const context: ProcessFromR2Context = {
      storageId,
      originalKey: key,
      originalFilename: filename,
      contentType,
      userId: user.id,
    };

    const result = await processPhotoFromR2(context);

    console.log(`[${requestId}] Processing complete:`, result);
    console.log(`[${requestId}] ========== Complete API End (Success) ==========`);

    const response: CompleteResponse = {
      photoId: result.photoId,
      detailUrl: result.detailUrl,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(`[${requestId}] ========== Complete API Error ==========`);
    console.error(`[${requestId}] Error type:`, error?.constructor?.name);
    console.error(
      `[${requestId}] Error message:`,
      error instanceof Error ? error.message : String(error)
    );
    console.error(
      `[${requestId}] Error stack:`,
      error instanceof Error ? error.stack : "N/A"
    );

    const message =
      error instanceof Error ? error.message : "Processing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
