import { getCurrentUser } from '@/lib/api/shared/auth-api';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';

export const MODULE_VISIBILITY_KEY = 'rahyar-module-visibility-v1';
export type HeaderControlId = 'missionTools' | 'accountSwitcher' | 'provinceSelector';
export const HEADER_CONTROL_IDS: readonly HeaderControlId[] = ['missionTools', 'accountSwitcher', 'provinceSelector'];
export const OPTIONAL_MODULE_IDS = [] as const;

let visibilityWriteQueue: Promise<void> = Promise.resolve();

export type NavigationModuleId = 'rahcom' | 'settings' | 'development';
export const NAVIGATION_MODULE_IDS: readonly NavigationModuleId[] = ['rahcom', 'settings', 'development'];

export type OptionalModuleId = (typeof OPTIONAL_MODULE_IDS)[number];

function visibilityStorageKey(_isReducedEdition: boolean) {
  const organizationId = getCurrentOrganizationId() || 'current';
  return `${MODULE_VISIBILITY_KEY}-${organizationId}`;
}
export type ModuleVisibility = Partial<Record<OptionalModuleId, boolean>> & {
  navigationModules?: Partial<Record<NavigationModuleId, boolean>>;
  headerControls?: Partial<Record<HeaderControlId, boolean>>;
  navigationItems?: Record<string, boolean>;
};

function readSavedVisibility(isReducedEdition: boolean): ModuleVisibility {
  const raw = window.localStorage.getItem(visibilityStorageKey(isReducedEdition));
  return JSON.parse(raw || '{}') as ModuleVisibility;
}

export function defaultModuleVisibility(_isReducedEdition: boolean): Record<OptionalModuleId, boolean> {
  return {};
}

export function readModuleVisibility(isReducedEdition: boolean): Record<OptionalModuleId, boolean> {
  const defaults = defaultModuleVisibility(isReducedEdition);
  if (typeof window === 'undefined') return defaults;
  try {
    const saved = readSavedVisibility(isReducedEdition);
    return { ...defaults, ...Object.fromEntries(OPTIONAL_MODULE_IDS.filter((id) => typeof saved[id] === 'boolean').map((id) => [id, saved[id]])) };
  } catch {
    return defaults;
  }
}

export function readShellVisibility(isReducedEdition: boolean): ModuleVisibility {
  const modules = readModuleVisibility(isReducedEdition);
  const defaults: Record<HeaderControlId, boolean> = { missionTools: true, accountSwitcher: true, provinceSelector: true };
  const navigationModuleDefaults = Object.fromEntries(NAVIGATION_MODULE_IDS.map((id) => [id, true])) as Record<NavigationModuleId, boolean>;
  try {
    const saved = readSavedVisibility(isReducedEdition);
    const legacyMissionTools = saved.headerControls as (Partial<Record<HeaderControlId, boolean>> & { missionForm?: boolean; missionCommand?: boolean; missionAI?: boolean }) | undefined;
    const headerControls = {
      ...defaults,
      ...saved.headerControls,
      provinceSelector: isReducedEdition && saved.headerControls?.provinceSelector !== false,
      missionTools: typeof legacyMissionTools?.missionTools === 'boolean'
        ? legacyMissionTools.missionTools
        : legacyMissionTools?.missionForm !== false || legacyMissionTools?.missionCommand !== false || legacyMissionTools?.missionAI !== false,
    };
    const userId = getCurrentUser()?.id;
    if (typeof saved.headerControls?.accountSwitcher !== 'boolean' && userId && window.localStorage.getItem(`development-header-account-switcher:${userId}`) === 'false') {
      headerControls.accountSwitcher = false;
    }
    return { ...modules, navigationModules: { ...navigationModuleDefaults, ...saved.navigationModules }, headerControls, navigationItems: saved.navigationItems ?? {} };
  } catch { return { ...modules, navigationModules: navigationModuleDefaults, headerControls: defaults, navigationItems: {} }; }
}

function saveVisibilityCache(values: ModuleVisibility, isReducedEdition: boolean) {
  window.localStorage.setItem(visibilityStorageKey(isReducedEdition), JSON.stringify(values));
  window.dispatchEvent(new Event('rahyar-module-visibility-change'));
}

export async function loadOrganizationModuleVisibility(isReducedEdition: boolean) {
  const organizationId = getCurrentOrganizationId();
  if (!organizationId) return;
  try {
    const result = await settingsApi.getOrganizationShellVisibility(organizationId);
    saveVisibilityCache((result.shellVisibility ?? {}) as ModuleVisibility, isReducedEdition);
  } catch (error) {
    console.error('Could not load organization display settings:', error);
  }
}

export function saveModuleVisibility(values: ModuleVisibility, isReducedEdition: boolean) {
  visibilityWriteQueue = visibilityWriteQueue.catch(() => undefined).then(async () => {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) throw new Error('Organization is not available.');
    await settingsApi.updateOrganizationShellVisibility(organizationId, values as Record<string, unknown>);
    saveVisibilityCache(values, isReducedEdition);
  });
  return visibilityWriteQueue;
}
