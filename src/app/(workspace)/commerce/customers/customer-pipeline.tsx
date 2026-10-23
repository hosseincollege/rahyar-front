'use client';

import { getCalendarLocale } from '@/lib/calendar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  ChevronLeft,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Target,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

import { crmApi } from '@/app/(workspace)/commerce/customers/crm-api';
import { DemoJsonToolbar } from '@/app/(workspace)/commerce/components/demo-json-toolbar';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type {
  CreateCrmLeadInput,
  CrmLead,
  LeadStatus,
} from '@/app/(workspace)/commerce/customers/types';

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: 'سرنخ جدید',
  CONTACTED: 'تماس گرفته‌شده',
  QUALIFIED: 'تبدیل‌شده',
  DISQUALIFIED: 'ردشده',
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  CONTACTED: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  QUALIFIED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  DISQUALIFIED: 'bg-muted text-muted-foreground',
};

const EMPTY_FORM: CreateCrmLeadInput = {
  topic: '',
  firstName: '',
  lastName: '',
  companyName: '',
  email: '',
  phone: '',
  source: '',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(getCalendarLocale('fa-IR'), { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

function formatMoney(value: CrmLead['estimatedRevenue']): string {
  if (value === null || value === undefined || value === '') return '—';
  return `${new Intl.NumberFormat('fa-IR').format(Number(value))} ریال`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'خطا در ارتباط با سامانه';
}

export default function CrmPage() {
  const { locale } = usePreferences();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateCrmLeadInput>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeadStatus>('ALL');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await crmApi.listLeads();
      setLeads(data);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    crmApi
      .listLeads()
      .then((data) => {
        if (isCurrent) setLeads(data);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const visibleLeads = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return leads.filter((lead) => {
      const matchesStatus =
        statusFilter === 'ALL' || lead.status === statusFilter;
      const searchableText = [
        lead.topic,
        lead.firstName,
        lead.lastName,
        lead.companyName,
        lead.email,
        lead.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return matchesStatus && searchableText.includes(normalizedSearch);
    });
  }, [leads, search, statusFilter]);

  const metrics = useMemo(() => {
    const openLeads = leads.filter(
      (lead) => lead.status === 'NEW' || lead.status === 'CONTACTED',
    );
    const pipeline = openLeads.reduce(
      (sum, lead) => sum + Number(lead.estimatedRevenue ?? 0),
      0,
    );
    return {
      total: leads.length,
      open: openLeads.length,
      converted: leads.filter((lead) => lead.status === 'QUALIFIED').length,
      pipeline,
    };
  }, [leads]);

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const input: CreateCrmLeadInput = {
        topic: form.topic.trim(),
        lastName: form.lastName.trim(),
      };
      for (const key of [
        'firstName',
        'companyName',
        'jobTitle',
        'email',
        'phone',
        'source',
      ] as const) {
        const value = form[key]?.trim();
        if (value) input[key] = value;
      }
      if (
        form.estimatedRevenue !== undefined &&
        Number.isFinite(form.estimatedRevenue)
      ) {
        input.estimatedRevenue = form.estimatedRevenue;
      }
      await crmApi.createLead(input);
      setForm(EMPTY_FORM);
      setDialogOpen(false);
      setNotice('سرنخ با موفقیت ثبت شد.');
      await loadLeads();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleQualify(lead: CrmLead) {
    setError('');
    setNotice('');
    try {
      const result = await crmApi.qualifyLead(lead.id);
      setNotice(
        `سرنخ به فرصت «${result.opportunity.name}» تبدیل شد${
          result.account?.name
            ? ` و مشتری «${result.account.name}» ساخته شد`
            : ''
        }.`,
      );
      await loadLeads();
    } catch (qualifyError) {
      setError(errorMessage(qualifyError));
    }
  }

  async function handleMarkContacted(lead: CrmLead) {
    setError('');
    try {
      await crmApi.markLeadContacted(lead.id);
      setNotice('وضعیت سرنخ به «تماس گرفته‌شده» تغییر کرد.');
      await loadLeads();
    } catch (statusError) {
      setError(errorMessage(statusError));
    }
  }

  return (
    <div dir="rtl" className="space-y-6">
      <DemoJsonToolbar
        fileName="commercial-customers-sample.json"
        module="commercial-customers"
        data={{ leads }}
        sampleData={{ leads: [{ topic: 'درخواست معرفی خدمات', firstName: 'مینا', lastName: 'نمونه', companyName: 'شرکت نمونه', email: 'demo@example.test', phone: '02100000000', source: 'آزمایش JSON', estimatedRevenue: 100000000 }] }}
        onImport={async (dataset) => {
          const existingKeys = new Set(leads.map((lead) => `${lead.topic}|${lead.email ?? ''}|${lead.phone ?? ''}`));
          for (const row of dataset.leads) {
            const lead = row as Partial<CrmLead>;
            if (typeof lead.topic !== 'string' || !lead.topic.trim() || typeof lead.lastName !== 'string' || !lead.lastName.trim()) {
              throw new Error(uiMessage(locale, 'moduleJsonImportFailed'));
            }
            const key = `${lead.topic}|${lead.email ?? ''}|${lead.phone ?? ''}`;
            if (existingKeys.has(key)) continue;
            await crmApi.createLead({
              topic: lead.topic.trim(),
              lastName: lead.lastName.trim(),
              ...(lead.firstName ? { firstName: lead.firstName } : {}),
              ...(lead.companyName ? { companyName: lead.companyName } : {}),
              ...(lead.email ? { email: lead.email } : {}),
              ...(lead.phone ? { phone: lead.phone } : {}),
              ...(lead.source ? { source: lead.source } : {}),
              ...(lead.estimatedRevenue != null ? { estimatedRevenue: Number(lead.estimatedRevenue) } : {}),
            });
            existingKeys.add(key);
          }
          await loadLeads();
        }}
        onImportError={(importError) => {
          void loadLeads().finally(() => setError(errorMessage(importError)));
        }}
      />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            مدیریت فروش و مشتریان
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            سرنخ‌ها را ثبت کنید، پیگیری کنید و به فرصت فروش تبدیل کنید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setError('');
            setDialogOpen(true);
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          <Plus size={17} />
          سرنخ جدید
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300"
        >
          <AlertCircle size={17} />
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          <Check size={17} />
          {notice}
          <button
            className="mr-auto"
            onClick={() => setNotice('')}
            aria-label="بستن پیام"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={<UsersRound size={19} />}
          label="کل سرنخ‌ها"
          value={metrics.total}
        />
        <Metric
          icon={<Clock3 size={19} />}
          label="در جریان پیگیری"
          value={metrics.open}
        />
        <Metric
          icon={<Target size={19} />}
          label="تبدیل‌شده به فرصت"
          value={metrics.converted}
        />
        <Metric
          icon={<Building2 size={19} />}
          label="ارزش پایپ‌لاین باز"
          value={`${new Intl.NumberFormat('fa-IR').format(metrics.pipeline)} ریال`}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی نام، شرکت، ایمیل یا تلفن"
              className="h-10 w-full rounded-xl border border-border bg-background pr-9 pl-3 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'ALL' | LeadStatus)
            }
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-blue-500"
          >
            <option value="ALL">همهٔ وضعیت‌ها</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadLeads()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            تازه‌سازی
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">موضوع پیگیری</th>
                <th className="px-4 py-3 font-medium">سرنخ / شرکت</th>
                <th className="px-4 py-3 font-medium">راه ارتباطی</th>
                <th className="px-4 py-3 font-medium">ارزش تخمینی</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">ثبت‌شده</th>
                <th className="px-4 py-3 font-medium">اقدام</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    در حال دریافت سرنخ‌ها…
                  </td>
                </tr>
              ) : visibleLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <UserRound
                      className="mx-auto text-muted-foreground"
                      size={28}
                    />
                    <p className="mt-2 font-semibold">سرنخی برای نمایش نیست</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      یک سرنخ تازه ثبت کنید یا فیلتر جستجو را تغییر دهید.
                    </p>
                  </td>
                </tr>
              ) : (
                visibleLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-semibold">{lead.topic}</td>
                    <td className="px-4 py-3">
                      <div>
                        {[lead.firstName, lead.lastName]
                          .filter(Boolean)
                          .join(' ')}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {lead.companyName || 'بدون شرکت'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{lead.phone || '—'}</div>
                      <div className="mt-1">{lead.email || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {formatMoney(lead.estimatedRevenue)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[lead.status]}`}
                      >
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {lead.status === 'NEW' ? (
                        <button
                          onClick={() => void handleMarkContacted(lead)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
                        >
                          ثبت تماس <ChevronLeft size={14} />
                        </button>
                      ) : lead.status === 'CONTACTED' ? (
                        <button
                          onClick={() => void handleQualify(lead)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                        >
                          تبدیل به فرصت <ChevronLeft size={14} />
                        </button>
                      ) : lead.status === 'QUALIFIED' ? (
                        <span className="text-xs text-muted-foreground">
                          فرصت ثبت شد
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          بسته‌شده
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving)
              setDialogOpen(false);
          }}
        >
          <form
            onSubmit={handleCreateLead}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">ثبت سرنخ فروش</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  اطلاعات اولیه را ثبت کنید؛ جزئیات بعداً قابل تکمیل است.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
                aria-label="بستن"
                className="rounded-lg p-2 hover:bg-muted"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="موضوع پیگیری *">
                <input
                  required
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                />
              </Field>
              <Field label="نام خانوادگی *">
                <input
                  required
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                />
              </Field>
              <Field label="نام">
                <input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                />
              </Field>
              <Field label="شرکت">
                <input
                  value={form.companyName}
                  onChange={(e) =>
                    setForm({ ...form, companyName: e.target.value })
                  }
                />
              </Field>
              <Field label="ایمیل">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="تلفن">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
              <Field label="منبع آشنایی">
                <input
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                />
              </Field>
              <Field label="ارزش تخمینی (ریال)">
                <input
                  type="number"
                  min="0"
                  value={form.estimatedRevenue ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      estimatedRevenue: e.target.value
                        ? Number(e.target.value)
                        : undefined,
                    })
                  }
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
                className="h-10 rounded-xl border border-border px-4 text-sm"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? 'در حال ثبت…' : 'ثبت سرنخ'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <span className="block [&>input]:h-10 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-border [&>input]:bg-background [&>input]:px-3 [&>input]:text-sm [&>input]:text-foreground [&>input]:outline-none [&>input]:focus:border-blue-500">
        {children}
      </span>
    </label>
  );
}
