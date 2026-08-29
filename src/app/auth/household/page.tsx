'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';

function safeDestination(): string {
  const requested = new URLSearchParams(window.location.search).get('next');
  if (!requested || !requested.startsWith('/') || requested.includes('\\')) return '/';
  return new URL(requested, window.location.origin).origin === window.location.origin &&
    !requested.startsWith('//')
    ? requested
    : '/';
}

export default function HouseholdLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/household-auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Too many attempts. Try again in a few minutes.'
            : 'That password was not accepted.'
        );
        return;
      }

      window.location.replace(safeDestination());
    } catch {
      setError('The board could not be reached. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <section className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-7 flex flex-col items-center text-center">
          <Image src="/logo-prism.png" alt="Prism" width={72} height={72} priority />
          <h1 className="mt-4 text-2xl font-semibold">Blackmon Family Board</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the household password to continue.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="household-password" className="mb-2 block text-sm font-medium">
              Household password
            </label>
            <input
              id="household-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              className="h-12 w-full rounded-lg border bg-background px-4 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="h-12 w-full rounded-lg bg-primary px-4 font-medium text-primary-foreground transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Unlocking…' : 'Unlock board'}
          </button>
        </form>
      </section>
    </main>
  );
}
