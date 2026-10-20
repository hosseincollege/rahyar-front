'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Check, LoaderCircle, Paintbrush, Upload } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { resolveOrganizationLogoUrl, settingsApi } from '@/lib/api/settings/settings-api';
import { uiMessage } from '@/lib/ui-messages';
import type { SaveOrganizationAppearance } from '@/lib/api/shared/preferences-api';

const accentOptions = [
  { id: 'blue', light: '#60a5fa', dark: '#3b82f6', label: 'آبی' },
  { id: 'green', light: '#4ade80', dark: '#22c55e', label: 'سبز' },
  { id: 'red', light: '#f87171', dark: '#ef4444', label: 'قرمز' },
  { id: 'amber', light: '#fde047', dark: '#facc15', label: 'کهربایی' },
  { id: 'violet', light: '#a78bfa', dark: '#8b5cf6', label: 'بنفش' },
] as const;

export function GeneralAppearanceSettings() {
  const {
    locale,
    organizationAppearance,
    canEditOrganizationAppearance,
    previewOrganizationAppearance,
    saveOrganizationAppearance,
  } = usePreferences();
  const [draft, setDraft] = useState<SaveOrganizationAppearance>({
    accentPreset: organizationAppearance.accentPreset,
    accentLightColor: organizationAppearance.accentLightColor,
    accentDarkColor: organizationAppearance.accentDarkColor,
    backgroundStyle: 'GRAY',
    timezone: 'Asia/Tehran',
    calendar: 'persian',
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [canEditLogo, setCanEditLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);

  useEffect(() => {
    setDraft({
      accentPreset: organizationAppearance.accentPreset,
      accentLightColor: organizationAppearance.accentLightColor,
      accentDarkColor: organizationAppearance.accentDarkColor,
      backgroundStyle: 'GRAY',
      timezone: 'Asia/Tehran',
      calendar: 'persian',
    });
  }, [organizationAppearance]);

  useEffect(() => {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;
    let active = true;
    void Promise.all([
      settingsApi.getOrganization(organizationId),
      settingsApi.getOrganizationAccess(organizationId),
    ]).then(([organization, access]) => {
      if (!active) return;
      setLogoUrl(organization.logoUrl || null);
      setCanEditLogo(access.canEdit);
    }).catch(() => {
      if (active) setNotice({ error: true, text: 'دریافت لوگو با خطا روبه‌رو شد.' });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!canEditOrganizationAppearance) return;
    previewOrganizationAppearance(draft);
    return () => previewOrganizationAppearance(null);
  }, [canEditOrganizationAppearance, draft, previewOrganizationAppearance]);

  const handleLogoUpload = async (file?: File) => {
    if (!file) return;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) {
      setNotice({ error: true, text: 'سازمان فعالی برای بارگذاری لوگو پیدا نشد.' });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const result = await settingsApi.uploadOrganizationLogo(organizationId, file);
      setLogoUrl(result.logoUrl);
      window.dispatchEvent(new Event('organization-branding-changed'));
      setNotice({ error: false, text: 'لوگو ذخیره شد.' });
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : 'بارگذاری لوگو انجام نشد.' });
    } finally {
      setUploading(false);
    }
  };

  const saveTheme = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await saveOrganizationAppearance({ ...draft, backgroundStyle: 'GRAY', timezone: 'Asia/Tehran', calendar: 'persian' });
      previewOrganizationAppearance(null);
      setNotice({ error: false, text: 'رنگ پوسته ذخیره شد.' });
    } catch {
      setNotice({ error: true, text: t('preferencesSaveFailed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section dir="rtl" className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-black text-foreground">تنظیمات عمومی</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">لوگو و رنگ پوستهٔ سامانه را مدیریت کنید.</p>
      </header>

      {notice && <p role={notice.error ? 'alert' : 'status'} className={`rounded-xl border p-3 text-sm ${notice.error ? 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-300' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'}`}>{notice.text}</p>}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground"><Upload size={17} className="text-primary" />لوگوی سامانه</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">فایل PNG، JPG یا WebP انتخاب کنید.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background p-2">
            {logoUrl ? <Image src={resolveOrganizationLogoUrl(logoUrl) || ''} alt="لوگوی سامانه" width={64} height={64} unoptimized className="h-full w-full object-contain" /> : <Paintbrush size={24} className="text-muted-foreground" />}
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { void handleLogoUpload(event.target.files?.[0]); event.target.value = ''; }} />
          <button type="button" disabled={!canEditLogo || uploading} onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50">
            {uploading && <LoaderCircle size={15} className="animate-spin" />}
            {uploading ? 'در حال بارگذاری…' : 'انتخاب لوگو'}
          </button>
          {!canEditLogo && <span className="text-xs text-muted-foreground">دسترسی ویرایش لوگو ندارید.</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground"><Paintbrush size={17} className="text-primary" />رنگ پوسته</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">رنگ اصلی سامانه را انتخاب کنید.</p>
        <fieldset disabled={!canEditOrganizationAppearance} className="mt-4 flex flex-wrap gap-2.5 disabled:opacity-60">
          {accentOptions.map((option) => {
            const selected = draft.accentPreset === option.id;
            return <button key={option.id} type="button" aria-pressed={selected} onClick={() => setDraft((current) => ({ ...current, accentPreset: option.id, accentLightColor: option.light, accentDarkColor: option.dark }))} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition ${selected ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}><span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: option.dark }} />{option.label}{selected && <Check size={15} className="text-primary" />}</button>;
          })}
          <label className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${draft.accentPreset === 'custom' ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border'}`}>
            <input type="color" aria-label="رنگ دلخواه" value={draft.accentLightColor} onChange={(event) => setDraft((current) => ({ ...current, accentPreset: 'custom', accentLightColor: event.target.value as `#${string}`, accentDarkColor: event.target.value as `#${string}` }))} className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0" />
            رنگ دلخواه
          </label>
        </fieldset>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">پس‌زمینه روی حالت خاکستری ثابت است.</p>
          <button type="button" disabled={!canEditOrganizationAppearance || saving} onClick={() => void saveTheme()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
            {saving && <LoaderCircle size={15} className="animate-spin" />}{saving ? t('preferencesSaving') : t('saveChanges')}
          </button>
        </div>
      </section>
    </section>
  );
}
