import { notFound } from "next/navigation";
import { Calendar as CalendarIcon, Info } from "lucide-react";

import { PhotoDetailForm } from "@/components/admin/photo/photo-detail-form";
import { PhotoPreviewCard } from "@/components/admin/photo/photo-preview-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchAllTags, fetchPhotoDetail } from "@/lib/data/photos";

interface PhotoPageProps {
  params: Promise<{
    "photo-id": string;
  }>;
}

export default async function PhotoDetailPage({ params }: PhotoPageProps) {
  const resolvedParams = await params;
  const id = resolvedParams["photo-id"];

  if (!id) {
    notFound();
  }

  const [photo, allTags] = await Promise.all([
    fetchPhotoDetail(id),
    fetchAllTags(),
  ]);

  if (!photo) {
    notFound();
  }

  const preview = selectPreview(photo);

  const locationLabel = buildLocationLabel(photo);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,4fr)]">
      <div className="space-y-6">
        <PhotoPreviewCard
          photo={photo}
          preview={preview}
          locationLabel={locationLabel}
        />

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">EXIF</CardTitle>
          </CardHeader>
          <CardContent>
            {photo.exif ? (
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Camera</dt>
                  <dd>{photo.exif.camera_make ?? "—"} {photo.exif.camera_model ?? ""}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Lens</dt>
                  <dd>{photo.exif.lens_model ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Focal</dt>
                  <dd>{formatNullable(photo.exif.focal_length_mm, (value) => `${Number(value).toFixed(1)}mm`)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Aperture</dt>
                  <dd>{formatNullable(photo.exif.aperture, (value) => `f/${Number(value).toFixed(1)}`)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Shutter</dt>
                  <dd>{formatShutter(photo.exif.shutter_s)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">ISO</dt>
                  <dd>{photo.exif.iso ?? "—"}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Captured</dt>
                  <dd className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    {photo.exif.exif_datetime_original ?? "—"}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No EXIF metadata available.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histogram</CardTitle>
          </CardHeader>
          <CardContent>
            {photo.histogram ? (
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Highlights</p>
                  <p className="font-medium">{formatPercentage(photo.histogram.highlights_pct)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Shadows</p>
                  <p className="font-medium">{formatPercentage(photo.histogram.shadows_pct)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {photo.tags.map((tag) => (
                    <Badge key={tag.id} variant="secondary">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Histogram not available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <PhotoDetailForm photo={photo} allTags={allTags} />
    </div>
  );
}

function selectPreview(photo: Awaited<ReturnType<typeof fetchPhotoDetail>>) {
  if (!photo) return null;
  const lookup = new Map(photo.renditions.map((r) => [r.variant_name, r]));
  return lookup.get("detail") ?? lookup.get("list") ?? lookup.get("thumb") ?? null;
}

function buildLocationLabel(photo: NonNullable<Awaited<ReturnType<typeof fetchPhotoDetail>>>) {
  const parts = [photo.place_name, photo.city, photo.region, photo.country].filter(Boolean) as string[];
  return parts.join(", ");
}

function formatShutter(value: number | string | null | undefined) {
  if (!value) return "—";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric) || numeric <= 0) return "—";
  if (numeric >= 1) {
    return `${numeric.toFixed(2)}s`;
  }
  const denominator = Math.round(1 / numeric);
  return `1/${denominator}`;
}

function formatNullable<T>(value: T | null | undefined, formatter: (value: number) => string) {
  if (value === null || value === undefined) {
    return "—";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return formatter(numeric);
}

function formatPercentage(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "0.00%";
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return "0.00%";
  return `${numeric.toFixed(2)}%`;
}

