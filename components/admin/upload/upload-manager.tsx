"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

interface UploadResponse {
  photoId: string;
  detailUrl: string;
}

export function UploadManager() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelectFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const items = files.map<UploadItem>((file) => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      status: "idle",
      progress: 0,
    }));

    setUploads((prev) => [...prev, ...items]);
    void processQueue(items);
    event.target.value = "";
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
            existing.id === item.id
              ? { ...existing, progress }
              : existing,
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UploadCloud className="h-5 w-5" /> Upload photos
          </CardTitle>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            multiple
            hidden
            onChange={handleSelectFiles}
          />
          <Button onClick={() => inputRef.current?.click()} className="sm:w-auto">
            Select files
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Supported formats: JPEG, PNG, WebP. Max size per file: 50 MB.</p>
          <p>
            Originals upload directly to Cloudflare R2. Renditions (thumb/list/detail) and histogram are processed server-side with sharp; EXIF metadata is extracted automatically.
          </p>
        </CardContent>
      </Card>

      {uploads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploads.map((item) => (
              <UploadRow key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      )}
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

function sendFile(file: File, onProgress: (value: number) => void): Promise<UploadResponse> {
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

function UploadRow({ item }: { item: UploadItem }) {
  const { name, size, status, progress, error, photoId } = item;
  const icon = getStatusIcon(status);

  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(size)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {icon}
          <span className="capitalize text-muted-foreground">{status}</span>
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded bg-muted">
        <div
          className={cn(
            "h-full transition-all",
            status === "error" ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${status === "error" ? 100 : progress}%` }}
        />
      </div>

      {status === "error" && error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {status === "success" && photoId && (
        <p className="text-xs text-emerald-600">
          Photo ID: <span className="font-mono">{photoId}</span>
        </p>
      )}
    </div>
  );
}

function getStatusIcon(status: UploadStatus) {
  switch (status) {
    case "uploading":
    case "processing":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
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
