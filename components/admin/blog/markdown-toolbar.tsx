"use client";

import { useCallback, type RefObject } from "react";
import {
  Bold,
  Italic,
  Link,
  Quote,
  Code,
  Image,
  List,
  ListOrdered,
  Heading2,
  Heading3,
  Minus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onInsert: (text: string) => void;
  onWrap: (before: string, after: string) => void;
  disabled?: boolean;
  className?: string;
}

interface ToolbarButton {
  icon: React.ElementType;
  label: string;
  shortcut?: string;
  action: "wrap" | "insert" | "line";
  before?: string;
  after?: string;
  text?: string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {
    icon: Bold,
    label: "Bold",
    shortcut: "Ctrl+B",
    action: "wrap",
    before: "**",
    after: "**",
  },
  {
    icon: Italic,
    label: "Italic",
    shortcut: "Ctrl+I",
    action: "wrap",
    before: "_",
    after: "_",
  },
  {
    icon: Heading2,
    label: "Heading 2",
    action: "line",
    before: "## ",
  },
  {
    icon: Heading3,
    label: "Heading 3",
    action: "line",
    before: "### ",
  },
  {
    icon: Link,
    label: "Link",
    shortcut: "Ctrl+K",
    action: "wrap",
    before: "[",
    after: "](url)",
  },
  {
    icon: Quote,
    label: "Quote",
    action: "line",
    before: "> ",
  },
  {
    icon: Code,
    label: "Code",
    action: "wrap",
    before: "`",
    after: "`",
  },
  {
    icon: List,
    label: "Bullet List",
    action: "line",
    before: "- ",
  },
  {
    icon: ListOrdered,
    label: "Numbered List",
    action: "line",
    before: "1. ",
  },
  {
    icon: Minus,
    label: "Horizontal Rule",
    action: "insert",
    text: "\n---\n",
  },
  {
    icon: Image,
    label: "Image",
    action: "insert",
    text: "![alt text](image-url)",
  },
];

export function MarkdownToolbar({
  textareaRef,
  onInsert,
  onWrap,
  disabled,
  className,
}: MarkdownToolbarProps) {
  const handleAction = useCallback(
    (button: ToolbarButton) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = textarea.value.substring(start, end);

      if (button.action === "wrap" && button.before && button.after) {
        const wrappedText = selectedText || "text";
        onWrap(button.before + wrappedText + button.after, "");
      } else if (button.action === "line" && button.before) {
        // Find the start of the current line
        const beforeCursor = textarea.value.substring(0, start);
        const lineStart = beforeCursor.lastIndexOf("\n") + 1;
        const lineContent = textarea.value.substring(lineStart, end);
        
        // Check if line already has this prefix
        if (lineContent.startsWith(button.before)) {
          return; // Already formatted
        }
        
        onInsert(button.before);
      } else if (button.action === "insert" && button.text) {
        onInsert(button.text);
      }

      // Refocus textarea
      setTimeout(() => textarea.focus(), 0);
    },
    [textareaRef, onInsert, onWrap]
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "flex items-center gap-0.5 border-b bg-muted/30 px-2 py-1",
          className
        )}
      >
        {TOOLBAR_BUTTONS.map((button) => (
          <Tooltip key={button.label}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={disabled}
                onClick={() => handleAction(button)}
              >
                <button.icon className="h-4 w-4" />
                <span className="sr-only">{button.label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {button.label}
                {button.shortcut && (
                  <span className="ml-2 text-muted-foreground">
                    {button.shortcut}
                  </span>
                )}
              </p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
