'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle, Plus, Save, Trash2, Users, X } from 'lucide-react';

import {
  settingsApi,
  type DepartmentEmployeeSummary,
  type DepartmentOverview,
  type DepartmentTeamSummary,
} from '@/lib/api/settings/settings-api';

type Props = {
  departmentId: string;
  canEdit: boolean;
  onClose: () => void;
};

type TeamForm = {
  id?: string;
  name: string;
  code: string;
  managerEmployeeId: string;
  employeeIds: string[];
};

const EMPTY_TEAM: TeamForm = {
  name: '',
  code: '',
  managerEmployeeId: '',
  employeeIds: [],
};

function employeeName(employee: DepartmentEmployeeSummary): string {
  return `${employee.firstName} ${employee.lastName}`.trim();
}

export function DepartmentOverviewPanel({
  departmentId,
  canEdit,
  onClose,
}: Props) {
  const [overview, setOverview] = useState<DepartmentOverview | null>(null);
  const [availableEmployees, setAvailableEmployees] = useState<
    DepartmentEmployeeSummary[]
  >([]);
  const [managerId, setManagerId] = useState('');
  const [employeeManagers, setEmployeeManagers] = useState<
    Record<string, string>
  >({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [teamForm, setTeamForm] = useState<TeamForm>(EMPTY_TEAM);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [details, available] = await Promise.all([
        settingsApi.getDepartmentOverview(departmentId),
        canEdit
          ? settingsApi.getAvailableDepartmentEmployees(departmentId)
          : Promise.resolve([]),
      ]);
      setOverview(details);
      setManagerId(details.manager?.id || '');
      setEmployeeManagers(
        Object.fromEntries(
          details.employees.map((employee) => [
            employee.id,
            employee.managerId || '',
          ]),
        ),
      );
      setAvailableEmployees(available);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'دریافت جزئیات دپارتمان ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }, [canEdit, departmentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runAction = async (key: string, action: () => Promise<unknown>) => {
    setBusyAction(key);
    setError('');
    try {
      await action();
      await loadData();
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : 'عملیات انجام نشد.',
      );
    } finally {
      setBusyAction(null);
    }
  };

  const submitTeam = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: teamForm.name.trim(),
      code: teamForm.code.trim(),
      managerEmployeeId: teamForm.managerEmployeeId || null,
      employeeIds: teamForm.employeeIds,
    };
    await runAction('team', async () => {
      if (teamForm.id) {
        return settingsApi.updateDepartmentTeam(teamForm.id, payload);
      }
      return settingsApi.createDepartmentTeam(departmentId, payload);
    });
    setTeamForm(EMPTY_TEAM);
    setTeamFormOpen(false);
  };

  const startTeamEdit = (team?: DepartmentTeamSummary) => {
    setTeamForm(
      team
        ? {
            id: team.id,
            name: team.name,
            code: team.code,
            managerEmployeeId: team.manager?.id || '',
            employeeIds: team.members.map((member) => member.id),
          }
        : EMPTY_TEAM,
    );
    setTeamFormOpen(true);
  };

  if (loading && !overview) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />
        در حال دریافت اطلاعات دپارتمان...
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
        <div className="flex items-start justify-between gap-3">
          <span>{error || 'جزئیات دپارتمان در دسترس نیست.'}</span>
          <button type="button" onClick={onClose} aria-label="بستن">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  const employeesByManager = new Map<string, DepartmentEmployeeSummary[]>();
  for (const employee of overview.employees) {
    if (!employee.managerId) continue;
    const reports = employeesByManager.get(employee.managerId) || [];
    reports.push(employee);
    employeesByManager.set(employee.managerId, reports);
  }

  return (
    <section className="space-y-5 rounded-2xl border border-blue-200 bg-card p-5 shadow-sm dark:border-blue-900/60">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">
            جزئیات دپارتمان {overview.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {overview.branch?.name || 'واحد سازمانی'} · {overview.employees.length} نفر · {overview.teams.length} تیم
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
          aria-label="بستن جزئیات"
        >
          <X size={17} />
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
              <Users size={16} /> سرپرست و اعضا ({overview.employees.length})
            </h4>
            {canEdit ? (
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <label className="min-w-52 flex-1 text-xs text-muted-foreground">
                  مدیر دپارتمان
                  <select
                    value={managerId}
                    onChange={(event) => setManagerId(event.target.value)}
                    className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                  >
                    <option value="">تعیین نشده</option>
                    {overview.employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employeeName(employee)} — {employee.jobTitle || employee.employeeCode}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busyAction === 'manager'}
                  onClick={() =>
                    void runAction('manager', () =>
                      settingsApi.setDepartmentManager(overview.id, managerId || null),
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Save size={14} /> ثبت سرپرست
                </button>
              </div>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">
                سرپرست: {overview.manager ? employeeName(overview.manager) : 'تعیین نشده'}
              </p>
            )}

            {canEdit && availableEmployees.length > 0 && (
              <div className="mb-4 flex gap-2">
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="">انتخاب کارمندِ بدون دپارتمان</option>
                  {availableEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employeeName(employee)} — {employee.jobTitle || employee.employeeCode}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedEmployeeId || busyAction === 'assign'}
                  onClick={() =>
                    void runAction('assign', async () => {
                      await settingsApi.assignDepartmentEmployee(
                        overview.id,
                        selectedEmployeeId,
                      );
                      setSelectedEmployeeId('');
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                >
                  <Plus size={14} /> افزودن
                </button>
              </div>
            )}

            {overview.employees.length === 0 ? (
              <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                هنوز کارمندی به این دپارتمان نسبت داده نشده است.
              </p>
            ) : (
              <div className="space-y-3">
                {overview.employees.map((employee) => {
                  const reports = employeesByManager.get(employee.id) || [];
                  return (
                    <article key={employee.id} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {employeeName(employee)}
                            {overview.manager?.id === employee.id && (
                              <span className="mr-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                                مدیر دپارتمان
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {employee.jobTitle || 'عنوان شغلی ثبت نشده'} · کد {employee.employeeCode} · {employee.status}
                          </p>
                          {employee.roles.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {employee.roles.map((role) => (
                                <span key={role.key} className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                                  {role.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="mt-2 text-xs text-muted-foreground">
                            نیروهای زیرمجموعه: {reports.length
                              ? reports.map(employeeName).join('، ')
                              : 'ندارد'}
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            disabled={busyAction === `remove:${employee.id}`}
                            onClick={() => {
                              if (window.confirm(`عضویت ${employeeName(employee)} در این دپارتمان برداشته شود؟`)) {
                                void runAction(`remove:${employee.id}`, () =>
                                  settingsApi.removeDepartmentEmployee(overview.id, employee.id),
                                );
                              }
                            }}
                            className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            aria-label={`حذف ${employeeName(employee)} از دپارتمان`}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                      {canEdit && overview.employees.length > 1 && (
                        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                          <label className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                            مدیر مستقیم
                            <select
                              value={employeeManagers[employee.id] ?? employee.managerId ?? ''}
                              onChange={(event) =>
                                setEmployeeManagers((current) => ({
                                  ...current,
                                  [employee.id]: event.target.value,
                                }))
                              }
                              className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground"
                            >
                              <option value="">بدون مدیر مستقیم</option>
                              {overview.employees
                                .filter((candidate) => candidate.id !== employee.id)
                                .map((candidate) => (
                                  <option key={candidate.id} value={candidate.id}>
                                    {employeeName(candidate)}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            disabled={busyAction === `line:${employee.id}`}
                            onClick={() =>
                              void runAction(`line:${employee.id}`, () =>
                                settingsApi.setEmployeeManager(
                                  overview.id,
                                  employee.id,
                                  employeeManagers[employee.id] ?? employee.managerId ?? null,
                                ),
                              )
                            }
                            className="mt-4 rounded-lg border border-border p-2 text-foreground disabled:opacity-50"
                            aria-label={`ثبت مدیر مستقیم ${employeeName(employee)}`}
                          >
                            <Save size={14} />
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-foreground">
              تیم‌ها ({overview.teams.length})
            </h4>
            {canEdit && !teamFormOpen && (
              <button
                type="button"
                onClick={() => startTeamEdit()}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
              >
                <Plus size={14} /> تیم جدید
              </button>
            )}
          </div>

          {teamFormOpen && canEdit && (
            <form onSubmit={(event) => void submitTeam(event)} className="space-y-3 rounded-lg border border-emerald-200 p-3 dark:border-emerald-900">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  required
                  maxLength={100}
                  value={teamForm.name}
                  onChange={(event) => setTeamForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="نام تیم"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <input
                  required
                  maxLength={50}
                  value={teamForm.code}
                  onChange={(event) => setTeamForm((current) => ({ ...current, code: event.target.value }))}
                  placeholder="کد تیم"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              {overview.employees.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  ابتدا کارمند را به دپارتمان اضافه کنید، سپس تیم بسازید.
                </p>
              ) : (
                <>
                  <label className="block text-xs text-muted-foreground">
                    سرپرست تیم
                    <select
                      value={teamForm.managerEmployeeId}
                      onChange={(event) => setTeamForm((current) => ({ ...current, managerEmployeeId: event.target.value, employeeIds: event.target.value && !current.employeeIds.includes(event.target.value) ? [...current.employeeIds, event.target.value] : current.employeeIds }))}
                      className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">تعیین نشده</option>
                      {overview.employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employeeName(employee)} — {employee.jobTitle || employee.employeeCode}
                        </option>
                      ))}
                    </select>
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold text-muted-foreground">
                      اعضای تیم
                    </legend>
                    <div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                      {overview.employees.map((employee) => (
                        <label key={employee.id} className="flex items-center gap-2 text-xs text-foreground">
                          <input
                            type="checkbox"
                            checked={teamForm.employeeIds.includes(employee.id)}
                            onChange={(event) =>
                              setTeamForm((current) => ({
                                ...current,
                                employeeIds: event.target.checked
                                  ? [...current.employeeIds, employee.id]
                                  : current.employeeIds.filter((id) => id !== employee.id),
                              }))
                            }
                          />
                          {employeeName(employee)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTeamForm(EMPTY_TEAM);
                    setTeamFormOpen(false);
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={busyAction === 'team' || overview.employees.length === 0}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {teamForm.id ? 'ذخیره تغییرات تیم' : 'ثبت تیم'}
                </button>
              </div>
            </form>
          )}

          {overview.teams.length === 0 ? (
            <p className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              هنوز تیمی برای این دپارتمان تعریف نشده است.
            </p>
          ) : (
            <div className="space-y-3">
              {overview.teams.map((team) => (
                <article key={team.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-sm font-semibold text-foreground">
                        {team.name} <span className="font-mono text-xs text-muted-foreground">({team.code})</span>
                      </h5>
                      <p className="mt-1 text-xs text-muted-foreground">
                        سرپرست: {team.manager ? employeeName(team.manager) : 'تعیین نشده'} · {team.memberCount} نفر
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startTeamEdit(team)}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-muted"
                          aria-label={`ویرایش تیم ${team.name}`}
                        >
                          <Users size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={busyAction === `delete:${team.id}`}
                          onClick={() => {
                            if (window.confirm(`تیم «${team.name}» حذف شود؟`)) {
                              void runAction(`delete:${team.id}`, () =>
                                settingsApi.deleteDepartmentTeam(team.id),
                              );
                            }
                          }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                          aria-label={`حذف تیم ${team.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {team.members.map((member) => (
                      <span key={member.id} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
                        {employeeName(member)}
                      </span>
                    ))}
                    {team.members.length === 0 && (
                      <span className="text-xs text-muted-foreground">عضوی ثبت نشده است.</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
