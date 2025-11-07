"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Unlock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  loginWithPasswordAction,
  sendMagicLinkAction,
} from "@/app/admin/(auth)/actions";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const passwordSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type PasswordSchema = z.infer<typeof passwordSchema>;

const magicLinkSchema = z.object({
  email: z.string().email(),
});

type MagicLinkSchema = z.infer<typeof magicLinkSchema>;

export function LoginForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"password" | "magic">("password");

  const passwordForm = useForm<PasswordSchema>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { email: "", password: "" },
  });

  const magicForm = useForm<MagicLinkSchema>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  });

  const handlePasswordSubmit = passwordForm.handleSubmit(async (values) => {
    try {
      await loginWithPasswordAction(values);

      toast({
        title: "Welcome back",
        description: "You're signed in as admin",
      });
      router.push("/admin");
      router.refresh();
    } catch (error) {
      toast({
        title: "Unable to sign in",
        description:
          error instanceof Error ? error.message : "Unexpected sign-in error",
      });
    }
  });

  const handleMagicLinkSubmit = magicForm.handleSubmit(async ({ email }) => {
    try {
      const redirectTo = `${window.location.origin}/admin`;
      await sendMagicLinkAction({ email, redirectTo });

      toast({
        title: "Check your inbox",
        description: "Magic sign-in link sent successfully",
      });
    } catch (error) {
      toast({
        title: "Magic link failed",
        description:
          error instanceof Error ? error.message : "Unable to send magic link",
      });
    }
  });

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="password" className="gap-2">
          <Unlock className="h-4 w-4" /> Password
        </TabsTrigger>
        <TabsTrigger value="magic" className="gap-2">
          <Mail className="h-4 w-4" /> Magic link
        </TabsTrigger>
      </TabsList>

      <TabsContent value="password">
        <Form {...passwordForm}>
          <form className="space-y-4" onSubmit={handlePasswordSubmit}>
            <FormField
              control={passwordForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="w-full"
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
            >
              {passwordForm.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Form>
      </TabsContent>

      <TabsContent value="magic">
        <Form {...magicForm}>
          <form className="space-y-4" onSubmit={handleMagicLinkSubmit}>
            <FormField
              control={magicForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              className="w-full"
              type="submit"
              disabled={magicForm.formState.isSubmitting}
            >
              {magicForm.formState.isSubmitting
                ? "Sending link…"
                : "Send magic link"}
            </Button>
          </form>
        </Form>
      </TabsContent>
    </Tabs>
  );
}
