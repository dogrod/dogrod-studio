"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar as CalendarIcon, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { geocodePhotoAction, updatePhotoAction } from "@/app/admin/(protected)/gallery/photos/[photo-id]/actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import type { PhotoDetail, Tag } from "@/types/photos";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(4000).optional(),
  capturedAt: z.date().nullable(),
  placeName: z.string().max(255).optional(),
  city: z.string().max(255).optional(),
  region: z.string().max(255).optional(),
  country: z.string().max(255).optional(),
  isVisible: z.boolean(),
  tagIds: z.array(z.string()),
});

type FormValues = z.infer<typeof formSchema>;

interface PhotoDetailFormProps {
  photo: PhotoDetail;
  allTags: Tag[];
}

export function PhotoDetailForm({ photo, allTags }: PhotoDetailFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Check if we can show the geocode button:
  // - Has coordinates
  // - All location fields are empty
  const hasCoordinates = photo.latitude !== null && photo.longitude !== null;
  const hasNoLocationInfo =
    !photo.place_name && !photo.city && !photo.region && !photo.country;
  const canGeocode = hasCoordinates && hasNoLocationInfo;

  const isFormLocked = isPending || isGeocoding;

  const defaultValues: FormValues = useMemo(
    () => ({
      title: photo.title ?? "",
      description: photo.description ?? "",
      capturedAt: photo.captured_at ? new Date(photo.captured_at) : null,
      placeName: photo.place_name ?? "",
      city: photo.city ?? "",
      region: photo.region ?? "",
      country: photo.country ?? "",
      isVisible: photo.is_visible,
      tagIds: photo.tags.map((tag) => tag.id),
    }),
    [photo],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      try {
        await updatePhotoAction({
          photoId: photo.id,
          title: normalizeField(values.title),
          description: normalizeField(values.description),
          capturedAt: values.capturedAt ? values.capturedAt.toISOString() : null,
          placeName: normalizeField(values.placeName),
          city: normalizeField(values.city),
          region: normalizeField(values.region),
          country: normalizeField(values.country),
          isVisible: values.isVisible,
          tagIds: Array.from(new Set(values.tagIds)),
        });

        toast({
          title: "Photo updated",
          description: "Changes saved successfully.",
        });

        router.refresh();
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to save",
          description:
            error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    });
  };

  const handleGeocode = async () => {
    setIsGeocoding(true);
    try {
      await geocodePhotoAction({ photoId: photo.id });
      toast({
        title: "Location generated",
        description: "Location information has been filled from GPS coordinates.",
      });
      router.refresh();
    } catch (error) {
      console.error(error);
      toast({
        title: "Unable to generate location",
        description:
          error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <fieldset className="space-y-6 rounded-lg border bg-card p-6" disabled={isFormLocked}>
          <legend className="px-1 text-sm font-semibold uppercase text-muted-foreground">Details</legend>

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Add a title" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    placeholder="Describe the story behind this photo"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="capturedAt"
            render={({ field }) => (
              <FormItem className="flex flex-col gap-2">
                <FormLabel>Captured at</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      className={`justify-start text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? formatDate(field.value) : "Select a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ?? undefined}
                      onSelect={(date) => field.onChange(date ?? null)}
                      initialFocus
                      captionLayout="dropdown"
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="placeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Place name</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g., Yosemite Valley" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input placeholder="City" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input placeholder="Region / State" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input placeholder="Country" {...field} value={field.value ?? ""} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {canGeocode && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={handleGeocode}
              disabled={isGeocoding}
            >
              <MapPin className="h-4 w-4" />
              {isGeocoding ? "Generating..." : "Generate Location Info"}
            </Button>
          )}

          <FormField
            control={form.control}
            name="isVisible"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="space-y-0.5">
                  <FormLabel>Visible</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Toggle to control whether this photo appears in public listings.
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tagIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <div className="grid gap-2">
                  {allTags.length === 0 && (
                    <p className="text-sm text-muted-foreground">No tags available. Create tags in Supabase to assign them here.</p>
                  )}
                  {allTags.map((tag) => {
                    const isChecked = field.value.includes(tag.id);
                    return (
                      <label key={tag.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const next = checked
                              ? [...field.value, tag.id]
                              : field.value.filter((value) => value !== tag.id);
                            field.onChange(next);
                          }}
                        />
                        <span>{tag.name}</span>
                      </label>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>

        <div className="flex items-center justify-end gap-3">
          <Button type="submit" disabled={isFormLocked}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function normalizeField(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
