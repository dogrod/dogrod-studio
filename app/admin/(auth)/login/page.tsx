import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getSession();

  if (session?.user) {
    redirect("/admin");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/60 shadow-sm">
        <CardHeader className="space-y-4">
          <Logo className="text-xl" />
          <div className="space-y-1">
            <CardTitle className="text-2xl">Admin access</CardTitle>
            <CardDescription>
              Sign in with your Supabase Auth credentials to manage the gallery.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <LoginForm />
          <p className="text-xs text-muted-foreground">
            Need access? Add a user in Supabase Auth. No roles required—any authenticated user gains admin privileges.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
