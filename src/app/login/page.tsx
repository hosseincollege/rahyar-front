'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { PublicHeader } from '@/components/layout/public-header';
import { login } from '@/lib/api/shared/auth-api';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login({ email: identifier, password });
      router.replace('/rahcom');
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'نام کاربری یا رمز عبور نادرست است.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-center text-2xl font-black">ورود به رهیار</h1>
          {error && <p role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          <label className="mb-4 block text-sm font-medium">
            نام کاربری
            <input required autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary" />
          </label>
          <label className="mb-6 block text-sm font-medium">
            رمز عبور
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary" />
          </label>
          <button type="submit" disabled={loading} className="w-full rounded-lg bg-primary py-2.5 font-bold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? 'در حال ورود…' : 'ورود'}
          </button>
        </form>
      </section>
    </main>
  );
}
