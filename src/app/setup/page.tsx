import { redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { SetupWizard } from './SetupWizard';

export const metadata = {
  title: 'Setup — Prism',
};

export default async function SetupPage() {
  // Check if setup is already complete
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, 'setupComplete'));
    if (row) {
      redirect('/');
    }
  } catch {
    // DB not ready yet — still show the wizard
  }

  return <SetupWizard />;
}
