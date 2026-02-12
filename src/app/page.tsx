import { DashboardClient } from './DashboardClient';

export const metadata = {
  title: 'Dashboard',
  description: 'Your family dashboard - view calendars, tasks, weather, and more.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <DashboardClient />
    </main>
  );
}
