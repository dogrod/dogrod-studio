import Link from "next/link";

import { UploadManager } from "@/components/admin/upload/upload-manager";

export default function UploadPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link href="/admin/gallery" className="text-sm text-primary hover:underline">
            ← Back to gallery
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Upload photos</h1>
        </div>
      </div>

      <UploadManager />
    </div>
  );
}
