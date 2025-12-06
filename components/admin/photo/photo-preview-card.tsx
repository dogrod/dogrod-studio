"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { MapPin } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoInfoList } from "@/components/admin/photo/photo-info-list";
import { PhotoLightbox } from "@/components/admin/photo-lightbox";
import type { Photo, PhotoRendition } from "@/types/photos";

interface PhotoPreviewCardProps {
  photo: Photo;
  preview: PhotoRendition | null;
  locationLabel: string;
}

export function PhotoPreviewCard({ photo, preview, locationLabel }: PhotoPreviewCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex flex-col w-full">
            <div className="flex items-center justify-between w-full">
              <CardTitle className="text-lg font-semibold">Preview</CardTitle>
              <Link
                href="/admin/gallery"
                className="text-sm text-primary underline-offset-4 hover:underline shrink-0"
              >
                Back to list
              </Link>
            </div>
            <p className="flex items-center gap-2 text-sm text-muted-foreground mt-1 break-all">
              <MapPin className="h-4 w-4" />
              {locationLabel || "Location unknown"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <button
            type="button"
            className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            onClick={() => preview && setLightboxOpen(true)}
          >
            {preview ? (
              <Image
                src={preview.url}
                alt={photo.title ?? "Photo preview"}
                fill
                sizes="(max-width: 1024px) 100vw, 480px"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                No preview available
              </div>
            )}
          </button>
          <PhotoInfoList photo={photo} preview={preview} />
        </CardContent>
      </Card>

      <PhotoLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        src={preview?.url ?? null}
        title={photo.title ?? undefined}
      />
    </>
  );
}

