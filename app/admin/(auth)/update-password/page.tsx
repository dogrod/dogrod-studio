import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { UpdatePasswordForm } from "@/components/admin/update-password-form";

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/60 shadow-sm">
        <CardHeader className="space-y-4">
          <Logo className="text-xl" />
          <div className="space-y-1">
            <CardTitle className="text-2xl">Set new password</CardTitle>
            <CardDescription>
              Enter your new password below to complete the password reset.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <UpdatePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}

