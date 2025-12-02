"use client";

import Image from "next/image";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PhotoLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  alt?: string;
  title?: string;
}

export function PhotoLightbox({
  open,
  onOpenChange,
  src,
  alt = "Photo",
  title,
}: PhotoLightboxProps) {
  if (!src) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[75vw] max-h-[75vh] w-fit p-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{title || "Photo preview"}</DialogTitle>
        </DialogHeader>
        <div className="relative flex items-center justify-center max-w-[75vw] max-h-[75vh]">
          <Image
            src={src}
            alt={alt}
            width={1920}
            height={1080}
            className="object-contain max-w-[75vw] max-h-[75vh] w-auto h-auto"
            priority
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

