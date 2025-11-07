"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/admin/(protected)/actions";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { toast } from "@/hooks/use-toast";

type AdminHeaderProps = {
  email?: string | null;
};

export function AdminHeader({ email }: AdminHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      try {
        await signOutAction();
        router.push("/admin/login");
        router.refresh();
      } catch (error) {
        toast({
          title: "Sign-out failed",
          description:
            error instanceof Error
              ? error.message
              : "Unexpected error while signing out",
        });
      }
    });
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Logo className="text-base sm:text-lg" />
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {email && <span className="hidden sm:inline">{email}</span>}
          <Button
            variant="ghost"
            className="inline-flex items-center gap-2"
            onClick={handleSignOut}
            disabled={isPending}
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden text-sm font-medium sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
