"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { reprocessPhotoAction } from "@/app/admin/(protected)/gallery/photos/[photo-id]/actions";

interface PhotoProcessingStatusProps {
  photoId: string;
  status: string;
  blurhash: string | null;
  dominantColor: string | null;
  hasHistogram: boolean;
  hasRenditions: boolean;
}

/**
 * Determines if a photo needs reprocessing based on its state.
 * A photo needs reprocessing if:
 * - Status is not "published"
 * - OR key derived fields are missing (blurhash, dominant_color)
 * - OR renditions/histogram are missing
 */
function needsReprocessing(props: PhotoProcessingStatusProps): boolean {
  const { status, blurhash, dominantColor, hasHistogram, hasRenditions } = props;
  
  if (status !== "published") {
    return true;
  }
  if (!blurhash || !dominantColor) {
    return true;
  }
  if (!hasHistogram || !hasRenditions) {
    return true;
  }
  return false;
}

function getStatusInfo(props: PhotoProcessingStatusProps): {
  title: string;
  description: string;
  variant: "warning" | "info";
} {
  const { status, blurhash, dominantColor, hasHistogram, hasRenditions } = props;
  
  const missingItems: string[] = [];
  if (!blurhash) missingItems.push("blurhash");
  if (!dominantColor) missingItems.push("dominant color");
  if (!hasHistogram) missingItems.push("histogram");
  if (!hasRenditions) missingItems.push("renditions");

  if (status === "draft") {
    return {
      title: "Photo Processing Incomplete",
      description: `This photo was uploaded but processing did not complete successfully. Missing: ${missingItems.join(", ") || "final status update"}.`,
      variant: "warning",
    };
  }

  if (missingItems.length > 0) {
    return {
      title: "Photo Data Incomplete",
      description: `Some photo data is missing: ${missingItems.join(", ")}. Click reprocess to regenerate.`,
      variant: "info",
    };
  }

  return {
    title: "Processing Required",
    description: "This photo needs to be reprocessed.",
    variant: "warning",
  };
}

export function PhotoProcessingStatus(props: PhotoProcessingStatusProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  if (!needsReprocessing(props)) {
    return null;
  }

  const statusInfo = getStatusInfo(props);

  const handleReprocess = async () => {
    setIsProcessing(true);
    setIsComplete(false);

    try {
      await reprocessPhotoAction({ photoId: props.photoId });
      setIsComplete(true);
      toast({
        title: "Processing Complete",
        description: "Photo has been successfully reprocessed.",
      });
    } catch (error) {
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "An error occurred during reprocessing.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isComplete) {
    return (
      <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 p-4 dark:bg-emerald-950">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
            Processing Complete
          </h3>
        </div>
        <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-4">
          Photo has been successfully reprocessed. Refresh the page to see updated data.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="border-emerald-600 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400 dark:text-emerald-300 dark:hover:bg-emerald-900"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Page
        </Button>
      </div>
    );
  }

  const isWarning = statusInfo.variant === "warning";

  return (
    <div className={
      isWarning
        ? "rounded-lg border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950"
        : "rounded-lg border-2 border-blue-500 bg-blue-50 p-4 dark:bg-blue-950"
    }>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className={
          isWarning
            ? "h-5 w-5 text-amber-600 dark:text-amber-400"
            : "h-5 w-5 text-blue-600 dark:text-blue-400"
        } />
        <h3 className={
          isWarning
            ? "text-base font-semibold text-amber-800 dark:text-amber-200"
            : "text-base font-semibold text-blue-800 dark:text-blue-200"
        }>
          {statusInfo.title}
        </h3>
      </div>
      <p className={
        isWarning
          ? "text-sm text-amber-700 dark:text-amber-300 mb-4"
          : "text-sm text-blue-700 dark:text-blue-300 mb-4"
      }>
        {statusInfo.description}
      </p>
      <Button
        size="sm"
        onClick={handleReprocess}
        disabled={isProcessing}
        className={
          isWarning
            ? "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            : "border-blue-600 text-blue-700 hover:bg-blue-100 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-900"
        }
        variant={isWarning ? "default" : "outline"}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Reprocessing...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reprocess Photo
          </>
        )}
      </Button>
    </div>
  );
}
