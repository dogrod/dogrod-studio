/**
 * Reprocess API - Re-run photo processing for failed uploads
 *
 * ⚠️ KNOWN LIMITATIONS & BOTTLENECKS:
 *
 * 1. MEMORY USAGE (Risk: Medium)
 *    - Same as initial processing: ~300-500MB for 50MB images
 *    - Vercel limit: 1024MB (Hobby) / 3008MB (Pro)
 *
 * 2. EXECUTION TIME (Risk: Medium)
 *    - maxDuration set to 120s, but Hobby plan caps at 60s
 *    - Typical reprocessing: 10-25s (skips EXIF extraction)
 *
 * Use Case:
 * When photo upload succeeds but processing fails (status != "published"),
 * this endpoint allows re-running the processing pipeline.
 */
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { reprocessPhoto } from "@/lib/uploads/photo-processor";

export const runtime = "nodejs";
export const maxDuration = 120;

interface RouteParams {
  params: Promise<{
    "photo-id": string;
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const resolvedParams = await params;
  const photoId = resolvedParams["photo-id"];
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[${requestId}] ========== Reprocess API Start ==========`);
  console.log(`[${requestId}] Photo ID:`, photoId);

  try {
    if (!photoId) {
      return NextResponse.json(
        { error: "Missing photo ID" },
        { status: 400 }
      );
    }

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

    // Reprocess the photo
    const result = await reprocessPhoto({
      photoId,
      userId: user.id,
    });

    console.log(`[${requestId}] Reprocess complete:`, result);
    console.log(`[${requestId}] ========== Reprocess API End (Success) ==========`);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(`[${requestId}] ========== Reprocess API Error ==========`);
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
      error instanceof Error ? error.message : "Reprocessing failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
