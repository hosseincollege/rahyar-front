'use client';

import { useEffect, useState } from 'react';
import { Boxes, Check, ChevronDown, EyeOff, PanelsTopLeft, Save } from 'lucide-react';
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
const navigationGroups: Array<{ title: UiMessage; items: Array<{ href: string; title: UiMessage }> }> = [
  { title: 'sidebarRahkam', items: [{ href: '/rahcom/map', title: 'rahcomMap' }, { href: '/rahcom/systems', title: 'rahcomSystemsList' }, { href: '/rahcom/daily-traffic', title: 'rahcomDailyTraffic' }, { href: '/rahcom/solar-daily', title: 'rahcomSolarDaily' }, { href: '/rahcom/tickets', title: 'rahcomTickets' }, { href: '/rahcom/aggregate', title: 'rahcomAggregateList' }, { href: '/rahcom/actions', title: 'rahcomActions' }] },
  { title: 'sidebarSettings', items: [{ href: '/settings/general', title: 'sidebarGeneral' }, { href: '/settings/modules', title: 'settingsDisplayManagement' }, { href: '/settings/announcements', title: 'sidebarAnnouncementManagement' }, { href: '/settings/company', title: 'settingsOrganizationWorkspace' }] },
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
  const renderOptions = (group: (typeof navigationGroups)[number]) => group.items
    .filter((item) => !item.href.includes('?tab='))
    .map((item) => {
      const tabs = group.items.filter((candidate) => candidate.href.startsWith(`${item.href}?tab=`));
      return <details key={item.href} className="group rounded-lg border border-border/70">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium"><span>{uiMessage(locale, item.title)}</span><ChevronDown size={15} className="shrink-0 transition-transform group-open:rotate-180" /></summary>
        <div className="space-y-1 border-t border-border/70 p-2">
          <VisibilityRow title={uiMessage(locale, item.title)} enabled={visibility.navigationItems?.[item.href] !== false} onToggle={() => updateNavigation(item.href, visibility.navigationItems?.[item.href] === false)} locale={locale} />
          {tabs.length > 0 && <details className="ms-3 rounded-lg border border-border/70">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground"><span>{uiMessage(locale, 'settingsOptionTabs')}</span><ChevronDown size={14} className="shrink-0" /></summary>
            <div className="divide-y divide-border/70 border-t border-border/70 px-1">
              {tabs.map((tab) => <VisibilityRow key={tab.href} title={uiMessage(locale, tab.title)} enabled={visibility.navigationItems?.[tab.href] !== false} onToggle={() => updateNavigation(tab.href, visibility.navigationItems?.[tab.href] === false)} locale={locale} />)}
            </div>
          </details>}
        </div>
      </details>;
    });

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <header className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Boxes size={22} /></span>
          <div>
            <h1 className="text-lg font-bold">{uiMessage(locale, 'settingsDisplayManagement')}</h1>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{uiMessage(locale, 'settingsDisplayManagementDescription')}</p>
          </div>
        </div>
      </header>

      <nav role="tablist" aria-label={uiMessage(locale, 'settingsDisplayManagement')} className="flex gap-2 rounded-2xl border border-border bg-card p-2">
        {(['modules', 'header'] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{uiMessage(locale, tab === 'modules' ? 'settingsModulesTab' : 'settingsHeaderTab')}</button>)}
      </nav>
      {saveError && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{saveError}</p>}
      {activeTab === 'modules' ? <section role="tabpanel" className="space-y-3 rounded-2xl border border-border bg-card p-3 sm:p-5">
        {NAVIGATION_MODULE_IDS.map((id) => {
          const group = navigationGroups.find((item) => item.title === moduleTitles[id]);
          const enabled = visibility.navigationModules?.[id] !== false;
          return <div key={id} className="flex items-start gap-2 rounded-xl border border-border p-3">
            <details className="group min-w-0 flex-1">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{enabled ? <Check size={16} strokeWidth={3} /> : <EyeOff size={16} />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{uiMessage(locale, moduleTitles[id])}</span><span className={`mt-0.5 block text-[11px] font-medium ${enabled ? 'text-primary' : 'text-muted-foreground'}`}>{uiMessage(locale, enabled ? 'settingsModuleEnabled' : 'settingsModuleDisabled')}</span></span>
                <ChevronDown size={15} className="shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              {group && <div className="mt-3 space-y-2 border-t border-border pt-3">{renderOptions(group)}</div>}
            </details>
            <VisibilitySwitch title={uiMessage(locale, moduleTitles[id])} enabled={enabled} onToggle={() => updateModule(id, !enabled)} locale={locale} />
          </div>;
        })}
      </section> : <section role="tabpanel" className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2"><PanelsTopLeft size={18} className="text-primary" /><h2 className="font-semibold">{uiMessage(locale, 'settingsHeaderTab')}</h2></div>
        <div className="divide-y divide-border rounded-xl border border-border">
          {HEADER_CONTROL_IDS.map((id) => <VisibilityRow key={id} title={uiMessage(locale, headerTitles[id])} enabled={visibility.headerControls?.[id] !== false} onToggle={() => update(id, visibility.headerControls?.[id] === false)} locale={locale} />)}
        </div>
      </section>}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="min-h-6 text-sm" aria-live="polite">
          {saveError ? <span className="text-destructive">{saveError}</span> : saveSucceeded && !hasUnsavedChanges ? <span className="font-medium text-primary">{uiMessage(locale, 'settingsDisplaySaved')}</span> : null}
        </div>
        <button type="button" onClick={() => void saveChanges()} disabled={!hasUnsavedChanges || saving} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? <><span className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent" />{uiMessage(locale, 'preferencesSaving')}</> : <><Save size={16} />{uiMessage(locale, 'settingsSaveDisplayChanges')}</>}
        </button>
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">{uiMessage(locale, 'settingsModuleLocalStorageNote')}</p>
    </main>
  );
}

function VisibilityRow({ title, enabled, onToggle, locale }: { title: string; enabled: boolean; onToggle: () => void; locale: Parameters<typeof uiMessage>[0] }) {
  return <div className="flex min-h-14 items-center justify-between gap-3 p-3">
    <div className="flex min-w-0 items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${enabled ? 'bg-primary' : 'bg-muted-foreground/40'}`} /><span className="truncate text-sm">{title}</span></div>
    <VisibilitySwitch title={title} enabled={enabled} onToggle={onToggle} locale={locale} />
  </div>;
}

function VisibilitySwitch({ title, enabled, onToggle, locale }: { title: string; enabled: boolean; onToggle: () => void; locale: Parameters<typeof uiMessage>[0] }) {
  return <button type="button" role="switch" aria-checked={enabled} aria-label={`${title}: ${uiMessage(locale, enabled ? 'settingsModuleEnabled' : 'settingsModuleDisabled')}`} onClick={onToggle} className="relative h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" style={{ borderColor: enabled ? 'var(--primary)' : 'var(--border)', backgroundColor: enabled ? 'var(--primary)' : 'transparent' }}><span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ insetInlineStart: enabled ? 4 : 24 }} /></button>;
}
