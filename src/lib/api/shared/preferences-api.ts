import { apiClient } from '@/lib/api-client';
import type { BrightnessPreferences, CalendarSystem, ContrastPreferences } from '@/components/preferences-provider';
import type { Locale } from '@/lib/ui-messages';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';

export type UserPreferences = {
  locale: Locale;
  lightContrast: ContrastPreferences['light'];
  darkContrast: ContrastPreferences['dark'];
  lightBrightness: BrightnessPreferences['light'];
  darkBrightness: BrightnessPreferences['dark'];
  workspaceMode: 'FORM' | 'COMMAND' | 'AI';
};

export type SaveUserPreferences = {
  locale: Locale;
  contrastPreferences: ContrastPreferences;
  brightnessPreferences: BrightnessPreferences;
};

export type OrganizationAppearance = {
  accentPreset: 'blue' | 'green' | 'red' | 'amber' | 'violet' | 'custom';
  accentLightColor: `#${string}`;
  accentDarkColor: `#${string}`;
  backgroundStyle: 'NAVY' | 'GRAY' | 'THEME';
  timezone: string;
  calendar: CalendarSystem;
  canEdit: boolean;
};

export type SaveOrganizationAppearance = Omit<OrganizationAppearance, 'canEdit'>;

const defaultOrganizationAppearance: OrganizationAppearance = {
  accentPreset: 'blue',
  accentLightColor: '#60a5fa',
  accentDarkColor: '#3b82f6',
  backgroundStyle: 'GRAY',
  timezone: 'Asia/Tehran',
  calendar: 'persian',
  canEdit: false,
};

export const preferencesApi = {
  get(): Promise<UserPreferences> {
    return apiClient.get<UserPreferences>('/auth/preferences');
  },

  save(preferences: SaveUserPreferences): Promise<UserPreferences> {
    return apiClient.put<UserPreferences>('/auth/preferences', {
      locale: preferences.locale,
      lightContrast: preferences.contrastPreferences.light,
      darkContrast: preferences.contrastPreferences.dark,
      lightBrightness: preferences.brightnessPreferences.light,
      darkBrightness: preferences.brightnessPreferences.dark,
    });
  },

  saveWorkspaceMode(workspaceMode: 'FORM' | 'COMMAND' | 'AI'): Promise<{ workspaceMode: 'FORM' | 'COMMAND' | 'AI' }> {
    return apiClient.put('/auth/preferences/workspace-mode', { workspaceMode });
  },

  async getOrganizationAppearance(): Promise<OrganizationAppearance> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return defaultOrganizationAppearance;
    return apiClient.get<OrganizationAppearance>(
      `/settings/organization/${encodeURIComponent(organizationId)}/appearance`,
    );
  },

  async saveOrganizationAppearance(
    appearance: SaveOrganizationAppearance,
  ): Promise<OrganizationAppearance> {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) throw new Error('سازمان فعالی انتخاب نشده است.');
    return apiClient.put<OrganizationAppearance>(
      `/settings/organization/${encodeURIComponent(organizationId)}/appearance`,
      appearance,
    );
  },
};
