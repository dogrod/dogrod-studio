'use server';

import { createSupabaseServerClient } from "@/lib/supabase/server";

type PasswordPayload = {
  email: string;
  password: string;
};

type MagicLinkPayload = {
  email: string;
  redirectTo: string;
};

type PasswordResetPayload = {
  email: string;
  redirectTo: string;
};

export async function loginWithPasswordAction({ email, password }: PasswordPayload) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function sendMagicLinkAction({ email, redirectTo }: MagicLinkPayload) {
  const supabase = await createSupabaseServerClient();
  let resolvedRedirect: string;

  try {
    resolvedRedirect = new URL(redirectTo).toString();
  } catch {
    throw new Error("Magic link redirect URL must be absolute.");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: resolvedRedirect,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function sendPasswordResetAction({ email, redirectTo }: PasswordResetPayload) {
  const supabase = await createSupabaseServerClient();
  let resolvedRedirect: string;

  try {
    resolvedRedirect = new URL(redirectTo).toString();
  } catch {
    throw new Error("Password reset redirect URL must be absolute.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resolvedRedirect,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function updatePasswordAction(newPassword: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}
