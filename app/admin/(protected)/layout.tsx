import type { ReactNode } from "react";

import { AdminHeader } from "@/components/admin/admin-header";
import { requireUser } from "@/lib/auth";

export default async function AdminProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="flex min-h-screen flex-col">
      <AdminHeader email={user.email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
