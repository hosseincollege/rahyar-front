'use client';

import { useEffect, useState } from 'react';
import { localeOptions, usePreferences, type BrightnessPreferences, type ContrastLevel, type ContrastPreferences, type Locale } from '@/components/providers/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { useTheme } from '@/components/providers/theme';
import type { OrganizationAppearance, SaveOrganizationAppearance } from '@/lib/api/shared/preferences-api';

const accentOptions: Array<{
  id: Exclude<OrganizationAppearance['accentPreset'], 'custom'>;
  light: `#${string}`;
  dark: `#${string}`;
  message: 'blue' | 'green' | 'red' | 'yellow' | 'purple';
}> = [
  { id: 'blue', light: '#60a5fa', dark: '#3b82f6', message: 'blue' },
  { id: 'green', light: '#4ade80', dark: '#22c55e', message: 'green' },
  { id: 'red', light: '#f87171', dark: '#ef4444', message: 'red' },
  { id: 'amber', light: '#fde047', dark: '#facc15', message: 'yellow' },
  { id: 'violet', light: '#a78bfa', dark: '#8b5cf6', message: 'purple' },
];

const brightnessModes = [
  { id: 'light', message: 'lightContrast' },
  { id: 'dark', message: 'darkContrast' },
] as const;

const brightnessOptions: Record<'light' | 'dark', Array<{
  id: ContrastLevel;
  message: 'brightnessSoft' | 'brightnessBalanced' | 'brightnessStrong';
}>> = {
  light: [
    { id: 'strong', message: 'brightnessSoft' },
    { id: 'balanced', message: 'brightnessBalanced' },
    { id: 'soft', message: 'brightnessStrong' },
  ],
  dark: [
    { id: 'soft', message: 'brightnessSoft' },
    { id: 'balanced', message: 'brightnessBalanced' },
    { id: 'strong', message: 'brightnessStrong' },
  ],
};

const contrastOptions: Array<{ id: ContrastLevel; message: 'contrastSoft' | 'contrastBalanced' | 'contrastStrong' }> = [
  { id: 'soft', message: 'contrastSoft' },
  { id: 'balanced', message: 'contrastBalanced' },
  { id: 'strong', message: 'contrastStrong' },
];

const timezones = [
  'Asia/Tehran', 'UTC', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Tokyo',
  'Asia/Shanghai', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Australia/Sydney',
];

function toSaveAppearance(appearance: OrganizationAppearance): SaveOrganizationAppearance {
  return {
    accentPreset: appearance.accentPreset,
    accentLightColor: appearance.accentLightColor,
    accentDarkColor: appearance.accentDarkColor,
    backgroundStyle: appearance.backgroundStyle,
    timezone: appearance.timezone,
    calendar: appearance.calendar,
  };
}

export function GeneralSettingsContent() {
  const {
    locale,
    savedLocale,
    contrastPreferences,
    brightnessPreferences,
    organizationAppearance,
    canEditOrganizationAppearance,
    previewContrastPreferences,
    previewBrightnessPreferences,
    previewOrganizationAppearance,
    previewLocale,
    savePreferences,
    saveOrganizationAppearance,
  } = usePreferences();
  const { resolvedTheme } = useTheme();
  const [draftLocale, setDraftLocale] = useState<Locale>(savedLocale);
  const [draftContrast, setDraftContrast] = useState<ContrastPreferences>(contrastPreferences);
  const [draftBrightness, setDraftBrightness] = useState<BrightnessPreferences>(brightnessPreferences);
  const [draftAppearance, setDraftAppearance] = useState<SaveOrganizationAppearance>(
    toSaveAppearance(organizationAppearance),
  );
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setDraftLocale(savedLocale); });
    return () => { active = false; };
  }, [savedLocale]);
  useEffect(() => () => previewLocale(null), [previewLocale]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setDraftContrast(contrastPreferences); });
    return () => { active = false; };
  }, [contrastPreferences]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setDraftBrightness(brightnessPreferences); });
    return () => { active = false; };
  }, [brightnessPreferences]);
  useEffect(() => {
    let active = true;
    const nextAppearance = toSaveAppearance(organizationAppearance);
    queueMicrotask(() => { if (active) setDraftAppearance(nextAppearance); });
    return () => { active = false; };
  }, [organizationAppearance]);
  useEffect(() => {
    previewContrastPreferences(draftContrast);
    return () => previewContrastPreferences(null);
  }, [draftContrast, previewContrastPreferences]);
  useEffect(() => {
    previewBrightnessPreferences(draftBrightness);
    return () => previewBrightnessPreferences(null);
  }, [draftBrightness, previewBrightnessPreferences]);
  useEffect(() => {
    if (!canEditOrganizationAppearance) return;
    previewOrganizationAppearance(draftAppearance);
    return () => previewOrganizationAppearance(null);
  }, [canEditOrganizationAppearance, draftAppearance, previewOrganizationAppearance]);

  const setAccentPreset = (option: (typeof accentOptions)[number]) => {
    setDraftAppearance((current) => ({
      ...current,
      accentPreset: option.id,
      accentLightColor: option.light,
      accentDarkColor: option.dark,
    }));
  };

  return (
    <div className="space-y-3" dir={localeOptions.find((option) => option.id === locale)?.direction}>
      <h1 className="text-xl font-bold text-foreground">{message('settingsTitle')}</h1>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-foreground">{message('organizationAppearanceTitle')}</h2>
          {!canEditOrganizationAppearance && <span className="text-xs text-muted-foreground">{message('organizationAppearanceReadOnly')}</span>}
        </div>
        <fieldset disabled={!canEditOrganizationAppearance} className="grid gap-x-5 gap-y-4 lg:grid-cols-2 disabled:opacity-70">
          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{message('accentTitle')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {accentOptions.map((option) => {
                const selected = draftAppearance.accentPreset === option.id;
                return <button key={option.id} type="button" aria-label={message(option.message)} aria-pressed={selected} onClick={() => setAccentPreset(option)} className={`inline-flex h-9 items-center gap-2 rounded-lg border px-2.5 text-xs font-semibold transition ${selected ? 'border-primary bg-primary-soft text-foreground ring-1 ring-primary/20' : 'border-border bg-background text-foreground hover:border-primary/50'}`}>
                  <span className="flex gap-0.5" aria-hidden="true"><span className="size-3.5 rounded-full border border-black/10" style={{ backgroundColor: resolvedTheme === 'dark' ? option.dark : option.light }} /><span className="size-3.5 rounded-full border border-black/10" style={{ backgroundColor: resolvedTheme === 'dark' ? option.light : option.dark }} /></span>{message(option.message)}
                </button>;
              })}
              <button type="button" aria-pressed={draftAppearance.accentPreset === 'custom'} onClick={() => setDraftAppearance((current) => ({ ...current, accentPreset: 'custom' }))} className={`h-9 rounded-lg border px-2.5 text-xs font-semibold transition ${draftAppearance.accentPreset === 'custom' ? 'border-primary bg-primary-soft text-foreground ring-1 ring-primary/20' : 'border-border bg-background text-foreground hover:border-primary/50'}`}>{message('customColor')}</button>
            </div>
            {draftAppearance.accentPreset === 'custom' && <div className="mt-2 flex flex-wrap gap-2">{([
              ['accentLightColor', 'accentLightColor'], ['accentDarkColor', 'accentDarkColor'],
            ] as const).map(([field, label]) => <label key={field} className="flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-xs"><span>{message(label)}</span><input type="color" aria-label={message(label)} value={draftAppearance[field]} onChange={(event) => setDraftAppearance((current) => ({ ...current, [field]: event.target.value as `#${string}` }))} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /></label>)}</div>}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{message('backgroundStyleTitle')}</h3>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={message('backgroundStyleTitle')}>
              {(['GRAY', 'NAVY', 'THEME'] as const).map((style) => <button key={style} type="button" role="radio" aria-checked={draftAppearance.backgroundStyle === style} onClick={() => setDraftAppearance((current) => ({ ...current, backgroundStyle: style }))} className={`h-9 rounded-lg border px-2 text-xs font-semibold transition ${draftAppearance.backgroundStyle === style ? 'border-primary bg-primary-soft text-foreground ring-1 ring-primary/20' : 'border-border bg-background text-foreground hover:border-primary/50'}`}>{message(style === 'THEME' ? 'backgroundTheme' : style === 'NAVY' ? 'backgroundNavy' : 'backgroundGray')}</button>)}
            </div>
          </div>

          <label className="text-xs font-semibold text-muted-foreground" htmlFor="organization-calendar">{message('calendarTitle')}
            <select id="organization-calendar" value={draftAppearance.calendar} onChange={(event) => setDraftAppearance((current) => ({ ...current, calendar: event.target.value as SaveOrganizationAppearance['calendar'] }))} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="persian">{message('calendarPersian')}</option><option value="islamic">{message('calendarIslamic')}</option><option value="gregorian">{message('calendarGregorian')}</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground" htmlFor="organization-timezone">{message('timezoneTitle')}
            <select id="organization-timezone" dir="ltr" value={draftAppearance.timezone} onChange={(event) => setDraftAppearance((current) => ({ ...current, timezone: event.target.value }))} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              {!timezones.includes(draftAppearance.timezone) && <option value={draftAppearance.timezone}>{draftAppearance.timezone}</option>}{timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
            </select>
          </label>
        </fieldset>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-x-5 gap-y-4 lg:grid-cols-2">
          {([{ title: 'brightnessTitle', options: brightnessOptions, values: draftBrightness, update: setDraftBrightness }, { title: 'contrastTitle', options: { light: contrastOptions, dark: contrastOptions }, values: draftContrast, update: setDraftContrast }] as const).map((group) => <div key={group.title}>
            <h2 className="mb-2 text-sm font-bold text-foreground">{message(group.title)}</h2>
            <div className="grid gap-2 sm:grid-cols-2">{brightnessModes.map((mode) => <div key={mode.id} className="rounded-lg border border-border/70 bg-background/50 p-2">
              <h3 className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{message(mode.message)}</h3>
              <div className="flex gap-1" role="group" aria-label={`${message(group.title)}: ${message(mode.message)}`}>
                {group.options[mode.id].map((option) => { const selected = group.values[mode.id] === option.id; return <button key={option.id} type="button" aria-pressed={selected} onClick={() => group.update((current) => ({ ...current, [mode.id]: option.id }))} className={`min-h-8 flex-1 rounded-md border px-1.5 text-[11px] font-medium transition ${selected ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'}`}>{message(option.message)}</button>; })}
              </div>
            </div>)}</div>
          </div>)}

          <label htmlFor="display-language" className="text-xs font-semibold text-muted-foreground">{message('languageTitle')}
            <select id="display-language" value={draftLocale} onChange={(event) => { const nextLocale = event.target.value as Locale; setDraftLocale(nextLocale); previewLocale(nextLocale); }} className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm font-normal text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              {localeOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>

          <div className="flex flex-wrap items-end justify-between gap-3 lg:col-span-2">
            {saveError && <p role="alert" className="text-xs text-red-600">{message('preferencesSaveFailed')}</p>}
            <button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                setSaveError(false);
                try {
                  await savePreferences({ locale: draftLocale, contrastPreferences: draftContrast, brightnessPreferences: draftBrightness });
                  if (canEditOrganizationAppearance) await saveOrganizationAppearance(draftAppearance);
                  previewContrastPreferences(null);
                  previewOrganizationAppearance(null);
                  previewLocale(null);
                } catch {
                  setSaveError(true);
                } finally {
                  setIsSaving(false);
                }
              }}
              className="ms-auto rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60"
            >
              {isSaving ? message('preferencesSaving') : message('saveChanges')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
