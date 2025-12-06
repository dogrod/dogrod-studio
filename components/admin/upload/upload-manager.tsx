"use client";

/**
 * Upload Manager - Direct R2 Upload with Presigned URLs
 *
 * Upload Flow:
 * 1. User selects/drops files
 * 2. (Optional) Calculate checksum and check for duplicates
 * 3. Client requests presigned URL from server (POST /api/admin/photos/upload/presign)
 * 4. Client uploads directly to R2 using presigned URL (PUT)
 * 5. Client notifies server upload is complete (POST /api/admin/photos/upload/complete)
 * 6. Server processes the image and returns photo details
 *
 * This approach bypasses Vercel's 4.5MB body size limit for Hobby plan.
 */

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

type UploadStatus =
  | "idle"
  | "checking"
  | "presigning"
  | "uploading"
  | "processing"
  | "success"
  | "skipped"
  | "error";

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

interface PresignResponse {
  uploadUrl: string;
  storageId: string;
  key: string;
  publicBaseUrl: string;
  expiresAt: string;
}

interface CompleteResponse {
  photoId: string;
  detailUrl: string;
}

interface ExistingPhoto {
  id: string;
  title: string | null;
  thumbUrl: string | null;
}

interface CheckDuplicateResponse {
  exists: boolean;
  existingPhoto: ExistingPhoto | null;
}

interface DuplicateConfirmState {
  isOpen: boolean;
  uploadItemId: string | null;
  fileName: string;
  existingPhoto: ExistingPhoto | null;
  resolve: ((shouldContinue: boolean) => void) | null;
}

export function UploadManager() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [duplicateConfirm, setDuplicateConfirm] = useState<DuplicateConfirmState>({
    isOpen: false,
    uploadItemId: null,
    fileName: "",
    existingPhoto: null,
    resolve: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const hasUploads = uploads.length > 0;

  // Handle duplicate confirmation dialog response
  const handleDuplicateConfirm = useCallback((shouldContinue: boolean) => {
    if (duplicateConfirm.resolve) {
      duplicateConfirm.resolve(shouldContinue);
    }
    setDuplicateConfirm({
      isOpen: false,
      uploadItemId: null,
      fileName: "",
      existingPhoto: null,
      resolve: null,
    });
  }, [duplicateConfirm]);

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
              : existing
          )
        );
        continue;
      }

      await uploadFile(item);
    }
  };

  const uploadFile = async (item: UploadItem) => {
    const updateStatus = (
      updates: Partial<Pick<UploadItem, "status" | "progress" | "error" | "photoId" | "detailUrl">>
    ) => {
      setUploads((prev) =>
        prev.map((existing) =>
          existing.id === item.id ? { ...existing, ...updates } : existing
        )
      );
    };

    try {
      // Step 0: Check for duplicates (optional, graceful degradation)
      const duplicateCheck = await checkForDuplicate(item, updateStatus);
      if (duplicateCheck.shouldSkip) {
        updateStatus({
          status: "skipped",
          progress: 0,
          error: "Duplicate photo skipped",
        });
        return;
      }

      // Step 1: Get presigned URL
      updateStatus({ status: "presigning", progress: 5 });

      const presignResponse = await fetch("/api/admin/photos/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: item.file.name,
          contentType: item.file.type,
          fileSize: item.file.size,
        }),
      });

      if (!presignResponse.ok) {
        const error = await presignResponse.json();
        throw new Error(error.error ?? "Failed to get upload URL");
      }

      const presignData: PresignResponse = await presignResponse.json();

      // Step 2: Upload directly to R2
      updateStatus({ status: "uploading", progress: 10 });

      await uploadToR2(item.file, presignData.uploadUrl, (progress) => {
        // Map 0-100 to 10-70 range for the R2 upload phase
        const mappedProgress = 10 + Math.round(progress * 0.6);
        updateStatus({ progress: mappedProgress });
      });

      // Step 3: Notify server and process
      updateStatus({ status: "processing", progress: 75 });

      const completeResponse = await fetch("/api/admin/photos/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageId: presignData.storageId,
          key: presignData.key,
          filename: item.file.name,
          contentType: item.file.type,
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.error ?? "Failed to process upload");
      }

      const completeData: CompleteResponse = await completeResponse.json();

      // Success
      updateStatus({
        status: "success",
        progress: 100,
        photoId: completeData.photoId,
        detailUrl: completeData.detailUrl,
      });

      toast({
        title: "Upload complete",
        description: `${item.name} processed successfully`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected upload error";
      updateStatus({
        status: "error",
        progress: 0,
        error: message,
      });
      toast({
        title: "Upload failed",
        description: message,
      });
    }
  };

  /**
   * Check for duplicate photos before uploading.
   * This is an optional step - if it fails for any reason (e.g., browser doesn't
   * support Web Crypto API, network error), we gracefully skip the check.
   */
  const checkForDuplicate = async (
    item: UploadItem,
    updateStatus: (updates: Partial<Pick<UploadItem, "status" | "progress">>) => void
  ): Promise<{ shouldSkip: boolean }> => {
    try {
      // Check if Web Crypto API is available (requires HTTPS or localhost)
      if (!crypto?.subtle?.digest) {
        console.log("[upload] Web Crypto API not available, skipping duplicate check");
        return { shouldSkip: false };
      }

      updateStatus({ status: "checking", progress: 2 });

      // Calculate SHA-256 checksum of the file
      const checksum = await calculateChecksum(item.file);

      // Check with server if this checksum exists
      const response = await fetch("/api/admin/photos/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checksum }),
      });

      if (!response.ok) {
        // API error - skip check and proceed with upload
        console.warn("[upload] Duplicate check API error, proceeding with upload");
        return { shouldSkip: false };
      }

      const data: CheckDuplicateResponse = await response.json();

      if (!data.exists) {
        // No duplicate found
        return { shouldSkip: false };
      }

      // Duplicate found - show confirmation dialog
      const shouldContinue = await new Promise<boolean>((resolve) => {
        setDuplicateConfirm({
          isOpen: true,
          uploadItemId: item.id,
          fileName: item.name,
          existingPhoto: data.existingPhoto,
          resolve,
        });
      });

      return { shouldSkip: !shouldContinue };
    } catch (error) {
      // Any error during duplicate check - gracefully skip and proceed
      console.warn("[upload] Duplicate check failed, proceeding with upload:", error);
      return { shouldSkip: false };
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
    <>
      <div className="space-y-8">
        {/* Drop Zone */}
        <div
          className={cn(
            "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30",
            hasUploads ? "py-12" : "py-20"
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
                isDragging ? "bg-primary/10" : "bg-muted"
              )}
            >
              <UploadCloud
                className={cn(
                  "h-10 w-10 transition-colors",
                  isDragging ? "text-primary" : "text-muted-foreground"
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

      {/* Duplicate Confirmation Dialog */}
      <DuplicateConfirmDialog
        isOpen={duplicateConfirm.isOpen}
        fileName={duplicateConfirm.fileName}
        existingPhoto={duplicateConfirm.existingPhoto}
        onConfirm={() => handleDuplicateConfirm(true)}
        onCancel={() => handleDuplicateConfirm(false)}
      />
    </>
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
  const isPending = status === "idle";
  const isLoading =
    status === "checking" ||
    status === "presigning" ||
    status === "uploading" ||
    status === "processing";
  const isSuccess = status === "success";
  const isError = status === "error";
  const isSkipped = status === "skipped";

  const imageUrl = detailUrl || previewUrl;

  const getStatusText = () => {
    switch (status) {
      case "checking":
        return "Checking...";
      case "presigning":
        return "Preparing...";
      case "uploading":
        return "Uploading...";
      case "processing":
        return "Processing...";
      default:
        return `${progress}%`;
    }
  };

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
            (isPending || isLoading) && "opacity-50 blur-[1px]"
          )}
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          unoptimized={!detailUrl}
        />
      )}

      {/* Pending Overlay */}
      {isPending && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <UploadCloud className="h-8 w-8 text-muted-foreground" />
          <span className="mt-2 text-sm font-medium text-muted-foreground">
            Pending Upload
          </span>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="mt-2 text-sm font-medium text-foreground">
            {getStatusText()}
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

      {/* Skipped Overlay */}
      {isSkipped && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-amber-500/90 p-3 text-center">
          <AlertTriangle className="h-8 w-8 text-white" />
          <span className="mt-2 text-xs font-medium text-white line-clamp-2">
            Duplicate skipped
          </span>
        </div>
      )}

      {/* Hover Overlay */}
      {(isSuccess || isError || isSkipped) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100">
          {isSuccess && photoId && (
            <Link
              href={`/admin/gallery/photos/${photoId}`}
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

/**
 * Upload file directly to R2 using presigned URL
 */
function uploadToR2(
  file: File,
  uploadUrl: string,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);

    // Set content type header
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`R2 upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during R2 upload"));
    };

    xhr.send(file);
  });
}

/**
 * Calculate SHA-256 checksum of a file using Web Crypto API.
 * Returns hex-encoded string matching the server-side calculation.
 */
async function calculateChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Duplicate Confirmation Dialog
 */
function DuplicateConfirmDialog({
  isOpen,
  fileName,
  existingPhoto,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  fileName: string;
  existingPhoto: ExistingPhoto | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Photo Detected
          </DialogTitle>
          <DialogDescription>
            The photo <span className="font-medium">{fileName}</span> appears to already exist in your gallery.
          </DialogDescription>
        </DialogHeader>

        {existingPhoto && (
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
            {existingPhoto.thumbUrl ? (
              <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                <Image
                  src={existingPhoto.thumbUrl}
                  alt={existingPhoto.title || "Existing photo"}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-md bg-muted flex-shrink-0 flex items-center justify-center">
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {existingPhoto.title || "Untitled"}
              </p>
              <Link
                href={`/admin/gallery/photos/${existingPhoto.id}`}
                className="text-xs text-primary hover:underline"
                target="_blank"
                onClick={(e) => e.stopPropagation()}
              >
                View existing photo →
              </Link>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Skip Upload
          </Button>
          <Button onClick={onConfirm}>
            Upload Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
