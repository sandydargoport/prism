'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const Dashboard = dynamic(
  () => import('@/components/dashboard').then(mod => ({ default: mod.Dashboard })),
  { loading: () => <div className="min-h-screen bg-background" /> }
);

export function DashboardClient() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Check setup status on first load; redirect to wizard if not complete
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => {
        if (!data.complete) {
          router.replace('/setup');
        } else {
          setChecked(true);
          const el = document.getElementById('ssr-placeholder');
          if (el) el.style.display = 'none';
        }
      })
      .catch(() => {
        // If check fails, proceed to dashboard anyway
        setChecked(true);
        const el = document.getElementById('ssr-placeholder');
        if (el) el.style.display = 'none';
      });
  }, [router]);

  if (!checked) return null;

  return <Dashboard />;
}
