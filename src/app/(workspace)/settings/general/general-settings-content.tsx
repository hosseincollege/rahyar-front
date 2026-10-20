'use client';

import { useEffect, useState } from 'react';
import { usePreferences, type BrightnessPreferences, type ContrastLevel, type ContrastPreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { useTheme } from '@/components/theme-provider';
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
    contrastPreferences,
    brightnessPreferences,
    organizationAppearance,
    canEditOrganizationAppearance,
    previewContrastPreferences,
    previewBrightnessPreferences,
    previewOrganizationAppearance,
    savePreferences,
    saveOrganizationAppearance,
  } = usePreferences();
  const { resolvedTheme } = useTheme();
  const [draftContrast, setDraftContrast] = useState<ContrastPreferences>(contrastPreferences);
  const [draftBrightness, setDraftBrightness] = useState<BrightnessPreferences>(brightnessPreferences);
  const [draftAppearance, setDraftAppearance] = useState<SaveOrganizationAppearance>(
    toSaveAppearance(organizationAppearance),
  );
  const [saveError, setSaveError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);

  useEffect(() => setDraftContrast(contrastPreferences), [contrastPreferences]);
  useEffect(() => setDraftBrightness(brightnessPreferences), [brightnessPreferences]);
  useEffect(() => setDraftAppearance(toSaveAppearance(organizationAppearance)), [organizationAppearance]);
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
    <div className="space-y-6" dir="rtl">
      <header>
        <h1 className="text-2xl font-black text-foreground">{message('settingsTitle')}</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">{message('settingsDescription')}</p>
      </header>

      <section className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-base font-bold text-foreground">{message('organizationAppearanceTitle')}</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{message('organizationAppearanceDescription')}</p>
          <p className="mt-2 rounded-xl border border-border bg-background px-3 py-2 text-xs leading-6 text-muted-foreground">
            {message(canEditOrganizationAppearance ? 'organizationAppearanceSharedNotice' : 'organizationAppearanceReadOnly')}
          </p>
        </div>

        <fieldset disabled={!canEditOrganizationAppearance} className="space-y-5 disabled:opacity-75">
          <div>
            <h3 className="text-sm font-bold text-foreground">{message('accentTitle')}</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{message('accentDescription')}</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              {accentOptions.map((option) => {
                const selected = draftAppearance.accentPreset === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setAccentPreset(option)}
                    className={`inline-flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${selected ? 'border-primary bg-primary-soft text-foreground ring-2 ring-primary/20' : 'border-border bg-background text-foreground hover:border-primary/50'}`}
                  >
                    <span className="flex gap-1" aria-hidden="true">
                      <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: resolvedTheme === 'dark' ? option.dark : option.light }} />
                      <span className="size-4 rounded-full border border-black/10" style={{ backgroundColor: resolvedTheme === 'dark' ? option.light : option.dark }} />
                    </span>
                    {message(option.message)}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={draftAppearance.accentPreset === 'custom'}
                onClick={() => setDraftAppearance((current) => ({ ...current, accentPreset: 'custom' }))}
                className={`rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition ${draftAppearance.accentPreset === 'custom' ? 'border-primary bg-primary-soft text-foreground ring-2 ring-primary/20' : 'border-border bg-background text-foreground hover:border-primary/50'}`}
              >
                {message('customColor')}
              </button>
            </div>
            {draftAppearance.accentPreset === 'custom' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([
                  ['accentLightColor', 'accentLightColor'],
                  ['accentDarkColor', 'accentDarkColor'],
                ] as const).map(([field, label]) => (
                  <label key={field} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3 text-sm font-medium text-foreground">
                    <span>{message(label)}</span>
                    <input
                      type="color"
                      aria-label={message(label)}
                      value={draftAppearance[field]}
                      onChange={(event) => setDraftAppearance((current) => ({ ...current, [field]: event.target.value as `#${string}` }))}
                      className="size-9 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-foreground">{message('backgroundStyleTitle')}</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">{message('backgroundStyleDescription')}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={message('backgroundStyleTitle')}>
              {(['GRAY', 'NAVY', 'THEME'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  role="radio"
                  aria-checked={draftAppearance.backgroundStyle === style}
                  onClick={() => setDraftAppearance((current) => ({ ...current, backgroundStyle: style }))}
                  className={`rounded-xl border p-3 text-start text-sm font-semibold transition ${draftAppearance.backgroundStyle === style ? 'border-primary bg-primary-soft text-foreground ring-2 ring-primary/20' : 'border-border bg-background text-foreground hover:border-primary/50'}`}
                >
                  {message(style === 'THEME' ? 'backgroundTheme' : style === 'NAVY' ? 'backgroundNavy' : 'backgroundGray')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">{message('calendarTitle')}</h3>
              <p className="mb-2 mt-1 text-xs leading-6 text-muted-foreground">{message('calendarDescription')}</p>
              <label className="block text-sm font-semibold text-foreground" htmlFor="organization-calendar">
                {message('calendarLabel')}
              <select
                id="organization-calendar"
                value={draftAppearance.calendar}
                onChange={(event) => setDraftAppearance((current) => ({ ...current, calendar: event.target.value as SaveOrganizationAppearance['calendar'] }))}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="persian">{message('calendarPersian')}</option>
                <option value="islamic">{message('calendarIslamic')}</option>
                <option value="gregorian">{message('calendarGregorian')}</option>
              </select>
              </label>
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">{message('timezoneTitle')}</h3>
              <p className="mb-2 mt-1 text-xs leading-6 text-muted-foreground">{message('timezoneDescription')}</p>
              <label className="block text-sm font-semibold text-foreground" htmlFor="organization-timezone">
                {message('timezoneLabel')}
              <select
                id="organization-timezone"
                dir="ltr"
                value={draftAppearance.timezone}
                onChange={(event) => setDraftAppearance((current) => ({ ...current, timezone: event.target.value }))}
                className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {!timezones.includes(draftAppearance.timezone) && <option value={draftAppearance.timezone}>{draftAppearance.timezone}</option>}
                {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
              </select>
              </label>
            </div>
          </div>
        </fieldset>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-bold text-foreground">{message('brightnessTitle')}</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{message('brightnessDescription')}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {brightnessModes.map((mode) => (
            <div key={mode.id}>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{message(mode.message)}</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label={message(mode.message)}>
                {brightnessOptions[mode.id].map((option) => {
                  const selected = draftBrightness[mode.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraftBrightness((current) => ({ ...current, [mode.id]: option.id }))}
                      className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${selected ? 'border-primary bg-primary-soft text-primary ring-2 ring-primary/20' : 'border-border bg-background text-foreground hover:border-primary/50'}`}
                    >
                      {message(option.message)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-bold text-foreground">{message('contrastTitle')}</h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">{message('contrastDescription')}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {brightnessModes.map((mode) => (
            <div key={mode.id}>
              <h3 className="mb-2 text-sm font-semibold text-foreground">{message(mode.message)}</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label={message(mode.message)}>
                {contrastOptions.map((option) => {
                  const selected = draftContrast[mode.id] === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraftContrast((current) => ({ ...current, [mode.id]: option.id }))}
                      className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors ${selected ? 'border-primary bg-primary-soft text-primary ring-2 ring-primary/20' : 'border-border bg-background text-foreground hover:border-primary/50'}`}
                    >
                      {message(option.message)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-bold text-foreground">{message('languageTitle')}</h2>
        <p className="mt-2 text-sm font-semibold text-foreground">فارسی</p>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={isSaving}
          onClick={async () => {
            setIsSaving(true);
            setSaveError(false);
            try {
              await savePreferences({ locale: 'fa', contrastPreferences: draftContrast, brightnessPreferences: draftBrightness });
              if (canEditOrganizationAppearance) await saveOrganizationAppearance(draftAppearance);
              previewContrastPreferences(null);
              previewOrganizationAppearance(null);
            } catch {
              setSaveError(true);
            } finally {
              setIsSaving(false);
            }
          }}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary-hover"
        >
          {isSaving ? message('preferencesSaving') : message('saveChanges')}
        </button>
      </div>
      {saveError && <p role="alert" className="text-sm text-red-600">{message('preferencesSaveFailed')}</p>}
    </div>
  );
}
