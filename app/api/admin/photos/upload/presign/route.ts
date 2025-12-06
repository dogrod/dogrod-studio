/**
 * Presign API - Generate temporary upload credentials for direct R2 upload
 *
 * ⚠️ KNOWN LIMITATIONS & BOTTLENECKS:
 * - Presigned URL expires in 10 minutes (configurable via PRESIGN_EXPIRES_SECONDS)
 * - Client must complete upload within this window
 * - Each presign request creates a unique storage path to avoid collisions
 *
 * Flow:
 * 1. Client requests presigned URL with filename and content type
 * 2. Server generates a unique storage ID and presigned PUT URL
 * 3. Client uploads directly to R2 using the presigned URL
 * 4. Client calls /complete API with the storage ID to trigger processing
 */
import { randomUUID } from "node:crypto";
import path from "node:path";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

import { getR2Bucket, getR2Client, getR2PublicBaseUrl } from "@/lib/r2";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Presigned URL validity in seconds (10 minutes) */
const PRESIGN_EXPIRES_SECONDS = 600;

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Maximum file size in bytes (50MB) - matches frontend validation */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface PresignRequest {
  filename: string;
  contentType: string;
  fileSize: number;
}

interface PresignResponse {
  uploadUrl: string;
  storageId: string;
  key: string;
  publicBaseUrl: string;
  expiresAt: string;
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

    // Parse and validate request body
    const body = (await request.json()) as PresignRequest;
    const { filename, contentType, fileSize } = body;

    if (!filename || typeof filename !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid filename" },
        { status: 400 }
      );
    }

    if (!contentType || !ACCEPTED_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: "Unsupported content type. Allowed: JPEG, PNG, WebP" },
        { status: 400 }
      );
    }

    if (typeof fileSize !== "number" || fileSize <= 0) {
      return NextResponse.json(
        { error: "Missing or invalid file size" },
        { status: 400 }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 400 }
      );
    }

    // Generate unique storage path
    const storageId = randomUUID();
    const extension = inferExtension(filename, contentType);
    const key = `photos/${storageId}/original${extension}`;

    // Generate presigned URL
    const client = getR2Client();
    const bucket = getR2Bucket();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: PRESIGN_EXPIRES_SECONDS,
    });

    const expiresAt = new Date(
      Date.now() + PRESIGN_EXPIRES_SECONDS * 1000
    ).toISOString();

    const response: PresignResponse = {
      uploadUrl,
      storageId,
      key,
      publicBaseUrl: getR2PublicBaseUrl(),
      expiresAt,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[presign] Failed to generate presigned URL:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function inferExtension(filename: string, contentType: string): string {
  const extFromName = path.extname(filename)?.toLowerCase();
  if (extFromName) {
    return extFromName;
  }

  switch (contentType) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}
