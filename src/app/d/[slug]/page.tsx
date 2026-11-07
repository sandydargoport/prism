import { DashboardSlugClient } from './DashboardClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `${title} - Dashboard`,
    description: `${title} dashboard view`,
  };
}

export default async function DashboardSlugPage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <main className="min-h-fill bg-background">
      <DashboardSlugClient slug={slug} />
    </main>
  );
}
