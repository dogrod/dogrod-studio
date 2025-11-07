import Link from "next/link";

import { UploadManager } from "@/components/admin/upload/upload-manager";

export default function UploadPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload photos</h1>
        <p className="text-sm text-muted-foreground">
          Upload originals, generate renditions, and publish to the gallery. All uploads are private until processed; visibility can be toggled from the photo list or detail view.
        </p>
        <p className="text-xs text-muted-foreground">
          Need to review what you just uploaded? Head back to the{" "}
          <Link href="/admin" className="text-primary hover:underline">
            photo list
          </Link>
          .
        </p>
      </div>

      <UploadManager />
    </div>
  );
}
