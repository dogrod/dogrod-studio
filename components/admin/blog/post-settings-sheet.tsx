"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Globe, Plus, ExternalLink, Calendar } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { createTranslationAction } from "@/app/admin/(protected)/blog/[post-id]/actions";
import { CoverImageSelector } from "@/components/admin/blog/cover-image-selector";
import { TagInput, type TagOption } from "@/components/admin/tag-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { PostDetail, PostLanguage, TranslationLink, PhotoPickerItem } from "@/types/posts";
import type { AssetWithRenditions } from "@/types/photos";

interface PostSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: UseFormReturn<{
    title: string;
    slug: string;
    excerpt?: string;
    content?: string;
    coverAssetId: string;
    galleryPhotoId: string | null;
    status: "draft" | "published" | "archived";
    visibility: "public" | "unlisted" | "private";
    language: "zh-CN" | "en-US";
    tagIds: string[];
  }>;
  post: PostDetail | null;
  isNewPost: boolean;
  isFormLocked: boolean;
  // Tag management
  tagOptions: TagOption[];
  onTagCreated: (tag: TagOption) => void;
  // Cover image management
  selectedAsset: AssetWithRenditions | null;
  selectedPhotoId: string | null;
  onPhotoSelect: (photo: PhotoPickerItem) => void;
  onClearCover: () => void;
  // Slug validation
  slugChecking: boolean;
  slugAvailable: boolean | null;
  onSlugCheck: (slug: string) => void;
  // Translations
  translations?: TranslationLink[];
}

const LANGUAGE_LABELS: Record<PostLanguage, string> = {
  "zh-CN": "中文 (Chinese)",
  "en-US": "English",
};

const LANGUAGE_SHORT: Record<PostLanguage, string> = {
  "zh-CN": "中文",
  "en-US": "EN",
};

export function PostSettingsSheet({
  open,
  onOpenChange,
  form,
  post,
  isNewPost,
  isFormLocked,
  tagOptions,
  onTagCreated,
  selectedAsset,
  selectedPhotoId,
  onPhotoSelect,
  onClearCover,
  slugChecking,
  slugAvailable,
  onSlugCheck,
  translations = [],
}: PostSettingsSheetProps) {
  const router = useRouter();
  const [isCreatingTranslation, startTransition] = useTransition();
  const [creatingLanguage, setCreatingLanguage] = useState<PostLanguage | null>(null);

  const currentLanguage = post?.language ?? form.getValues("language");
  const existingLanguages = new Set([
    currentLanguage,
    ...translations.map((t) => t.language),
  ]);
  const missingLanguages: PostLanguage[] = (["zh-CN", "en-US"] as PostLanguage[]).filter(
    (lang) => !existingLanguages.has(lang)
  );

  const handleCreateTranslation = (targetLanguage: PostLanguage) => {
    if (!post) return;

    setCreatingLanguage(targetLanguage);
    startTransition(async () => {
      try {
        const result = await createTranslationAction({
          sourcePostId: post.id,
          targetLanguage,
        });

        toast({
          title: "Translation created",
          description: `A new ${LANGUAGE_LABELS[targetLanguage]} version has been created.`,
        });

        onOpenChange(false);
        router.push(`/admin/blog/${result.postId}`);
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to create translation",
          description:
            error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      } finally {
        setCreatingLanguage(null);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Post Settings</SheetTitle>
          <SheetDescription>
            Configure metadata, organization, and translations.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Section: General */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                General
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isFormLocked}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="published">Published</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isFormLocked}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="public">Public</SelectItem>
                          <SelectItem value="unlisted">Unlisted</SelectItem>
                          <SelectItem value="private">Private</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              {post?.published_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Published {format(new Date(post.published_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
              )}
            </div>

            <Separator />

            {/* Section: Identification */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Identification
              </h3>

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="post-slug"
                        disabled={isFormLocked}
                        onChange={(e) => {
                          field.onChange(e);
                        }}
                        onBlur={(e) => {
                          field.onBlur();
                          onSlugCheck(e.target.value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {slugChecking && "Checking availability..."}
                      {slugAvailable === true && (
                        <span className="text-emerald-600">✓ Available</span>
                      )}
                      {slugAvailable === false && (
                        <span className="text-destructive">✗ Already taken</span>
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="excerpt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Excerpt</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={3}
                        placeholder="Brief summary for listings and SEO..."
                        disabled={isFormLocked}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Section: Organization */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Organization
              </h3>

              {isNewPost && (
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Language</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isFormLocked}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="zh-CN">{LANGUAGE_LABELS["zh-CN"]}</SelectItem>
                          <SelectItem value="en-US">{LANGUAGE_LABELS["en-US"]}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Cannot be changed after creation.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="tagIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                      <TagInput
                        options={tagOptions}
                        value={field.value}
                        onChange={field.onChange}
                        onTagCreated={onTagCreated}
                        disabled={isFormLocked}
                        placeholder="Select or create tags..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Section: Assets */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Cover Image
              </h3>

              <FormField
                control={form.control}
                name="coverAssetId"
                render={() => (
                  <FormItem>
                    <FormControl>
                      <CoverImageSelector
                        selectedAsset={selectedAsset}
                        selectedPhotoId={selectedPhotoId}
                        onSelectPhoto={onPhotoSelect}
                        onClear={onClearCover}
                        disabled={isFormLocked}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Section: Translations (only for existing posts) */}
            {!isNewPost && post && (
              <>
                <Separator />

                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    <Globe className="h-4 w-4" />
                    Translations
                  </h3>

                  {/* Current Language */}
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">
                          {LANGUAGE_LABELS[currentLanguage]}
                        </span>
                        <p className="text-xs text-muted-foreground">Current version</p>
                      </div>
                      <Badge>{LANGUAGE_SHORT[currentLanguage]}</Badge>
                    </div>
                  </div>

                  {/* Other Translations */}
                  {translations.map((translation) => (
                    <div
                      key={translation.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <span className="text-sm font-medium">
                          {LANGUAGE_LABELS[translation.language]}
                        </span>
                        <p className="text-xs text-muted-foreground capitalize">
                          {translation.status}
                        </p>
                      </div>
                      <Link
                        href={`/admin/blog/${translation.id}`}
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        onClick={() => onOpenChange(false)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Edit
                      </Link>
                    </div>
                  ))}

                  {/* Add Translation Buttons */}
                  {missingLanguages.map((language) => (
                    <Button
                      key={language}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={isFormLocked || isCreatingTranslation}
                      onClick={() => handleCreateTranslation(language)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {isCreatingTranslation && creatingLanguage === language
                        ? "Creating..."
                        : `Add ${LANGUAGE_LABELS[language]}`}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
