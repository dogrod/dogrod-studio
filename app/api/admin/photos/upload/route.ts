/**
 * @deprecated This endpoint is deprecated.
 * Use the new upload flow:
 * 1. POST /api/admin/photos/upload/presign - Get presigned URL
 * 2. PUT to presigned URL - Upload directly to R2
 * 3. POST /api/admin/photos/upload/complete - Process the upload
 *
 * This endpoint is kept for backwards compatibility and will return an error
 * directing clients to use the new flow.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "This upload endpoint is deprecated. Please use the new upload flow: /presign -> R2 direct upload -> /complete",
      migration: {
        step1: "POST /api/admin/photos/upload/presign",
        step2: "PUT directly to the returned uploadUrl",
        step3: "POST /api/admin/photos/upload/complete",
      },
    },
    { status: 410 } // 410 Gone
  );
}
