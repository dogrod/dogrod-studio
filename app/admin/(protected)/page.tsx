import { AppCard } from "@/components/admin/app-card";

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to dogrod Studio. Manage your apps below.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Apps</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AppCard
            title="Gallery"
            icon="images"
            href="/admin/gallery"
            externalLinks={[{ label: "Visit", url: "https://dogrod.com/gallery" }]}
          />
        </div>
      </section>
    </div>
  );
}
