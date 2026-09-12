'use client';

/**
 * Sign-in page for the authentication wall (#339).
 *
 * Prism has never had one: signing in happens through QuickPinModal, opened
 * over whatever you were already looking at. That works because the page
 * underneath is served to anyone. With the wall on there is no page underneath,
 * so the proxy needs somewhere to send a browser, and this is it.
 *
 * The modal is reused rather than reimplemented — same member list, same pad,
 * same lockout handling — just always open and not dismissible, since there is
 * nothing behind it to dismiss to.
 */
import { Suspense, useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QuickPinModal, type QuickPinMember } from '@/components/auth';

function LoginPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(true);

  const onAuthenticated = useCallback((_user: QuickPinMember) => {
    // Only ever return to a path on this instance. `next` arrives from the
    // query string, so treating it as a URL would let a crafted link bounce
    // someone off to another origin straight after they signed in.
    const next = params.get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    router.replace(safe);
    router.refresh();
  }, [params, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Prism</h1>
        <p className="mt-2 text-muted-foreground">Sign in to continue</p>
      </div>

      <QuickPinModal
        open={open}
        onOpenChange={(next) => setOpen(next || true)}
        title="Sign in"
        description="This display requires a sign-in."
        onAuthenticated={onAuthenticated}
      />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}
