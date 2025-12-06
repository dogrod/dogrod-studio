import Link from "next/link";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** When provided, makes the logo a clickable link. */
  href?: string;
};

export function Logo({ className = "", href }: LogoProps) {
  const content = (
    <span className={cn("text-lg font-semibold tracking-tight", className)}>
      dogrod&nbsp;<span className="font-normal text-muted-foreground">Studio</span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
