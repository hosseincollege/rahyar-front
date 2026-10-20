'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { getLocaleDirection, type Locale } from '@/lib/languages';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import {
  preferencesApi,
  type OrganizationAppearance,
  type SaveOrganizationAppearance,
  type SaveUserPreferences,
} from '@/lib/api/shared/preferences-api';
import { getAccessToken } from '@/lib/api-client';

export {
  getLocaleDirection,
  localeOptions,
  supportedLocales,
} from '@/lib/languages';
export type { Locale } from '@/lib/languages';

export type ContrastLevel = 'soft' | 'balanced' | 'strong';
export type ContrastPreferences = { light: ContrastLevel; dark: ContrastLevel };
export type BrightnessPreferences = { light: ContrastLevel; dark: ContrastLevel };
export type CalendarSystem = 'persian' | 'islamic' | 'gregorian';
export type WorkspaceMode = 'form' | 'command' | 'ai';

type PreferencesContextValue = {
  locale: Locale;
  workspaceMode: WorkspaceMode;
  saveWorkspaceMode: (mode: WorkspaceMode) => Promise<void>;
  contrastPreferences: ContrastPreferences;
  brightnessPreferences: BrightnessPreferences;
  organizationAppearance: OrganizationAppearance;
  appearancePreview: SaveOrganizationAppearance | null;
  calendar: CalendarSystem;
  timezone: string;
  canEditOrganizationAppearance: boolean;
  contrastPreview: ContrastPreferences | null;
  brightnessPreview: BrightnessPreferences | null;
  previewContrastPreferences: (preferences: ContrastPreferences | null) => void;
  previewBrightnessPreferences: (preferences: BrightnessPreferences | null) => void;
  previewOrganizationAppearance: (appearance: SaveOrganizationAppearance | null) => void;
  savePreferences: (preferences: SaveUserPreferences) => Promise<void>;
  saveOrganizationAppearance: (appearance: SaveOrganizationAppearance) => Promise<void>;
};

const LOCALE_KEY = 'erp-locale';
const CONTRAST_KEY = 'erp-shell-contrast-v2';
const BRIGHTNESS_KEY = 'erp-shell-brightness';
const LEGACY_BRIGHTNESS_KEY = 'erp-shell-contrast';
const ORGANIZATION_APPEARANCE_KEY = 'erp-organization-appearance-v2';
const DEFAULT_CONTRAST = { light: 'balanced', dark: 'balanced' } as const satisfies ContrastPreferences;
const DEFAULT_CONTRAST_SNAPSHOT = JSON.stringify(DEFAULT_CONTRAST);
const DEFAULT_ORGANIZATION_APPEARANCE: OrganizationAppearance = {
  accentPreset: 'blue',
  accentLightColor: '#60a5fa',
  accentDarkColor: '#3b82f6',
  backgroundStyle: 'GRAY',
  timezone: 'Asia/Tehran',
  calendar: 'persian',
  canEdit: false,
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function subscribePreferences(callback: () => void) {
  window.addEventListener('erp-preferences-changed', callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener('erp-preferences-changed', callback);
    window.removeEventListener('storage', callback);
  };
}

function isContrastLevel(value: unknown): value is ContrastLevel {
  return value === 'soft' || value === 'balanced' || value === 'strong';
}

function parsePreferenceLevels<T extends { light: ContrastLevel; dark: ContrastLevel }>(value: string, defaults: T): T {
  try {
    const parsed = JSON.parse(value) as Partial<T>;
    return {
      ...defaults,
      light: isContrastLevel(parsed.light) ? parsed.light : defaults.light,
      dark: isContrastLevel(parsed.dark) ? parsed.dark : defaults.dark,
    } as T;
  } catch {
    return { ...defaults };
  }
}

function readContrastSnapshot(): string {
  try {
    return window.localStorage.getItem(CONTRAST_KEY) ?? DEFAULT_CONTRAST_SNAPSHOT;
  } catch {
    return DEFAULT_CONTRAST_SNAPSHOT;
  }
}

function readBrightnessSnapshot(): string {
  try {
    return window.localStorage.getItem(BRIGHTNESS_KEY)
      ?? window.localStorage.getItem(LEGACY_BRIGHTNESS_KEY)
      ?? DEFAULT_CONTRAST_SNAPSHOT;
  } catch {
    return DEFAULT_CONTRAST_SNAPSHOT;
  }
}

export function isHexColor(value: string | null): value is `#${string}` {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function readOrganizationAppearanceSnapshot(): string {
  try {
    const key = `${ORGANIZATION_APPEARANCE_KEY}:${getCurrentOrganizationId() ?? 'none'}`;
    return window.localStorage.getItem(key)
      ?? JSON.stringify(DEFAULT_ORGANIZATION_APPEARANCE);
  } catch {
    return JSON.stringify(DEFAULT_ORGANIZATION_APPEARANCE);
  }
}

function parseOrganizationAppearance(value: string): OrganizationAppearance {
  try {
    const parsed = JSON.parse(value) as Partial<OrganizationAppearance>;
    return {
      ...DEFAULT_ORGANIZATION_APPEARANCE,
      ...parsed,
      canEdit: parsed.canEdit === true,
      accentLightColor: isHexColor(parsed.accentLightColor ?? null)
        ? parsed.accentLightColor!
        : DEFAULT_ORGANIZATION_APPEARANCE.accentLightColor,
      accentDarkColor: isHexColor(parsed.accentDarkColor ?? null)
        ? parsed.accentDarkColor!
        : DEFAULT_ORGANIZATION_APPEARANCE.accentDarkColor,
      backgroundStyle: 'GRAY',
      timezone: 'Asia/Tehran',
      calendar: 'persian',
    };
  } catch {
    return { ...DEFAULT_ORGANIZATION_APPEARANCE };
  }
}

export function getOrganizationAccentStyle(
  appearance: Pick<OrganizationAppearance, 'accentLightColor' | 'accentDarkColor'>,
): CSSProperties & Record<
  '--accent-light' | '--accent-dark' | '--accent-light-foreground' | '--accent-dark-foreground',
  string
> {
  const foregroundFor = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    const darkContrast = (luminance + 0.05) / 0.05;
    const lightContrast = 1.05 / (luminance + 0.05);
    return darkContrast > lightContrast ? '#172033' : '#ffffff';
  };
  return {
    '--accent-light': appearance.accentLightColor,
    '--accent-dark': appearance.accentDarkColor,
    '--accent-light-foreground': foregroundFor(appearance.accentLightColor),
    '--accent-dark-foreground': foregroundFor(appearance.accentDarkColor),
  } as CSSProperties & Record<
    '--accent-light' | '--accent-dark' | '--accent-light-foreground' | '--accent-dark-foreground',
    string
  >;
}

function applyLocale(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = getLocaleDirection(locale);
  root.dataset.locale = locale;
}

function applyOrganizationDisplay(appearance: OrganizationAppearance) {
  document.documentElement.dataset.calendar = appearance.calendar;
  document.documentElement.dataset.timezone = appearance.timezone;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('form');
  const locale = useSyncExternalStore<Locale>(
    subscribePreferences,
    () => 'fa',
    (): Locale => 'fa',
  );
  const contrastSnapshot = useSyncExternalStore(
    subscribePreferences,
    readContrastSnapshot,
    () => DEFAULT_CONTRAST_SNAPSHOT,
  );
  const brightnessSnapshot = useSyncExternalStore(
    subscribePreferences,
    readBrightnessSnapshot,
    () => DEFAULT_CONTRAST_SNAPSHOT,
  );
  const organizationAppearanceSnapshot = useSyncExternalStore(
    subscribePreferences,
    readOrganizationAppearanceSnapshot,
    () => JSON.stringify(DEFAULT_ORGANIZATION_APPEARANCE),
  );
  const organizationAppearance = useMemo(
    () => parseOrganizationAppearance(organizationAppearanceSnapshot),
    [organizationAppearanceSnapshot],
  );
  const contrastPreferences = useMemo(
    () => parsePreferenceLevels(contrastSnapshot, DEFAULT_CONTRAST),
    [contrastSnapshot],
  );
  const brightnessPreferences = useMemo(
    () => parsePreferenceLevels(brightnessSnapshot, DEFAULT_CONTRAST),
    [brightnessSnapshot],
  );
  const [contrastPreview, setContrastPreview] = useState<ContrastPreferences | null>(null);
  const [brightnessPreview, setBrightnessPreview] = useState<BrightnessPreferences | null>(null);
  const [appearancePreview, setAppearancePreview] = useState<SaveOrganizationAppearance | null>(null);

  useEffect(() => {
    applyLocale(locale);
    applyOrganizationDisplay(appearancePreview
      ? { ...organizationAppearance, ...appearancePreview }
      : organizationAppearance);
  }, [locale, organizationAppearance, appearancePreview]);

  const loadUserPreferences = useCallback(async () => {
    if (!getAccessToken()) return;
    try {
      const saved = await preferencesApi.get();
      setWorkspaceMode(saved.workspaceMode.toLowerCase() as WorkspaceMode);
      window.localStorage.setItem(LOCALE_KEY, 'fa');
      window.localStorage.setItem(CONTRAST_KEY, JSON.stringify({
        light: saved.lightContrast,
        dark: saved.darkContrast,
      }));
      window.localStorage.setItem(BRIGHTNESS_KEY, JSON.stringify({
        light: saved.lightBrightness,
        dark: saved.darkBrightness,
      }));
      window.dispatchEvent(new Event('erp-preferences-changed'));
    } catch (error) {
      console.error('Could not load user preferences:', error);
    }
    try {
      const sharedAppearance = await preferencesApi.getOrganizationAppearance();
      const key = `${ORGANIZATION_APPEARANCE_KEY}:${getCurrentOrganizationId() ?? 'none'}`;
      const fixedAppearance = { ...sharedAppearance, backgroundStyle: 'GRAY' as const, timezone: 'Asia/Tehran', calendar: 'persian' as const };
      window.localStorage.setItem(key, JSON.stringify(fixedAppearance));
      applyOrganizationDisplay(fixedAppearance);
      window.dispatchEvent(new Event('erp-preferences-changed'));
    } catch (error) {
      console.error('Could not load organization appearance:', error);
    }
  }, []);

  useEffect(() => {
    const resetPreferences = () => {
      window.localStorage.removeItem(LOCALE_KEY);
      setWorkspaceMode('form');
      window.localStorage.removeItem(CONTRAST_KEY);
      window.localStorage.removeItem(BRIGHTNESS_KEY);
      window.localStorage.removeItem(LEGACY_BRIGHTNESS_KEY);
      setAppearancePreview(null);
      window.dispatchEvent(new Event('erp-preferences-changed'));
    };
    const handleAuthStorageChange = (event: StorageEvent) => {
      if (event.key !== 'access_token') return;
      if (getAccessToken()) void loadUserPreferences();
      else resetPreferences();
    };
    void loadUserPreferences();
    window.addEventListener('auth:login', loadUserPreferences);
    window.addEventListener('auth:logout', resetPreferences);
    window.addEventListener('storage', handleAuthStorageChange);
    return () => {
      window.removeEventListener('auth:login', loadUserPreferences);
      window.removeEventListener('auth:logout', resetPreferences);
      window.removeEventListener('storage', handleAuthStorageChange);
    };
  }, [loadUserPreferences]);

  const previewContrastPreferences = useCallback((nextPreferences: ContrastPreferences | null) => {
    setContrastPreview(nextPreferences);
  }, []);

  const previewBrightnessPreferences = useCallback((nextPreferences: BrightnessPreferences | null) => {
    setBrightnessPreview(nextPreferences);
  }, []);

  const previewOrganizationAppearance = useCallback((appearance: SaveOrganizationAppearance | null) => {
    setAppearancePreview(appearance);
  }, []);

  const savePreferences = useCallback(async (preferences: SaveUserPreferences) => {
    const saved = await preferencesApi.save({ ...preferences, locale: 'fa' });
    window.localStorage.setItem(LOCALE_KEY, 'fa');
    window.localStorage.setItem(CONTRAST_KEY, JSON.stringify({
      light: saved.lightContrast,
      dark: saved.darkContrast,
    }));
    window.localStorage.setItem(BRIGHTNESS_KEY, JSON.stringify({
      light: saved.lightBrightness,
      dark: saved.darkBrightness,
    }));
    window.dispatchEvent(new Event('erp-preferences-changed'));
  }, []);

  const saveWorkspaceMode = useCallback(async (mode: WorkspaceMode) => {
    const previous = workspaceMode;
    setWorkspaceMode(mode);
    try {
      await preferencesApi.saveWorkspaceMode(mode.toUpperCase() as 'FORM' | 'COMMAND' | 'AI');
    } catch (error) {
      setWorkspaceMode(previous);
      throw error;
    }
  }, [workspaceMode]);

  const saveOrganizationAppearance = useCallback(async (appearance: SaveOrganizationAppearance) => {
    const saved = await preferencesApi.saveOrganizationAppearance({ ...appearance, backgroundStyle: 'GRAY', timezone: 'Asia/Tehran', calendar: 'persian' });
    const key = `${ORGANIZATION_APPEARANCE_KEY}:${getCurrentOrganizationId() ?? 'none'}`;
    window.localStorage.setItem(key, JSON.stringify(saved));
    setAppearancePreview(null);
    applyOrganizationDisplay(saved);
    window.dispatchEvent(new Event('erp-preferences-changed'));
  }, []);

  const value = useMemo(
    () => ({
      locale,
      workspaceMode,
      saveWorkspaceMode,
      contrastPreferences,
      brightnessPreferences,
      organizationAppearance,
      appearancePreview,
      calendar: organizationAppearance.calendar,
      timezone: organizationAppearance.timezone ?? 'Asia/Tehran',
      canEditOrganizationAppearance: organizationAppearance.canEdit,
      contrastPreview,
      brightnessPreview,
      previewContrastPreferences,
      previewBrightnessPreferences,
      previewOrganizationAppearance,
      savePreferences,
      saveOrganizationAppearance,
    }),
    [
      locale,
      workspaceMode,
      saveWorkspaceMode,
      contrastPreferences,
      brightnessPreferences,
      organizationAppearance,
      appearancePreview,
      contrastPreview,
      brightnessPreview,
      previewContrastPreferences,
      previewBrightnessPreferences,
      previewOrganizationAppearance,
      savePreferences,
      saveOrganizationAppearance,
    ],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences باید داخل PreferencesProvider استفاده شود.');
  }
  return context;
}
