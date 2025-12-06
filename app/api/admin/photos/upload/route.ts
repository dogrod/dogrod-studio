import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { processPhotoUpload } from "@/lib/uploads/photo-processor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] ========== Upload API Start ==========`);
  
  try {
    // Log request info
    console.log(`[${requestId}] Request URL:`, request.url);
    console.log(`[${requestId}] Request method:`, request.method);
    console.log(`[${requestId}] Request headers:`, Object.fromEntries(request.headers.entries()));
    
    // Log cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    console.log(`[${requestId}] Cookies count:`, allCookies.length);
    console.log(`[${requestId}] Cookie names:`, allCookies.map(c => c.name));
    
    // Check for Supabase auth cookies
    const supabaseCookies = allCookies.filter(c => c.name.includes('supabase') || c.name.includes('sb-'));
    console.log(`[${requestId}] Supabase cookies found:`, supabaseCookies.map(c => ({ name: c.name, valueLength: c.value.length })));

    console.log(`[${requestId}] Creating Supabase client...`);
    const supabase = await createSupabaseServerClient();
    
    console.log(`[${requestId}] Getting user...`);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log(`[${requestId}] Auth result - user:`, user?.id ?? null, "email:", user?.email ?? null);
    if (authError) {
      console.log(`[${requestId}] Auth error:`, authError.message, authError.name, authError.status);
    }

    if (!user) {
      console.log(`[${requestId}] Returning 401 - No user found`);
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
    }

    console.log(`[${requestId}] User authenticated, parsing formData...`);
    const formData = await request.formData();
    const file = formData.get("file");

    console.log(`[${requestId}] FormData parsed - file type:`, file?.constructor?.name, "is File:", file instanceof File);

    if (!(file instanceof File)) {
      console.log(`[${requestId}] Returning 400 - Missing file`);
      return NextResponse.json({ error: "Missing file", requestId }, { status: 400 });
    }

    console.log(`[${requestId}] File info - name:`, file.name, "size:", file.size, "type:", file.type);
    console.log(`[${requestId}] Starting processPhotoUpload...`);
    
    const result = await processPhotoUpload({ file, userId: user.id });

    console.log(`[${requestId}] Upload successful, result:`, result);
    console.log(`[${requestId}] ========== Upload API End (Success) ==========`);
    
    return NextResponse.json({ result, requestId }, { status: 200 });
  } catch (error) {
    console.error(`[${requestId}] ========== Upload API Error ==========`);
    console.error(`[${requestId}] Error type:`, error?.constructor?.name);
    console.error(`[${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    console.error(`[${requestId}] Error stack:`, error instanceof Error ? error.stack : "N/A");
    console.error(`[${requestId}] Full error:`, error);
    
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message, requestId }, { status: 500 });
  }
}
