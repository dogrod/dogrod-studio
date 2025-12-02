"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, UploadCloud, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

type UploadStatus = "idle" | "uploading" | "processing" | "success" | "error";

interface UploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: UploadStatus;
  progress: number;
  error?: string;
  photoId?: string;
  previewUrl?: string;
  detailUrl?: string;
}

interface UploadResponse {
  photoId: string;
  detailUrl: string;
}

export function UploadManager() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const hasUploads = uploads.length > 0;

  const processFiles = (files: File[]) => {
    if (files.length === 0) return;

    const items = files.map<UploadItem>((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      status: "idle",
      progress: 0,
      previewUrl: URL.createObjectURL(file),
    }));

    setUploads((prev) => [...items, ...prev]);
    void processQueue(items);
  };

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    processFiles(files);
    event.target.value = "";
  };

  const handleDragEnter = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current += 1;
    if (event.dataTransfer?.items?.length) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(event.dataTransfer?.files ?? []);
    processFiles(files);
  };

  const processQueue = async (items: UploadItem[]) => {
    for (const item of items) {
      const validationMessage = validateFile(item.file);
      if (validationMessage) {
        setUploads((prev) =>
          prev.map((existing) =>
            existing.id === item.id
              ? { ...existing, status: "error", error: validationMessage }
              : existing,
          ),
        );
        continue;
      }

      await uploadFile(item);
    }
  };

  const uploadFile = async (item: UploadItem) => {
    setUploads((prev) =>
      prev.map((existing) =>
        existing.id === item.id
          ? { ...existing, status: "uploading", progress: 5 }
          : existing,
      ),
    );

    try {
      const response = await sendFile(item.file, (progress) => {
        setUploads((prev) =>
          prev.map((existing) =>
            existing.id === item.id ? { ...existing, progress } : existing,
          ),
        );
      });

      setUploads((prev) =>
        prev.map((existing) =>
          existing.id === item.id
            ? {
                ...existing,
                status: "success",
                progress: 100,
                photoId: response.photoId,
                detailUrl: response.detailUrl,
              }
            : existing,
        ),
      );

      toast({
        title: "Upload complete",
        description: `${item.name} processed successfully`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected upload error";
      setUploads((prev) =>
        prev.map((existing) =>
          existing.id === item.id
            ? {
                ...existing,
                status: "error",
                progress: 0,
                error: message,
              }
            : existing,
        ),
      );
      toast({
        title: "Upload failed",
        description: message,
      });
    }
  };

  const removeItem = (id: string) => {
    setUploads((prev) => {
      const item = prev.find((u) => u.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((u) => u.id !== id);
    });
  };

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      uploads.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      });
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Drop Zone */}
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
          hasUploads ? "py-12" : "py-20",
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          hidden
          onChange={handleSelectFiles}
        />

        <div className="flex flex-col items-center justify-center gap-4 text-center px-4">
          <div
            className={cn(
              "rounded-full p-4 transition-colors",
              isDragging ? "bg-primary/10" : "bg-muted",
            )}
          >
            <UploadCloud
              className={cn(
                "h-10 w-10 transition-colors",
                isDragging ? "text-primary" : "text-muted-foreground",
              )}
            />
          </div>

          {isDragging ? (
            <div className="space-y-1">
              <p className="text-lg font-medium text-primary">
                Drop your photos here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">
                Drag and drop your photos
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse from your device
              </p>
              <p className="text-xs text-muted-foreground/70 pt-2">
                JPEG, PNG, WebP up to 50MB each
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Grid */}
      {hasUploads && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Uploads ({uploads.length})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4 mr-2" />
              Add more
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {uploads.map((item) => (
              <UploadTile key={item.id} item={item} onRemove={removeItem} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadTile({
  item,
  onRemove,
}: {
  item: UploadItem;
  onRemove: (id: string) => void;
}) {
  const { id, name, status, progress, error, photoId, previewUrl, detailUrl } =
    item;
  const isLoading = status === "uploading" || status === "processing";
  const isSuccess = status === "success";
  const isError = status === "error";

  const imageUrl = detailUrl || previewUrl;

  return (
    <div className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
      {/* Image Preview */}
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={name}
          fill
          className={cn(
            "object-cover transition-all duration-300",
            isLoading && "opacity-50 blur-[1px]",
          )}
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          unoptimized={!detailUrl}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mt-2 text-sm font-medium text-foreground">
            {progress}%
          </span>
        </div>
      )}

      {/* Progress Bar */}
      {isLoading && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Success Indicator */}
      {isSuccess && (
        <div className="absolute top-2 right-2">
          <div className="rounded-full bg-emerald-500 p-1 shadow-lg">
            <CheckCircle2 className="h-4 w-4 text-white" />
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/90 p-3 text-center">
          <XCircle className="h-8 w-8 text-white" />
          <span className="mt-2 text-xs font-medium text-white line-clamp-2">
            {error || "Upload failed"}
          </span>
        </div>
      )}

      {/* Hover Overlay */}
      {(isSuccess || isError) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100">
          {isSuccess && photoId && (
            <Link
              href={`/admin/photo/${photoId}`}
              className="text-sm font-medium text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              View details
            </Link>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(id);
            }}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Remove
          </button>
        </div>
      )}

      {/* File Name Tooltip */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="text-xs text-white truncate">{name}</p>
      </div>
    </div>
  );
}

function validateFile(file: File) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Unsupported file type. Only JPEG, PNG, and WebP are allowed.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "File exceeds 50 MB limit.";
  }
  return null;
}

function sendFile(
  file: File,
  onProgress: (value: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/photos/upload");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 80);
        onProgress(Math.min(80, Math.max(percent, 10)));
      }
    };

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        const finish = () => {
          try {
            const payload = JSON.parse(xhr.responseText ?? "{}");
            if (xhr.status >= 200 && xhr.status < 300) {
              onProgress(100);
              resolve(payload.result as UploadResponse);
            } else {
              reject(new Error(payload.error ?? "Upload failed"));
            }
          } catch {
            reject(new Error("Failed to parse upload response"));
          }
        };
        finish();
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during upload"));
    };

    const formData = new FormData();
    formData.append("file", file, file.name);
    xhr.send(formData);
  });
}
