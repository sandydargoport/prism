import { CanvasEditor } from '@/components/layout/CanvasEditor';

export const metadata = {
  title: 'Edit a dashboard',
  description: 'Arrange a dashboard at the size of the screen that shows it.',
};

/** Edit a dashboard at a screen's size, from a device that is not a named screen (#1265). */
export default async function EditDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CanvasEditor dashboardId={id} />;
}
