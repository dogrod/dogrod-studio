"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PhotoListItem } from "@/lib/data/photos";
import { PhotoVisibilityToggle } from "@/components/admin/photo-visibility-toggle";
import { PhotoLightbox } from "@/components/admin/photo-lightbox";
import { cn } from "@/lib/utils";

interface PhotoTableProps {
  photos: PhotoListItem[];
}

interface LightboxState {
  open: boolean;
  src: string | null;
  title: string | null;
}

export function PhotoTable({ photos }: PhotoTableProps) {
  const [lightbox, setLightbox] = useState<LightboxState>({
    open: false,
    src: null,
    title: null,
  });

  const openLightbox = (photo: PhotoListItem) => {
    const rendition = pickDetailRendition(photo);
    if (rendition) {
      setLightbox({
        open: true,
        src: rendition.url,
        title: photo.title,
      });
    }
  };

  const closeLightbox = () => {
    setLightbox((prev) => ({ ...prev, open: false }));
  };
  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        No photos found matching your filters.
      </div>
    );
  }

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">Preview</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Visible</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {photos.map((photo) => {
          const rendition = pickRendition(photo);
          const location = buildLocation(photo);

          return (
            <TableRow key={photo.id}>
              <TableCell>
                <button
                  type="button"
                  className="relative h-16 w-20 overflow-hidden rounded-md bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                  onClick={() => openLightbox(photo)}
                >
                  {rendition ? (
                    <Image
                      src={rendition.url}
                      alt={photo.title ?? "Photo thumbnail"}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                      No preview
                    </div>
                  )}
                </button>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {photo.title || "Untitled"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    #{photo.id.slice(0, 8)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-muted-foreground">Taken:</span>
                    <span className="text-sm">
                      {photo.captured_at
                        ? format(new Date(photo.captured_at), "MMM d, yyyy")
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-muted-foreground">Added:</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(photo.uploaded_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-[160px]">
                <span className="text-sm text-muted-foreground">
                  {location || "—"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {photo.status}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {photo.visibility}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <PhotoVisibilityToggle
                    photoId={photo.id}
                    initialVisible={photo.is_visible}
                  />
                  <span
                    className={cn(
                      "text-xs",
                      photo.is_visible ? "text-emerald-600" : "text-muted-foreground",
                    )}
                  >
                    {photo.is_visible ? "Visible" : "Hidden"}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/admin/gallery/photos/${photo.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View / Edit
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>

    <PhotoLightbox
      open={lightbox.open}
      onOpenChange={closeLightbox}
      src={lightbox.src}
      title={lightbox.title ?? undefined}
    />
  </>
  );
}

function pickRendition(photo: PhotoListItem) {
  const lookup = new Map(photo.renditions.map((r) => [r.variant_name, r]));
  return lookup.get("list") ?? lookup.get("thumb") ?? lookup.get("detail") ?? null;
}

function pickDetailRendition(photo: PhotoListItem) {
  const lookup = new Map(photo.renditions.map((r) => [r.variant_name, r]));
  return lookup.get("detail") ?? lookup.get("list") ?? null;
}

function buildLocation(photo: PhotoListItem) {
  const parts = [photo.place_name, photo.city, photo.region, photo.country].filter(Boolean) as string[];
  return parts.join(", ");
}
