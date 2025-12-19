"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  if (!content?.trim()) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center text-muted-foreground",
          className
        )}
      >
        <p className="text-sm">Start writing to see the preview...</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <article
        className={cn(
          // Base prose styling
          "prose prose-lg dark:prose-invert max-w-none",
          // Typography
          "font-serif",
          // Headings
          "prose-headings:font-sans prose-headings:font-semibold prose-headings:tracking-tight",
          "prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl",
          // Paragraphs
          "prose-p:leading-relaxed",
          // Links
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          // Code
          "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-sm",
          "prose-pre:bg-muted prose-pre:font-mono",
          // Blockquotes
          "prose-blockquote:border-l-primary prose-blockquote:not-italic",
          // Images
          "prose-img:rounded-lg prose-img:shadow-md",
          // Lists
          "prose-li:marker:text-muted-foreground",
          // Padding for scroll area
          "p-6"
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Custom link handling to open in new tab
            a: ({ href, children, ...props }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              >
                {children}
              </a>
            ),
            // Custom image handling
            img: ({ src, alt, ...props }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt || ""}
                loading="lazy"
                {...props}
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </ScrollArea>
  );
}
