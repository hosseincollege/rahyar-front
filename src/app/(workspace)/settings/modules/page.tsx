'use client';

import { useEffect, useState } from 'react';
import { Activity, BarChart3, Bell, BriefcaseBusiness, Building2, CalendarDays, Calculator, ClipboardList, Clock3, Database, Eye, FileText, History, LayoutDashboard, Layers, LifeBuoy, List, MapPinned, Megaphone, MessageSquare, Package, Save, Search, Settings, ShoppingCart, Sun, User, UsersRound, Wallet, type LucideIcon } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { getLocaleDirection } from '@/languages';
import { uiMessage } from '@/lib/ui-messages';
import { isReducedEdition } from '@/lib/product-edition';
import { HEADER_CONTROL_IDS, NAVIGATION_MODULE_IDS, readShellVisibility, saveModuleVisibility, type HeaderControlId, type NavigationModuleId, type ModuleVisibility } from '@/lib/module-visibility';
import type { UiMessage } from '@/languages/types';

const moduleTitles: Record<NavigationModuleId, Parameters<typeof uiMessage>[1]> = {
  rahcom: 'sidebarRahkam',
  settings: 'sidebarSettings',
  development: 'sidebarDevelopment',
};

const headerTitles: Record<HeaderControlId, UiMessage> = {
  missionTools: 'settingsHeaderMissionTools',
  accountSwitcher: 'settingsHeaderAccountSwitcher', provinceSelector: 'settingsHeaderProvinceSelector',
};
const headerIcons: Record<HeaderControlId, LucideIcon> = {
  missionTools: BriefcaseBusiness,
  accountSwitcher: UsersRound,
  provinceSelector: MapPinned,
};
const navigationGroups: Array<{ title: UiMessage; items: Array<{ href: string; title: UiMessage }> }> = [
  { title: 'sidebarRahkam', items: [{ href: '/rahcom/map', title: 'rahcomMap' }, { href: '/rahcom/systems', title: 'rahcomSystemsList' }, { href: '/rahcom/daily-traffic', title: 'rahcomDailyTraffic' }, { href: '/rahcom/solar-daily', title: 'rahcomSolarDaily' }, { href: '/rahcom/tickets', title: 'rahcomTickets' }, { href: '/rahcom/aggregate', title: 'rahcomAggregateList' }, { href: '/rahcom/actions', title: 'rahcomActions' }] },
  { title: 'sidebarSettings', items: [{ href: '/settings/general', title: 'sidebarGeneral' }, { href: '/settings/company', title: 'settingsOrganizationWorkspace' }, { href: '/settings/modules', title: 'settingsDisplayManagement' }, { href: '/settings/announcements', title: 'sidebarAnnouncementManagement' }] },
  { title: 'sidebarDevelopment', items: [{ href: '/development/site-visits', title: 'developmentSiteVisits' }, { href: '/development/test-data', title: 'sidebarTestData' }] },
];

export default function ModuleSettingsPage() {
  const { locale } = usePreferences();
  const [visibility, setVisibility] = useState<ModuleVisibility>(() => readShellVisibility(isReducedEdition));
  const [savedVisibility, setSavedVisibility] = useState<ModuleVisibility>(() => readShellVisibility(isReducedEdition));
  const [activeTab, setActiveTab] = useState<'modules' | 'header'>('modules');
  const [saveError, setSaveError] = useState('');
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasUnsavedChanges = JSON.stringify(visibility) !== JSON.stringify(savedVisibility);

  useEffect(() => {
    const current = readShellVisibility(isReducedEdition);
    setVisibility(current);
    setSavedVisibility(current);
    if (new URLSearchParams(window.location.search).get('tab') === 'header') setActiveTab('header');
  }, []);

  const markEdited = () => { setSaveError(''); setSaveSucceeded(false); };

  const update = (id: HeaderControlId, enabled: boolean) => {
    const next: ModuleVisibility = id in (visibility.headerControls ?? {})
      ? { ...visibility, headerControls: { ...visibility.headerControls, [id]: enabled } }
      : { ...visibility, [id]: enabled };
    markEdited();
    setVisibility(next);
  };
  const updateNavigation = (href: string, enabled: boolean) => {
    const next = { ...visibility, navigationItems: { ...visibility.navigationItems, [href]: enabled } };
    markEdited();
    setVisibility(next);
  };
  const updateModule = (id: NavigationModuleId, enabled: boolean) => {
    const next: ModuleVisibility = {
      ...visibility,
      navigationModules: { ...visibility.navigationModules, [id]: enabled },
    };
    markEdited();
    setVisibility(next);
  };
  const saveChanges = async () => {
    const next = visibility;
    setSaving(true);
    setSaveError('');
    setSaveSucceeded(false);
    try {
      await saveModuleVisibility(next, isReducedEdition);
      setSavedVisibility(next);
      setSaveSucceeded(true);
    } catch {
      setSaveError(uiMessage(locale, 'preferencesSaveFailed'));
    } finally {
      setSaving(false);
    }
  };
  const renderOptions = (group: (typeof navigationGroups)[number], moduleEnabled: boolean) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {group.items.map((item) => <NavigationOptionToggle
        key={item.href}
        title={uiMessage(locale, item.title)}
        icon={navigationOptionIcon(item.href)}
        enabled={moduleEnabled && visibility.navigationItems?.[item.href] !== false}
        disabled={!moduleEnabled}
        onToggle={() => updateNavigation(item.href, visibility.navigationItems?.[item.href] === false)}
        locale={locale}
      />)}
    </div>
  );

  const saveActions = <div className="flex flex-wrap items-center gap-3 pt-2">
    <button type="button" onClick={() => void saveChanges()} disabled={!hasUnsavedChanges || saving} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
      {saving ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent" />{uiMessage(locale, 'preferencesSaving')}</> : <><Save size={15} />{uiMessage(locale, 'settingsSaveDisplayChanges')}</>}
    </button>
    <div className="min-h-6 text-sm" aria-live="polite">
      {saveError ? <span className="text-destructive">{saveError}</span> : saveSucceeded && !hasUnsavedChanges ? <span className="font-medium text-primary">{uiMessage(locale, 'settingsDisplaySaved')}</span> : null}
    </div>
  </div>;

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-6xl space-y-3 p-2 sm:p-3">
      <nav role="tablist" aria-label={uiMessage(locale, 'settingsDisplayManagement')} className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max gap-1">
          {(['modules', 'header'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} style={activeTab === tab ? { color: 'var(--primary)', borderBottomColor: 'var(--primary)' } : undefined} className={`min-h-9 border-b-2 px-3 text-sm font-semibold transition-colors ${activeTab === tab ? 'text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{uiMessage(locale, tab === 'modules' ? 'settingsModulesTab' : 'settingsHeaderTab')}</button>)}
        </div>
      </nav>
      {saveError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{saveError}</p>}
      {activeTab === 'modules' ? <section role="tabpanel" className="space-y-2">
        {NAVIGATION_MODULE_IDS.map((id) => {
          const group = navigationGroups.find((item) => item.title === moduleTitles[id]);
          const enabled = visibility.navigationModules?.[id] !== false;
          return <div key={id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/80 bg-card px-3 py-2">
            <div className="flex shrink-0 items-center border-e border-border pe-3">
              <ModuleIconToggle title={uiMessage(locale, moduleTitles[id])} icon={navigationModuleIcon(id)} enabled={enabled} onToggle={() => updateModule(id, !enabled)} locale={locale} />
            </div>
            {group && <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{renderOptions(group, enabled)}</div>}
          </div>;
        })}
        {saveActions}
      </section> : <section role="tabpanel" className="space-y-3 rounded-xl border border-border bg-card p-3 sm:p-4">
        <div role="group" aria-label={uiMessage(locale, 'settingsHeaderTab')} className="inline-grid w-fit max-w-full grid-cols-3 items-center gap-1">
          {HEADER_CONTROL_IDS.map((id) => <HeaderControlToggle key={id} title={uiMessage(locale, headerTitles[id])} icon={headerIcons[id]} enabled={visibility.headerControls?.[id] !== false} onToggle={() => update(id, visibility.headerControls?.[id] === false)} locale={locale} />)}
        </div>
        {saveActions}
      </section>}
      <p className="text-[11px] leading-5 text-muted-foreground">{uiMessage(locale, 'settingsModuleLocalStorageNote')}</p>
    </main>
  );
}

function ModuleIconToggle({ title, icon: Icon, enabled, onToggle, locale }: { title: string; icon: LucideIcon; enabled: boolean; onToggle: () => void; locale: Parameters<typeof uiMessage>[0] }) {
  return <button type="button" aria-pressed={enabled} aria-label={`${title}: ${uiMessage(locale, enabled ? 'settingsModuleEnabled' : 'settingsModuleDisabled')}`} title={title} onClick={onToggle} style={{ color: enabled ? 'var(--primary)' : 'var(--muted-foreground)' }} className="relative flex min-h-[4.75rem] min-w-[5.75rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <span className="relative grid size-9 place-items-center"><Icon size={27} strokeWidth={1.9} />{!enabled && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', pointerEvents: 'none', color: 'currentColor' }}><span style={{ width: 36, height: 3, borderRadius: 9999, backgroundColor: 'currentColor', transform: 'rotate(-45deg)' }} /></span>}</span>
    <span className="text-sm font-bold leading-5">{title}</span>
  </button>;
}

function HeaderControlToggle({ title, icon: Icon, enabled, onToggle, locale }: { title: string; icon: LucideIcon; enabled: boolean; onToggle: () => void; locale: Parameters<typeof uiMessage>[0] }) {
  return <button type="button" role="switch" aria-checked={enabled} aria-label={`${title}: ${uiMessage(locale, enabled ? 'settingsModuleEnabled' : 'settingsModuleDisabled')}`} title={title} onClick={onToggle} className="flex min-h-12 min-w-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-center transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
    <span className="relative grid size-9 place-items-center"><Icon size={27} strokeWidth={1.8} style={{ color: enabled ? 'var(--primary)' : 'var(--muted-foreground)' }} />{!enabled && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', pointerEvents: 'none', color: 'var(--muted-foreground)' }}><span style={{ width: 35, height: 2, borderRadius: 9999, backgroundColor: 'currentColor', transform: 'rotate(-45deg)' }} /></span>}</span>
    <span className={`max-w-32 text-[10px] font-medium leading-3 ${enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{title}</span>
  </button>;
}

function NavigationOptionToggle({ title, icon: Icon, enabled, disabled, onToggle, locale }: { title: string; icon: LucideIcon; enabled: boolean; disabled: boolean; onToggle: () => void; locale: Parameters<typeof uiMessage>[0] }) {
  return <button type="button" disabled={disabled} aria-pressed={enabled} aria-label={`${title}: ${uiMessage(locale, enabled ? 'settingsModuleEnabled' : 'settingsModuleDisabled')}`} title={title} onClick={onToggle} className={`group flex w-[4.5rem] flex-col items-center gap-1 rounded-lg p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-muted/70'}`}>
    <span style={enabled && !disabled ? { backgroundColor: 'var(--primary-soft)' } : undefined} className="relative flex size-9 items-center justify-center rounded-lg transition-colors">
      <Icon size={19} strokeWidth={1.8} style={{ color: enabled && !disabled ? 'var(--primary)' : 'var(--muted-foreground)', opacity: enabled ? 1 : disabled ? 0.28 : 0.42 }} />
      {!enabled && <span aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--muted-foreground)', opacity: disabled ? 0.28 : 0.42 }}><span style={{ width: 32, height: 3, borderRadius: 9999, backgroundColor: 'currentColor', transform: 'rotate(-45deg)' }} /></span>}
    </span>
    <span style={{ opacity: disabled ? 0.48 : 1 }} className={`line-clamp-2 min-h-7 w-full text-[10px] leading-3 ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}>{title}</span>
  </button>;
}

function navigationOptionIcon(href: string): LucideIcon {
  if (href.includes('map')) return MapPinned;
  if (href.includes('notification')) return Bell;
  if (href.includes('announcement') || href.includes('messages')) return Megaphone;
  if (href.includes('search')) return Search;
  if (href.includes('history')) return History;
  if (href.includes('conversation') || href.includes('group') || href.includes('channel')) return MessageSquare;
  if (href.includes('profile')) return User;
  if (href.includes('ticket') || href.includes('support')) return LifeBuoy;
  if (href.includes('solar')) return Sun;
  if (href.includes('traffic') || href.includes('attendance')) return Activity;
  if (href.includes('aggregate')) return Layers;
  if (href.includes('action')) return Clock3;
  if (href.includes('system') || href.includes('test-data')) return Database;
  if (href.includes('dashboard') || href.includes('events')) return LayoutDashboard;
  if (href.includes('employee') || href.includes('customer')) return UsersRound;
  if (href.includes('invoice') || href.includes('voucher') || href.includes('ledger')) return FileText;
  if (href.includes('accounting')) return Calculator;
  if (href.includes('purchase') || href.includes('sales')) return ShoppingCart;
  if (href.includes('payment') || href.includes('payroll')) return Wallet;
  if (href.includes('inventory')) return Package;
  if (href.includes('leave') || href.includes('calendar')) return CalendarDays;
  if (href.includes('report') || href.includes('statistics') || href.includes('business-intelligence')) return BarChart3;
  if (href.includes('site-visits')) return Eye;
  if (href.includes('company')) return Building2;
  if (href.includes('settings') || href.includes('general') || href.includes('modules')) return Settings;
  if (href.includes('development')) return BriefcaseBusiness;
  if (href.includes('data')) return ClipboardList;
  return List;
}

function navigationModuleIcon(id: NavigationModuleId): LucideIcon {
  if (id === 'rahcom') return MapPinned;
  if (id === 'settings') return Settings;
  return BriefcaseBusiness;
}
