import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { fetchPhotosForPicker } from "@/lib/data/posts";

export async function GET(request: NextRequest) {
  try {
    await requireUser();

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const search = searchParams.get("search") ?? undefined;

    const result = await fetchPhotosForPicker(page, search);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching photos for picker:", error);
    return NextResponse.json(
      { error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
