import { SiteHeader } from "@/components/site-header";

type AdminHeaderProps = {
  email?: string | null;
};

/**
 * Admin header wrapper that uses the shared SiteHeader component.
 * Shows user email and sign out controls.
 */
export function AdminHeader({ email }: AdminHeaderProps) {
  return <SiteHeader email={email} />;
}
