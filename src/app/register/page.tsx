'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PublicHeader } from '@/components/layout/public-header';
import { apiClient } from '@/lib/api-client';
import { register } from '@/lib/api/shared/auth-api';

type SetupForm = { username: string; firstName: string; lastName: string; email: string; phone: string; password: string; confirmPassword: string };
const emptyForm: SetupForm = { username: '', firstName: '', lastName: '', email: '', phone: '', password: '', confirmPassword: '' };
const sample: SetupForm = { username: 'admin', firstName: 'مدیر', lastName: 'سامانه', email: '', phone: '', password: 'ChangeThisPassword123!', confirmPassword: 'ChangeThisPassword123!' };

export default function RegisterPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState(emptyForm);
  const [setupAllowed, setSetupAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiClient.get<{ hasUsers: boolean; isFirstInstall: boolean }>('/setup/status')
      .then((status) => { if (active) setSetupAllowed(status.isFirstInstall && !status.hasUsers); })
      .catch(() => { if (active) setSetupError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function downloadSample() {
    const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'rahyar-admin-sample.json';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as Partial<SetupForm>;
      setForm({
        username: typeof data.username === 'string' ? data.username : '',
        firstName: typeof data.firstName === 'string' ? data.firstName : '',
        lastName: typeof data.lastName === 'string' ? data.lastName : '',
        email: typeof data.email === 'string' ? data.email : '',
        phone: typeof data.phone === 'string' ? data.phone : '',
        password: typeof data.password === 'string' ? data.password : '',
        confirmPassword: typeof data.confirmPassword === 'string' ? data.confirmPassword : typeof data.password === 'string' ? data.password : '',
      });
      setError('');
    } catch {
      setError('فایل JSON معتبر نیست.');
    } finally {
      event.target.value = '';
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.password !== form.confirmPassword) { setError('تکرار رمز عبور مطابقت ندارد.'); return; }
    setSaving(true);
    setError('');
    try {
      await register({ username: form.username, firstName: form.firstName, lastName: form.lastName, email: form.email || undefined, phone: form.phone || undefined, password: form.password });
      router.replace('/rahcom');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ساخت حساب انجام نشد.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <section className="mx-auto w-full max-w-xl px-4 py-10">
        {loading ? <p className="py-16 text-center text-muted-foreground">در حال بررسی وضعیت سامانه…</p> : setupError ? (
          <div className="rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
            <h1 className="text-xl font-black">وضعیت ثبت‌نام بررسی نشد</h1>
            <p className="mt-3 text-sm text-muted-foreground">ارتباط با سرور برقرار نشد. پس از اتصال سرور دوباره تلاش کنید.</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-primary px-5 py-2.5 font-bold text-primary-foreground">تلاش دوباره</button>
          </div>
        ) : !setupAllowed ? (
          <div className="rounded-2xl border border-border bg-card p-7 text-center shadow-sm">
            <h1 className="text-xl font-black">حساب مالک سامانه ساخته شده است</h1>
            <p className="mt-3 text-sm text-muted-foreground">برای ورود به سامانه از صفحهٔ ورود استفاده کنید.</p>
            <Link href="/login" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 font-bold text-primary-foreground">رفتن به صفحهٔ ورود</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-center text-2xl font-black">ساخت حساب مالک سامانه</h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">این حساب، اولین و تنها حساب مالک سامانه خواهد بود.</p>
            {error && <p role="alert" className="mt-5 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
            <div className="mt-6 flex flex-wrap gap-2">
              <button type="button" onClick={downloadSample} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">دانلود فایل نمونهٔ JSON</button>
              <button type="button" onClick={() => fileInput.current?.click()} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">بارگذاری فایل JSON</button>
              <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={importJson} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {([
                ['username', 'نام کاربری', 'text'], ['firstName', 'نام', 'text'], ['lastName', 'نام خانوادگی', 'text'],
                ['email', 'ایمیل (اختیاری)', 'email'], ['phone', 'تلفن (اختیاری)', 'tel'], ['password', 'رمز عبور', 'password'], ['confirmPassword', 'تکرار رمز عبور', 'password'],
              ] as const).map(([key, label, type]) => (
                <label key={key} className="block text-sm font-medium">{label}
                  <input required={!['email', 'phone'].includes(key)} type={type} autoComplete={key === 'password' || key === 'confirmPassword' ? 'new-password' : 'off'} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 outline-none focus:border-primary" />
                </label>
              ))}
            </div>
            <button type="submit" disabled={saving} className="mt-6 w-full rounded-lg bg-primary py-2.5 font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">{saving ? 'در حال ساخت حساب…' : 'ساخت حساب مالک'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
