"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, Images, Settings, Users, FileText } from "lucide-react";

import { Card } from "@/components/ui/card";

/** Available icon names for AppCard */
export type AppIconName = "images" | "settings" | "users" | "file-text";

const iconMap = {
  images: Images,
  settings: Settings,
  users: Users,
  "file-text": FileText,
} as const;

type AppCardLink = {
  /** Link label */
  label: string;
  /** Link URL */
  url: string;
};

type AppCardProps = {
  /** Title of the app */
  title: string;
  /** Icon name to display */
  icon: AppIconName;
  /** Link to navigate when card is clicked */
  href: string;
  /** Optional external links to display in the custom slot */
  externalLinks?: AppCardLink[];
  /** Custom content slot rendered below the title */
  children?: ReactNode;
};

export function AppCard({ title, icon, href, externalLinks, children }: AppCardProps) {
  const Icon = iconMap[icon];

  return (
    <Link href={href}>
      <Card className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 cursor-pointer">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <span className="font-medium">{title}</span>
          {externalLinks && externalLinks.length > 0 && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {externalLinks.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          )}
          {children && <div className="text-sm text-muted-foreground">{children}</div>}
        </div>
      </Card>
    </Link>
  );
}
