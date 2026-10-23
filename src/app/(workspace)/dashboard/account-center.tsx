'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { AlertCircle, Building2, BriefcaseBusiness, ExternalLink, Mail, MapPin, Phone, RefreshCw, Save, UserRound } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import {
  getMyProfile,
  getOrganizationDirectory,
  updateMyProfile,
  type MyProfile,
  type OrganizationDirectory,
  type OrganizationDirectoryEmployee,
} from '@/lib/api/shared/auth-api';
import { uiMessage } from '@/lib/ui-messages';

type ProfileDraft = { firstName: string; lastName: string; phone: string };

export function AccountProfilePage() {
  return <AccountCenter view="profile" />;
}

export function OrganizationStructurePage() {
  return <AccountCenter view="organization" />;
}

function AccountCenter({ view }: { view: 'profile' | 'organization' }) {
  return (
    <Suspense fallback={<div className="mx-auto min-h-64 max-w-5xl" aria-hidden="true" />}>
      <AccountCenterContent view={view} />
    </Suspense>
  );
}

function AccountCenterContent({ view }: { view: 'profile' | 'organization' }) {
  const searchParams = useSearchParams();
  const activeView = view;
  const selectedPersonId = activeView === 'organization' ? searchParams.get('person') : null;
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [directory, setDirectory] = useState<OrganizationDirectory | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({ firstName: '', lastName: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [directoryLoadFailed, setDirectoryLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setDirectoryLoadFailed(false);
    try {
      if (activeView === 'profile') {
        const currentProfile = await getMyProfile();
        setProfile(currentProfile);
        setDraft({
          firstName: currentProfile.firstName,
          lastName: currentProfile.lastName,
          phone: currentProfile.phone ?? '',
        });
      } else {
        setDirectory(await getOrganizationDirectory());
      }
    } catch {
      if (activeView === 'profile') setLoadFailed(true);
      else setDirectoryLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [activeView]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load retrieves account and directory data from the API.
    void load();
  }, [load]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaveFailed(false);
    setSaved(false);
    try {
      const updated = await updateMyProfile({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim() || null,
      });
      setProfile(updated);
      setDraft({ firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone ?? '' });
      setEditing(false);
      setSaved(true);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const personHref = (id: string) => `/dashboard/organization?person=${encodeURIComponent(id)}`;
  const person = directory?.employees.find((employee) => employee.id === selectedPersonId) ?? null;

  return (
    <div dir={direction} className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{activeView === 'profile' ? <UserRound size={21} /> : <Building2 size={21} />}</span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground">{t(activeView === 'profile' ? 'accountProfileTab' : 'accountOrganizationTab')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t(activeView === 'organization' ? 'accountOrganizationDescription' : 'accountProfileDescription')}</p>
          </div>
        </div>
      </header>

      {loading ? (
        <div role="status" className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground"><RefreshCw size={19} className="mx-auto mb-3 animate-spin" />{t('notificationsLoading')}</div>
      ) : loadFailed ? (
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-8 text-center text-sm text-destructive"><AlertCircle size={20} className="mx-auto mb-3" />{t('notificationsLoadFailed')}<button type="button" onClick={() => void load()} className="ms-2 underline">{t('notificationsRetry')}</button></div>
      ) : activeView === 'profile' ? (
        <ProfilePanel
          profile={profile}
          draft={draft}
          setDraft={setDraft}
          editing={editing}
          setEditing={setEditing}
          saving={saving}
          saved={saved}
          saveFailed={saveFailed}
          onSubmit={saveProfile}
          t={t}
        />
      ) : (
        <OrganizationPanel
          directory={directory}
          selectedPersonId={selectedPersonId}
          person={person}
          loadFailed={directoryLoadFailed}
          onRetry={() => void load()}
          personHref={personHref}
          t={t}
        />
      )}
    </div>
  );
}

function ProfilePanel({
  profile,
  draft,
  setDraft,
  editing,
  setEditing,
  saving,
  saved,
  saveFailed,
  onSubmit,
  t,
}: {
  profile: MyProfile | null;
  draft: ProfileDraft;
  setDraft: Dispatch<SetStateAction<ProfileDraft>>;
  editing: boolean;
  setEditing: (value: boolean) => void;
  saving: boolean;
  saved: boolean;
  saveFailed: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  t: (key: Parameters<typeof uiMessage>[1]) => string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">{t('accountProfileTab')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('accountProfileDescription')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/organization" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5"><Building2 size={16} />{t('accountOrganizationTab')}</Link>
          {!editing && <button type="button" onClick={() => setEditing(true)} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">{t('accountEdit')}</button>}
        </div>
      </div>
      {saved && <p role="status" className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{t('accountProfileSaved')}</p>}
      {saveFailed && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{t('accountProfileSaveFailed')}</p>}
      <form onSubmit={(event) => void onSubmit(event)} className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm text-muted-foreground">{t('accountFirstName')}
          <input required maxLength={80} disabled={!editing} value={draft.firstName} onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))} className="mt-1.5 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-75" />
        </label>
        <label className="text-sm text-muted-foreground">{t('accountLastName')}
          <input required maxLength={80} disabled={!editing} value={draft.lastName} onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))} className="mt-1.5 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-75" />
        </label>
        <label className="text-sm text-muted-foreground">{t('usersDetailEmail')}
          <input dir="ltr" readOnly value={profile?.email ?? '—'} className="mt-1.5 block min-h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-start text-sm text-muted-foreground" />
        </label>
        <label className="text-sm text-muted-foreground">{t('usersDetailUsername')}
          <input dir="ltr" readOnly value={profile?.username ?? '—'} className="mt-1.5 block min-h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-start text-sm text-muted-foreground" />
        </label>
        <label className="text-sm text-muted-foreground">{t('accountPhone')}
          <input dir="ltr" type="tel" maxLength={40} disabled={!editing} value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} className="mt-1.5 block min-h-11 w-full rounded-xl border border-border bg-background px-3 text-start text-sm text-foreground disabled:opacity-75" />
        </label>
        {editing && <div className="flex items-end gap-2 sm:col-span-2">
          <button type="submit" disabled={saving || !draft.firstName.trim() || !draft.lastName.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save size={16} />{saving ? t('preferencesSaving') : t('saveChanges')}</button>
          <button type="button" disabled={saving} onClick={() => { setEditing(false); setDraft({ firstName: profile?.firstName ?? '', lastName: profile?.lastName ?? '', phone: profile?.phone ?? '' }); }} className="min-h-11 rounded-xl border border-border px-4 text-sm text-foreground">{t('accountCancel')}</button>
        </div>}
      </form>
    </section>
  );
}

function OrganizationPanel({
  directory,
  selectedPersonId,
  person,
  loadFailed,
  onRetry,
  personHref,
  t,
}: {
  directory: OrganizationDirectory | null;
  selectedPersonId: string | null;
  person: OrganizationDirectoryEmployee | null;
  loadFailed: boolean;
  onRetry: () => void;
  personHref: (id: string) => string;
  t: (key: Parameters<typeof uiMessage>[1]) => string;
}) {
  if (loadFailed) return <div role="alert" className="rounded-2xl border border-destructive/30 bg-card p-8 text-center text-sm text-destructive">{t('accountDirectoryLoadFailed')}<button type="button" onClick={onRetry} className="ms-2 underline">{t('notificationsRetry')}</button></div>;
  if (!directory) return <EmptyState icon={<Building2 size={22} />} text={t('accountNoOrganization')} />;
  if (!directory.organization.branches.length && !directory.organization.departments.length && !directory.employees.length) {
    return <EmptyState icon={<Building2 size={22} />} text={t('accountDirectoryEmpty')} />;
  }

  if (selectedPersonId) {
    if (!person) return <EmptyState icon={<UserRound size={22} />} text={t('accountPersonNotFound')} />;
    const department = directory.organization.departments.find((item) => item.id === person.departmentId);
    const directReports = directory.employees.filter((item) => item.managerId === person.id);
    return (
      <div className="space-y-4">
        <Link href="/dashboard/organization" className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/5">{t('accountBackToDirectory')}</Link>
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound size={23} /></span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-foreground">{person.firstName} {person.lastName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{person.jobTitle || t('accountPersonTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{person.employeeCode}</p>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <InfoRow label={t('accountBranch')} value={person.branch?.name ?? '—'} icon={<MapPin size={16} />} />
            <InfoRow label={t('accountDepartments')} value={department?.name ?? person.department?.name ?? '—'} icon={<BriefcaseBusiness size={16} />} />
            <InfoRow label={t('usersDetailEmail')} value={person.email ?? '—'} icon={<Mail size={16} />} ltr />
            <InfoRow label={t('accountPhone')} value={person.phone ?? '—'} icon={<Phone size={16} />} ltr />
            <div className="flex items-center gap-2 text-sm"><span className="text-muted-foreground">{t('usersDetailStatus')}:</span><span className="text-foreground">{person.status === 'ON_LEAVE' ? t('accountOnLeave') : t('usersActive')}</span></div>
            {person.manager && <div className="flex flex-wrap items-center gap-1 text-sm"><span className="text-muted-foreground">{t('accountReportsTo')}:</span><Link href={personHref(person.manager.id)} className="font-semibold text-primary hover:underline">{person.manager.firstName} {person.manager.lastName}</Link></div>}
          </dl>
          {directReports.length > 0 && <div className="mt-5 border-t border-border pt-4"><h3 className="mb-3 text-sm font-bold text-foreground">{t('accountPeople')} ({directReports.length})</h3><div className="flex flex-wrap gap-2">{directReports.map((report) => <Link key={report.id} href={personHref(report.id)} className="rounded-full border border-border px-3 py-1.5 text-sm text-foreground hover:border-primary/40 hover:text-primary">{report.firstName} {report.lastName}</Link>)}</div></div>}
        </section>
      </div>
    );
  }

  const { organization, employees } = directory;
  const activeBranchIds = new Set(organization.branches.map((branch) => branch.id));
  const activeDepartmentIds = new Set(organization.departments.map((department) => department.id));
  const personLink = (employee: OrganizationDirectoryEmployee) => (
    <Link key={employee.id} href={personHref(employee.id)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-start text-sm text-foreground hover:border-primary/40 hover:bg-primary/5">
      <UserRound size={15} className="shrink-0 text-primary" />
      <span>{employee.firstName} {employee.lastName}<span className="ms-1 text-xs text-muted-foreground">{employee.jobTitle ? `· ${employee.jobTitle}` : ''}</span></span>
    </Link>
  );

  return (
    <div className="space-y-4">
      <nav aria-label={t('accountOrganizationTab')} className="flex gap-2 overflow-x-auto pb-1">
        <a href="#company-details" className="shrink-0 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:border-primary/40">{t('accountCompanyInfo')}</a>
        {organization.branches.map((branch) => <a key={branch.id} href={`#branch-${branch.id}`} className="shrink-0 rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground hover:border-primary/40">{branch.name}</a>)}
        {organization.departments.map((department) => <a key={department.id} href={`#department-${department.id}`} className="shrink-0 rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground hover:border-primary/40">{department.name}</a>)}
      </nav>
      <section id="company-details" className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-3 text-xs font-semibold text-muted-foreground">{t('accountCompanyInfo')}</p>
        <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 size={21} /></span><div><h2 className="text-lg font-bold text-foreground">{organization.name}</h2>{organization.legalName && organization.legalName !== organization.name && <p className="mt-1 text-sm text-muted-foreground">{organization.legalName}</p>}</div></div>
        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          {organization.address && <InfoRow label={t('accountAddress')} value={organization.address} icon={<MapPin size={16} />} />}
          {organization.phone && <InfoRow label={t('accountPhone')} value={organization.phone} icon={<Phone size={16} />} ltr />}
          {organization.email && <InfoRow label={t('usersDetailEmail')} value={organization.email} icon={<Mail size={16} />} ltr />}
          {organization.website && <InfoRow label={t('accountWebsite')} value={organization.website} icon={<ExternalLink size={16} />} ltr />}
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-3 py-1.5">{t('accountBranches')}: {organization.branches.length}</span>
          <span className="rounded-full bg-muted px-3 py-1.5">{t('accountDepartments')}: {organization.departments.length}</span>
          <span className="rounded-full bg-muted px-3 py-1.5">{t('accountPeople')}: {employees.length}</span>
        </div>
      </section>

      {organization.branches.map((branch) => {
        const departments = organization.departments.filter((department) => department.branchId === branch.id);
        const branchPeople = employees.filter((employee) => employee.branchId === branch.id && (!employee.departmentId || !activeDepartmentIds.has(employee.departmentId)));
        return (
          <section key={branch.id} id={`branch-${branch.id}`} className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
            <header className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><MapPin size={18} className="text-primary" /><h3 className="font-bold text-foreground">{branch.name}</h3>{branch.isMain && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t('accountMainBranch')}</span>}</div><span dir="ltr" className="text-xs text-muted-foreground">{branch.code}</span></header>
            {(branch.address || branch.phone || branch.email) && <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">{branch.address && <span>{branch.address}</span>}{branch.phone && <span dir="ltr">{branch.phone}</span>}{branch.email && <span dir="ltr">{branch.email}</span>}</div>}
            {departments.map((department) => {
              const members = employees.filter((employee) => employee.departmentId === department.id);
              return <article key={department.id} id={`department-${department.id}`} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-foreground">{department.name}</h4><p dir="ltr" className="mt-1 text-xs text-muted-foreground">{department.code}</p></div><div className="text-sm">{department.manager ? <Link href={personHref(department.manager.id)} className="text-primary hover:underline">{t('accountManager')}: {department.manager.firstName} {department.manager.lastName}</Link> : <span className="text-muted-foreground">{t('accountNoManager')}</span>}</div></div>
                <div className="mt-3 flex flex-wrap gap-2">{members.length ? members.map(personLink) : <p className="text-sm text-muted-foreground">{t('accountNoEmployees')}</p>}</div>
              </article>;
            })}
            {branchPeople.length > 0 && <div className="rounded-xl border border-dashed border-border p-4"><h4 className="mb-3 text-sm font-semibold text-foreground">{t('accountPeople')}</h4><div className="flex flex-wrap gap-2">{branchPeople.map(personLink)}</div></div>}
            {departments.length === 0 && branchPeople.length === 0 && <p className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">{t('accountNoEmployees')}</p>}
          </section>
        );
      })}

      {organization.departments.filter((department) => !department.branchId || !activeBranchIds.has(department.branchId)).map((department) => {
        const members = employees.filter((employee) => employee.departmentId === department.id);
        return <section key={department.id} id={`department-${department.id}`} className="rounded-2xl border border-border bg-card p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-bold text-foreground">{department.name}</h3>{department.manager ? <Link href={personHref(department.manager.id)} className="text-sm text-primary hover:underline">{t('accountManager')}: {department.manager.firstName} {department.manager.lastName}</Link> : <span className="text-sm text-muted-foreground">{t('accountNoManager')}</span>}</div><div className="mt-3 flex flex-wrap gap-2">{members.length ? members.map(personLink) : <p className="text-sm text-muted-foreground">{t('accountNoEmployees')}</p>}</div></section>;
      })}

      {employees.filter((employee) => (!employee.departmentId || !activeDepartmentIds.has(employee.departmentId)) && (!employee.branchId || !activeBranchIds.has(employee.branchId))).length > 0 && <section className="rounded-2xl border border-border bg-card p-5"><h3 className="mb-3 font-bold text-foreground">{t('accountPeople')}</h3><div className="flex flex-wrap gap-2">{employees.filter((employee) => (!employee.departmentId || !activeDepartmentIds.has(employee.departmentId)) && (!employee.branchId || !activeBranchIds.has(employee.branchId))).map(personLink)}</div></section>}
    </div>
  );
}

function InfoRow({ label, value, icon, ltr = false }: { label: string; value: string; icon: ReactNode; ltr?: boolean }) {
  return <div className="flex min-w-0 items-start gap-2 text-sm"><span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span><span className="min-w-0"><span className="text-muted-foreground">{label}: </span><span dir={ltr ? 'ltr' : undefined} className={`text-foreground ${ltr ? 'break-all' : ''}`}>{value}</span></span></div>;
}

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground"><span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted">{icon}</span>{text}</div>;
}
