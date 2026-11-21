import { CanvasEditor } from '@/components/layout/CanvasEditor';

export const metadata = {
  title: 'Edit a screen',
  description: 'Edit one of the household screens over a live picture of it.',
};

/**
 * Edit a named screen over a live picture of it (#1153), from another device
 * or from the screen itself (#1280). `?dashboard=` opens it on that dashboard,
 * the one Edit was pressed on.
 */
export default async function EditScreenPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dashboard?: string | string[] }>;
}) {
  const { id } = await params;
  const { dashboard } = await searchParams;
  return <CanvasEditor screenId={id} startDashboardId={typeof dashboard === 'string' ? dashboard : undefined} />;
}
