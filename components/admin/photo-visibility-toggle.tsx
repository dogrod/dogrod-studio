"use client";

import { useEffect, useState, useTransition } from "react";

import { setPhotoVisibilityAction } from "@/app/admin/(protected)/actions";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

type PhotoVisibilityToggleProps = {
  photoId: string;
  initialVisible: boolean;
};

export function PhotoVisibilityToggle({
  photoId,
  initialVisible,
}: PhotoVisibilityToggleProps) {
  const [checked, setChecked] = useState(initialVisible);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setChecked(initialVisible);
  }, [initialVisible]);

  const handleChange = (value: boolean) => {
    setChecked(value);
    startTransition(async () => {
      try {
        await setPhotoVisibilityAction(photoId, value);
        toast({
          title: value ? "Photo visible" : "Photo hidden",
          description: value
            ? "This photo is now visible in admin listings."
            : "This photo is now hidden from public views.",
        });
      } catch (error) {
        console.error(error);
        setChecked((prev) => !prev);
        toast({
          title: "Unable to update visibility",
          description:
            error instanceof Error
              ? error.message
              : "Something went wrong while updating the photo.",
        });
      }
    });
  };

  return (
    <Switch
      checked={checked}
      onCheckedChange={handleChange}
      disabled={isPending}
      aria-label={checked ? "Hide photo" : "Show photo"}
    />
  );
}
