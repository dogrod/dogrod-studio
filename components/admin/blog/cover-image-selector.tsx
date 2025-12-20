"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { PhotoPickerItem } from "@/types/posts";
import type { AssetWithRenditions } from "@/types/photos";

interface CoverImageSelectorProps {
  /** Currently selected asset with renditions */
  selectedAsset: AssetWithRenditions | null;
  /** Currently selected gallery photo ID (if from gallery) */
  selectedPhotoId: string | null;
  /** Callback when a photo is selected from the gallery */
  onSelectPhoto: (photo: PhotoPickerItem) => void;
  /** Callback when selection is cleared */
  onClear: () => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

export function CoverImageSelector({
  selectedAsset,
  selectedPhotoId,
  onSelectPhoto,
  onClear,
  disabled,
}: CoverImageSelectorProps) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<PhotoPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPhotos = useCallback(async (pageNum: number, searchTerm: string, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
      });
      if (searchTerm) {
        params.set("search", searchTerm);
      }

      const response = await fetch(`/api/admin/photos/picker?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch photos");
      }

      const data = await response.json();
      setPhotos((prev) => (append ? [...prev, ...data.items] : data.items));
      setHasMore(pageNum < data.pages);
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchPhotos(1, search);
    }
  }, [open, search, fetchPhotos]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPhotos(nextPage, search, true);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleSelect = (photo: PhotoPickerItem) => {
    onSelectPhoto(photo);
    setOpen(false);
  };

  const previewUrl = getPreviewUrl(selectedAsset);

  return (
    <div className="space-y-3">
      {selectedAsset && previewUrl ? (
        <div className="relative">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-muted">
            <Image
              src={previewUrl}
              alt="Cover image preview"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={onClear}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Remove cover image</span>
            </Button>
          )}
          {selectedPhotoId && (
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
              From Gallery
            </div>
          )}
        </div>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm">Select cover image from Gallery</span>
            </button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Select Cover Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search photos..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[400px]">
                {loading && photos.length === 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-video w-full rounded-lg" />
                    ))}
                  </div>
                ) : photos.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                    No photos found. Make sure you have published photos in your Gallery.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {photos.map((photo) => {
                        const thumbUrl = pickPhotoThumb(photo);
                        return (
                          <button
                            key={photo.id}
                            type="button"
                            className="group relative aspect-video overflow-hidden rounded-lg border bg-muted transition-all hover:ring-2 hover:ring-primary"
                            onClick={() => handleSelect(photo)}
                          >
                            {thumbUrl ? (
                              <Image
                                src={thumbUrl}
                                alt={photo.title ?? "Photo"}
                                fill
                                className="object-cover"
                                sizes="200px"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                No preview
                              </div>
                            )}
                            {photo.title && (
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <p className="truncate text-xs text-white">
                                  {photo.title}
                                </p>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {hasMore && (
                      <div className="flex justify-center pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleLoadMore}
                          disabled={loading}
                        >
                          {loading ? "Loading..." : "Load more"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {selectedAsset && !disabled && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="w-full">
              Change cover image
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Select Cover Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search photos..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[400px]">
                {loading && photos.length === 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="aspect-video w-full rounded-lg" />
                    ))}
                  </div>
                ) : photos.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                    No photos found. Make sure you have published photos in your Gallery.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {photos.map((photo) => {
                        const thumbUrl = pickPhotoThumb(photo);
                        return (
                          <button
                            key={photo.id}
                            type="button"
                            className="group relative aspect-video overflow-hidden rounded-lg border bg-muted transition-all hover:ring-2 hover:ring-primary"
                            onClick={() => handleSelect(photo)}
                          >
                            {thumbUrl ? (
                              <Image
                                src={thumbUrl}
                                alt={photo.title ?? "Photo"}
                                fill
                                className="object-cover"
                                sizes="200px"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                No preview
                              </div>
                            )}
                            {photo.title && (
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                                <p className="truncate text-xs text-white">
                                  {photo.title}
                                </p>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {hasMore && (
                      <div className="flex justify-center pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleLoadMore}
                          disabled={loading}
                        >
                          {loading ? "Loading..." : "Load more"}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function getPreviewUrl(asset: AssetWithRenditions | null): string | null {
  if (!asset?.asset_rendition) {
    return null;
  }
  const lookup = new Map(asset.asset_rendition.map((r) => [r.variant_name, r]));
  return (
    lookup.get("og_card")?.url ??
    lookup.get("detail")?.url ??
    lookup.get("list")?.url ??
    lookup.get("thumb")?.url ??
    null
  );
}

function pickPhotoThumb(photo: PhotoPickerItem): string | null {
  const lookup = new Map(photo.renditions.map((r) => [r.variant_name, r]));
  return (
    lookup.get("thumb")?.url ??
    lookup.get("list")?.url ??
    null
  );
}
