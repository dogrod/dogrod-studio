import { format } from "date-fns";

import { formatAspectRatio } from "@/lib/utils";
import type { PhotoDetail } from "@/types/photos";

interface PhotoInfoListProps {
  photo: PhotoDetail;
  preview: { url: string; width: number | null; height: number | null; file_size: number | null } | null;
}

export function PhotoInfoList({ photo, preview }: PhotoInfoListProps) {
  const captured = photo.captured_at ? new Date(photo.captured_at) : null;
  const uploaded = new Date(photo.uploaded_at);

  return (
    <dl className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <dt className="text-muted-foreground">Captured</dt>
        <dd>{captured ? format(captured, "PPP") : "Unknown"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Uploaded</dt>
        <dd>{format(uploaded, "PPP p")}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Resolution</dt>
        <dd>
          {photo.width} × {photo.height} ({photo.orientation})
        </dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Aspect ratio</dt>
        <dd>{formatAspectRatio(photo.aspect_ratio) ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Megapixels</dt>
        <dd>{photo.megapixels ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Visibility</dt>
        <dd>{photo.is_visible ? "Visible" : "Hidden"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Status</dt>
        <dd>{photo.status}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Detail rendition</dt>
        <dd>
          {preview && preview.file_size
            ? `${formatFileSize(preview.file_size)} · ${preview.width ?? "?"}×${preview.height ?? "?"}`
            : "—"}
        </dd>
      </div>
    </dl>
  );
}

function formatFileSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
}
