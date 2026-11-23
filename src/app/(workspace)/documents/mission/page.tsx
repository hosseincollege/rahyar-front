'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BriefcaseBusiness, LoaderCircle, Send } from 'lucide-react';
import { getLocaleDirection, usePreferences } from '@/components/providers/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { businessTripsApi, type BusinessTripRequest, type BusinessTripStatus } from '@/lib/api/business-trips-api';

const statusKeys: Record<BusinessTripStatus, 'hrLeavePending' | 'hrLeaveApproved' | 'hrLeaveRejected' | 'hrRequestStatusCancelled'> = {
  PENDING: 'hrLeavePending',
  APPROVED: 'hrLeaveApproved',
  REJECTED: 'hrLeaveRejected',
  CANCELLED: 'hrRequestStatusCancelled',
};

export default function DocumentsMissionPage() {
  const { locale } = usePreferences();
  const [requests, setRequests] = useState<BusinessTripRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [destination, setDestination] = useState('');
  const [purpose, setPurpose] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');

  useEffect(() => {
    let active = true;
    void businessTripsApi.listMine()
      .then((items) => { if (active) setRequests(items); })
      .catch(() => { if (active) setLoadFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveFailed(false);
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      setSaveFailed(true);
      return;
    }

    setSaving(true);
    try {
      const created = await businessTripsApi.create({
        destination: destination.trim(),
        purpose: purpose.trim(),
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        ...(estimatedCost.trim() ? { estimatedCost: Number(estimatedCost) } : {}),
      });
      setRequests((current) => [created, ...current]);
      setDestination('');
      setPurpose('');
      setStartAt('');
      setEndAt('');
      setEstimatedCost('');
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const statusClass = (status: BusinessTripStatus) => {
    if (status === 'APPROVED') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
    if (status === 'REJECTED') return 'bg-destructive/10 text-destructive';
    if (status === 'CANCELLED') return 'bg-muted text-muted-foreground';
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  };

  return (
    <main dir={getLocaleDirection(locale)} className="mx-auto max-w-5xl space-y-5 p-3 sm:p-5">
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BriefcaseBusiness size={20} aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">{uiMessage(locale, 'hrRequestsMission')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{uiMessage(locale, 'hrTripRequestNew')}</p>
        </div>
      </header>

      <form onSubmit={(event) => void submitRequest(event)} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-5">
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">{uiMessage(locale, 'hrTripDestination')}</span>
          <input required maxLength={160} value={destination} onChange={(event) => setDestination(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="font-medium">{uiMessage(locale, 'hrTripPurpose')}</span>
          <textarea required maxLength={4000} rows={3} value={purpose} onChange={(event) => setPurpose(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{uiMessage(locale, 'hrTripStartAt')}</span>
          <input required type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">{uiMessage(locale, 'hrTripEndAt')}</span>
          <input required type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" />
        </label>
        <label className="grid gap-1.5 text-sm sm:max-w-sm">
          <span className="font-medium">{uiMessage(locale, 'hrTripEstimatedCost')} ({uiMessage(locale, 'hrTripCostCurrency')}: IRR)</span>
          <input type="number" min="0" step="0.01" value={estimatedCost} onChange={(event) => setEstimatedCost(event.target.value)} className="h-10 rounded-lg border border-border bg-background px-3" dir="ltr" />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={15} />}
            {saving ? uiMessage(locale, 'preferencesSaving') : uiMessage(locale, 'hrLeaveSubmit')}
          </button>
          {saveFailed && <p role="alert" className="text-sm text-destructive">{uiMessage(locale, 'hrTripSaveFailed')}</p>}
        </div>
      </form>

      <section className="space-y-3" aria-labelledby="mission-requests-title">
        <h2 id="mission-requests-title" className="text-base font-bold">{uiMessage(locale, 'hrTripDuration')}</h2>
        {loading ? (
          <div className="flex min-h-12 items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle size={16} className="animate-spin" />{uiMessage(locale, 'preferencesSaving')}</div>
        ) : loadFailed ? (
          <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{uiMessage(locale, 'hrTripLoadFailed')}</p>
        ) : requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">{uiMessage(locale, 'hrTripEmpty')}</p>
        ) : (
          <div className="grid gap-3">
            {requests.map((request) => (
              <article key={request.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold">{request.destination}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(request.status)}`}>{uiMessage(locale, statusKeys[request.status])}</span>
                </div>
                <p className="text-sm text-muted-foreground">{request.purpose}</p>
                <p className="text-xs text-muted-foreground">{dateFormatter.format(new Date(request.startAt))} – {dateFormatter.format(new Date(request.endAt))}</p>
                {request.estimatedCost !== null && <p className="text-xs text-muted-foreground">{uiMessage(locale, 'hrTripEstimatedCost')}: {numberFormatter.format(Number(request.estimatedCost))} {request.currency}</p>}
                {request.reviewerNote && <p className="rounded-lg bg-muted/60 p-2 text-sm">{request.reviewerNote}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
