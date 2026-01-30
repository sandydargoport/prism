'use client';

import dynamic from 'next/dynamic';

const Dashboard = dynamic(
  () => import('@/components/dashboard').then(mod => ({ default: mod.Dashboard })),
  { ssr: false, loading: () => <div className="min-h-screen bg-background" /> }
);

export function DashboardClient() {
  return (
    <Dashboard weatherLocation="Springfield, IL" />
  );
}
