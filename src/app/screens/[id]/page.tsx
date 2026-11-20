import { CanvasEditor } from '@/components/layout/CanvasEditor';

export const metadata = {
  title: 'Edit a screen',
  description: 'Edit one of the household screens from this device.',
};

/** Edit a named screen from another device, over a live picture of it (#1153). */
export default async function EditScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CanvasEditor screenId={id} />;
}
