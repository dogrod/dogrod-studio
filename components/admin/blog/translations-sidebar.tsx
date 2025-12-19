"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Globe, Plus, ExternalLink } from "lucide-react";

import { createTranslationAction } from "@/app/admin/(protected)/blog/[post-id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import type { PostLanguage, TranslationLink } from "@/types/posts";

interface TranslationsSidebarProps {
  /** Current post ID */
  postId: string;
  /** Current post language */
  currentLanguage: PostLanguage;
  /** Existing translations (excluding current post) */
  translations: TranslationLink[];
}

const LANGUAGE_LABELS: Record<PostLanguage, string> = {
  "zh-CN": "中文",
  "en-US": "English",
};

const ALL_LANGUAGES: PostLanguage[] = ["zh-CN", "en-US"];

export function TranslationsSidebar({
  postId,
  currentLanguage,
  translations,
}: TranslationsSidebarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [creatingLanguage, setCreatingLanguage] = useState<PostLanguage | null>(null);

  // Find which languages are missing
  const existingLanguages = new Set([
    currentLanguage,
    ...translations.map((t) => t.language),
  ]);
  const missingLanguages = ALL_LANGUAGES.filter(
    (lang) => !existingLanguages.has(lang)
  );

  const handleCreateTranslation = (targetLanguage: PostLanguage) => {
    setCreatingLanguage(targetLanguage);
    startTransition(async () => {
      try {
        const result = await createTranslationAction({
          sourcePostId: postId,
          targetLanguage,
        });

        toast({
          title: "Translation created",
          description: `A new ${LANGUAGE_LABELS[targetLanguage]} version has been created.`,
        });

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          Translations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current language indicator */}
        <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
          <span className="text-sm font-medium">
            {LANGUAGE_LABELS[currentLanguage]}
          </span>
          <Badge variant="secondary" className="text-xs">
            Current
          </Badge>
        </div>

        {/* Existing translations */}
        {translations.map((translation) => (
          <div
            key={translation.id}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {LANGUAGE_LABELS[translation.language]}
              </span>
              <span className="text-xs text-muted-foreground capitalize">
                {translation.status}
              </span>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/admin/blog/${translation.id}`}>
                <ExternalLink className="mr-1 h-3 w-3" />
                Edit
              </Link>
            </Button>
          </div>
        ))}

        {/* Missing translations */}
        {missingLanguages.map((language) => (
          <Button
            key={language}
            variant="outline"
            size="sm"
            className="w-full justify-start"
            disabled={isPending}
            onClick={() => handleCreateTranslation(language)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isPending && creatingLanguage === language
              ? "Creating..."
              : `Add ${LANGUAGE_LABELS[language]}`}
          </Button>
        ))}

        {translations.length === 0 && missingLanguages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            All translations are available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
