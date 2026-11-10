import { RemoteScreenEditor } from './RemoteScreenEditor';

export const metadata = {
  title: 'Edit a screen',
  description: 'Edit one of the household screens from this device.',
};

/** Edit another screen from a phone, over a live picture of it (#1153). */
export default async function EditScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RemoteScreenEditor id={id} />;
}
