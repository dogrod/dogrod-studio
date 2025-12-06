/**
 * Check Duplicate API - Check if a photo with the same checksum already exists
 *
 * This endpoint allows the client to check for duplicate photos before uploading.
 * It queries the assets table by checksum (SHA-256 hash of the file content).
 */
import { NextResponse } from "next/server";

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

interface CheckDuplicateRequest {
  checksum: string;
}

interface ExistingPhoto {
  id: string;
  title: string | null;
  thumbUrl: string | null;
}

interface CheckDuplicateResponse {
  exists: boolean;
  existingPhoto: ExistingPhoto | null;
}

export async function POST(request: Request) {
  try {
    // Authenticate user
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = (await request.json()) as CheckDuplicateRequest;
    const { checksum } = body;

    if (!checksum || typeof checksum !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid checksum" },
        { status: 400 }
      );
    }

    // Validate checksum format (should be 64 character hex string for SHA-256)
    if (!/^[a-f0-9]{64}$/i.test(checksum)) {
      return NextResponse.json(
        { error: "Invalid checksum format. Expected SHA-256 hex string." },
        { status: 400 }
      );
    }

    // Query for existing asset with the same checksum
    const serviceSupabase = createSupabaseServiceRoleClient();
    const { data: asset, error: queryError } = await serviceSupabase
      .from("assets")
      .select(`
        id,
        photos!inner(
          id,
          title,
          photo_rendition(variant_name, url)
        )
      `)
      .eq("checksum", checksum.toLowerCase())
      .maybeSingle();

    if (queryError) {
      console.error("[check-duplicate] Query error:", queryError);
      return NextResponse.json(
        { error: "Failed to check for duplicates" },
        { status: 500 }
      );
    }

    if (!asset) {
      const response: CheckDuplicateResponse = {
        exists: false,
        existingPhoto: null,
      };
      return NextResponse.json(response);
    }

    // Extract photo info from the joined result
    const photos = asset.photos as Array<{
      id: string;
      title: string | null;
      photo_rendition: Array<{ variant_name: string; url: string }> | null;
    }>;

    const photo = photos[0];
    const thumbRendition = photo?.photo_rendition?.find(
      (r) => r.variant_name === "thumb"
    );

    const response: CheckDuplicateResponse = {
      exists: true,
      existingPhoto: {
        id: photo?.id ?? "",
        title: photo?.title ?? null,
        thumbUrl: thumbRendition?.url ?? null,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[check-duplicate] Unexpected error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to check for duplicates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

