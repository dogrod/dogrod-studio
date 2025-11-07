import { cn } from "@/lib/utils";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={cn("text-lg font-semibold tracking-tight", className)}>
      dogrod&nbsp;<span className="font-normal text-muted-foreground">Studio</span>
    </span>
  );
}
