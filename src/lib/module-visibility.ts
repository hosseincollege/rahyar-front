import { getCurrentUser } from '@/lib/api/shared/auth-api';

export const MODULE_VISIBILITY_KEY = 'erp-module-visibility-v2';
export const HEADER_CONTROL_IDS = ['missionForm', 'missionCommand', 'missionAI', 'accountSwitcher', 'provinceSelector'] as const;
export type HeaderControlId = (typeof HEADER_CONTROL_IDS)[number];
export const OPTIONAL_MODULE_IDS = [
  'accounting',
  'commerce',
  'human-resources',
  'support',
  'statistics',
] as const;

export const NAVIGATION_MODULE_IDS = [
  'dashboard', 'rahcom', 'accounting', 'commerce', 'human-resources',
  'support', 'statistics', 'settings', 'development',
] as const;
export type NavigationModuleId = (typeof NAVIGATION_MODULE_IDS)[number];

export type OptionalModuleId = (typeof OPTIONAL_MODULE_IDS)[number];
export type ModuleVisibility = Partial<Record<OptionalModuleId, boolean>> & {
  navigationModules?: Partial<Record<NavigationModuleId, boolean>>;
  headerControls?: Partial<Record<HeaderControlId, boolean>>;
  navigationItems?: Record<string, boolean>;
};

function readSavedVisibility(isReducedEdition: boolean): ModuleVisibility {
  const currentKey = `${MODULE_VISIBILITY_KEY}-${isReducedEdition ? 'rahyar' : 'erp'}`;
  const raw = window.localStorage.getItem(currentKey) ?? window.localStorage.getItem('erp-module-visibility-v1');
  return JSON.parse(raw || '{}') as ModuleVisibility;
}

export function defaultModuleVisibility(isReducedEdition: boolean): Record<OptionalModuleId, boolean> {
  return Object.fromEntries(OPTIONAL_MODULE_IDS.map((id) => [id, !isReducedEdition])) as Record<OptionalModuleId, boolean>;
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
  const defaults: Record<HeaderControlId, boolean> = { missionForm: true, missionCommand: true, missionAI: true, accountSwitcher: true, provinceSelector: true };
  const navigationModuleDefaults = Object.fromEntries(NAVIGATION_MODULE_IDS.map((id) => [id, true])) as Record<NavigationModuleId, boolean>;
  try {
    const saved = readSavedVisibility(isReducedEdition);
    const headerControls = { ...defaults, ...saved.headerControls };
    const userId = getCurrentUser()?.id;
    if (typeof saved.headerControls?.accountSwitcher !== 'boolean' && userId && window.localStorage.getItem(`development-header-account-switcher:${userId}`) === 'false') {
      headerControls.accountSwitcher = false;
    }
    return { ...modules, navigationModules: { ...navigationModuleDefaults, ...saved.navigationModules }, headerControls, navigationItems: saved.navigationItems ?? {} };
  } catch { return { ...modules, navigationModules: navigationModuleDefaults, headerControls: defaults, navigationItems: {} }; }
}

export function saveModuleVisibility(values: ModuleVisibility, isReducedEdition: boolean) {
  window.localStorage.setItem(`${MODULE_VISIBILITY_KEY}-${isReducedEdition ? 'rahyar' : 'erp'}`, JSON.stringify(values));
  window.dispatchEvent(new Event('erp-module-visibility-change'));
}
