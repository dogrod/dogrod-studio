"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";

import { quickCreateTagAction } from "@/app/admin/(protected)/tags/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getTagColorClass } from "@/types/tags";

export interface TagOption {
  id: string;
  name: string;
  slug: string | null;
  color: string | null;
}

interface TagInputProps {
  /** All available tags */
  options: TagOption[];
  /** Currently selected tag IDs */
  value: string[];
  /** Callback when selection changes */
  onChange: (value: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Allow creating new tags inline */
  allowCreate?: boolean;
  /** Callback when a new tag is created (to update options list) */
  onTagCreated?: (tag: TagOption) => void;
}

export function TagInput({
  options,
  value,
  onChange,
  placeholder = "Select tags...",
  disabled = false,
  allowCreate = true,
  onTagCreated,
}: TagInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Get selected tags as objects
  const selectedTags = options.filter((opt) => value.includes(opt.id));

  // Filter options based on search
  const filteredOptions = options.filter((opt) =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search term matches an existing tag
  const exactMatch = options.find(
    (opt) => opt.name.toLowerCase() === search.toLowerCase()
  );
  const canCreate = allowCreate && search.trim() && !exactMatch;

  const handleSelect = useCallback(
    (tagId: string) => {
      if (value.includes(tagId)) {
        onChange(value.filter((id) => id !== tagId));
      } else {
        onChange([...value, tagId]);
      }
    },
    [value, onChange]
  );

  const handleRemove = useCallback(
    (tagId: string) => {
      onChange(value.filter((id) => id !== tagId));
    },
    [value, onChange]
  );

  const handleCreate = useCallback(() => {
    if (!search.trim()) return;

    startTransition(async () => {
      try {
        const result = await quickCreateTagAction({ name: search.trim() });

        if (result.tag) {
          const newTag: TagOption = {
            id: result.tag.id,
            name: result.tag.name,
            slug: result.tag.slug,
            color: result.tag.color,
          };

          // Notify parent to update options
          if (onTagCreated) {
            onTagCreated(newTag);
          }

          // Select the new/existing tag
          if (!value.includes(result.tag.id)) {
            onChange([...value, result.tag.id]);
          }

          if (result.created) {
            toast({
              title: "Tag created",
              description: `"${result.tag.name}" has been added.`,
            });
          }
        }

        setSearch("");
      } catch (error) {
        console.error(error);
        toast({
          title: "Unable to create tag",
          description:
            error instanceof Error ? error.message : "An unexpected error occurred.",
        });
      }
    });
  }, [search, value, onChange, onTagCreated]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && canCreate) {
        e.preventDefault();
        handleCreate();
      }
    },
    [canCreate, handleCreate]
  );

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              {selectedTags.length > 0
                ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              ref={inputRef}
              placeholder="Search or create..."
              value={search}
              onValueChange={setSearch}
              onKeyDown={handleKeyDown}
            />
            <CommandList>
              <CommandEmpty>
                {canCreate ? (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isPending}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Plus className="h-4 w-4" />
                    {isPending ? "Creating..." : `Create "${search}"`}
                  </button>
                ) : (
                  "No tags found."
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((option) => {
                  const isSelected = value.includes(option.id);
                  return (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      onSelect={() => handleSelect(option.id)}
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div
                        className={cn(
                          "mr-2 h-2.5 w-2.5 rounded-full",
                          getTagColorClass(option.color)
                        )}
                      />
                      <span>{option.name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              {canCreate && filteredOptions.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={handleCreate} disabled={isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    {isPending ? "Creating..." : `Create "${search}"`}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected tags as pills */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1 pr-1"
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  getTagColorClass(tag.color)
                )}
              />
              {tag.name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(tag.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Remove {tag.name}</span>
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
