'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, LoaderCircle, Save } from 'lucide-react';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { rahcomApi, type RahcomSolarSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { filterRahcomLtePairs as filterLtePairs, parseRahcomSolarList as parseList, type RahcomSolarEntry as Entry } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';

const commonEquipment = ['LTE', 'RTR-1', 'RTR-2', 'CAM-1', 'RAD-1', 'RAD-2', 'PC', 'RLY', 'RLY-1', 'WL-1', 'WLP2P'];
const defaultEquipment = ['LTE', 'RTR-1', 'CAM-1', 'RAD-1'];

function jalaliParts(date: Date) {
  const values = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  return Object.fromEntries(values.map(({ type, value }) => [type, value]));
}

function currentJalaliDateTime() {
  const now = new Date();
  const dateParts = jalaliParts(now);
  const timeParts = new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const time = Object.fromEntries(timeParts.map(({ type, value }) => [type, value]));
  const pad = (value: string) => value.padStart(2, '0');
  return { date: `${dateParts.year}/${pad(dateParts.month)}/${pad(dateParts.day)}`, time: `${time.hour}:${time.minute}` };
}

function toAsciiDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) >= 0x06f0 && digit.charCodeAt(0) <= 0x06f9 ? digit.charCodeAt(0) - 0x06f0 + 48 : digit.charCodeAt(0) - 0x0660 + 48));
}

function jalaliToGregorian(jalaliDate: string) {
  const match = toAsciiDigits(jalaliDate.trim()).match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const target = match.slice(1).map(Number);
  const cursor = new Date(Date.UTC(target[0] + 621, 0, 1, 12));
  for (let offset = 0; offset < 370; offset += 1) {
    const parts = jalaliParts(cursor);
    if ([Number(parts.year), Number(parts.month), Number(parts.day)].every((part, index) => part === target[index])) {
      return { year: cursor.getUTCFullYear(), month: cursor.getUTCMonth() + 1, day: cursor.getUTCDate() };
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

function captureTimestamp(dateValue: string, timeValue: string) {
  const gregorian = jalaliToGregorian(dateValue);
  const time = toAsciiDigits(timeValue).match(/^(\d{2}):(\d{2})$/);
  if (!gregorian || !time) return null;
  const [hour, minute] = time.slice(1).map(Number);
  if (hour > 23 || minute > 59) return null;
  const wallClockAsUtc = Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-US-u-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(wallClockAsUtc));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const representedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
  return new Date(wallClockAsUtc - (representedAsUtc - wallClockAsUtc)).toISOString();
}

function StatusTable({ entries, columns, locale }: { entries: Entry[]; columns: string[]; locale: Parameters<typeof uiMessage>[0] }) {
  const sites = [...new Set(entries.map((entry) => entry.site))]
    .filter((site) => entries.some((entry) => entry.site === site && (columns.includes(entry.equipment) || (columns.includes('LTE') && /^LTE-[12]$/i.test(entry.equipment)))))
    .sort();
  const bySiteEquipment = new Map(entries.map((entry) => [`${entry.site}:${entry.equipment}`, entry.state]));
  return <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="p-3 text-start">{uiMessage(locale, 'solarSiteCode')}</th>{columns.map((item) => <th key={item} className="p-3 text-center" dir="ltr">{item}</th>)}</tr></thead><tbody>{sites.length === 0 ? <tr><td colSpan={columns.length + 1} className="p-4 text-center text-muted-foreground">{uiMessage(locale, 'solarNoEntries')}</td></tr> : sites.map((site) => <tr key={site} className="border-t border-border"><th className="p-3 text-start font-mono" dir="ltr">{site}</th>{columns.map((item) => {
    const lteEntries = item === 'LTE' ? entries.filter((entry) => entry.site === site && /^LTE-[12]$/i.test(entry.equipment)) : [];
    const state = bySiteEquipment.get(`${site}:${item}`);
    return <td key={item} className="p-3 text-center">{item === 'LTE' && lteEntries.length ? <span className="inline-flex flex-row flex-nowrap items-center gap-1 whitespace-nowrap" dir="ltr">{lteEntries.map((entry, index) => <span key={entry.equipment} className={entry.state === 'down' ? 'font-medium text-red-600' : 'font-medium text-slate-500'}>{index > 0 ? ', ' : ''}{entry.equipment} {entry.state === 'down' ? '🔴' : '⚪'}</span>)}</span> : state ? <span className={state === 'down' ? 'font-medium text-red-600' : 'font-medium text-slate-500'}>{state === 'down' ? '🔴' : '⚪'} {item}</span> : '—'}</td>;
  })}</tr>)}</tbody></table></div>;
}

function compareEntries(current: Entry[], previous: Entry[]) {
  const statusMap = (entries: Entry[]) => new Map(entries.map(({ site, equipment, state }) => [`${site}:${equipment}`, state]));
  const now = statusMap(current);
  const before = statusMap(previous);
  const keys = new Set([...now.keys(), ...before.keys()]);
  return [...keys].map((key) => {
    const previousState = before.get(key) ?? 'normal';
    const currentState = now.get(key) ?? 'normal';
    const separator = key.indexOf(':');
    return { site: key.slice(0, separator), equipment: key.slice(separator + 1), previousState, currentState };
  }).sort((a, b) => a.site.localeCompare(b.site) || a.equipment.localeCompare(b.equipment));
}

function formatCapturedAt(value: string, locale: Parameters<typeof uiMessage>[0]) {
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, {
    dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'Asia/Tehran',
  }).format(new Date(value));
}

export function RahcomSolarDaily({ formOpen, onFormOpenChange }: { formOpen: boolean; onFormOpenChange: (open: boolean) => void }) {
  const { locale } = usePreferences();
  const { dateText } = useRahcomDate();
  const [downText, setDownText] = useState('');
  const [unreachableText, setUnreachableText] = useState('');
  const [capturedDate, setCapturedDate] = useState('');
  const [capturedTime, setCapturedTime] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(defaultEquipment);
  const [editingColumns, setEditingColumns] = useState(false);
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const entries = useMemo(() => filterLtePairs([...parseList(downText, 'down'), ...parseList(unreachableText, 'unreachable')]), [downText, unreachableText]);
  const columns = useMemo(() => [...commonEquipment, ...[...customEquipment].sort()].filter((item) => selectedEquipment.includes(item)), [customEquipment, selectedEquipment]);
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);

  useEffect(() => {
    if (formOpen) {
      const current = currentJalaliDateTime();
      setCapturedDate(dateText);
      setCapturedTime(current.time);
    }
  }, [dateText, formOpen]);
  useEffect(() => {
    let active = true;
    void rahcomApi.solarSnapshots().then((result) => { if (active) setSnapshots(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('solarLoadFailed')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);
  useEffect(() => {
    const found = [...new Set(entries.map((entry) => entry.equipment))]
      .filter((item) => !/^LTE-[12]$/i.test(item) && !commonEquipment.includes(item) && !customEquipment.includes(item));
    if (found.length) {
      setCustomEquipment((current) => [...current, ...found]);
      setSelectedEquipment((current) => [...new Set([...current, ...found])]);
    }
  }, [customEquipment, entries]);

  async function saveSnapshot() {
    if (!downText.trim() && !unreachableText.trim()) { setError(t('solarPasteListsFirst')); return; }
    if (columns.length === 0) { setError(t('solarSelectEquipment')); return; }
    const capturedAt = captureTimestamp(capturedDate, capturedTime);
    if (!capturedAt) { setError(t('solarInvalidDateTime')); return; }
    setSaving(true); setError('');
    try {
      const snapshot = await rahcomApi.createSolarSnapshot({
        downText, unreachableText, equipmentColumns: columns,
        capturedAt,
      });
      setSnapshots((current) => [snapshot, ...current]);
      setDownText('');
      setUnreachableText('');
      onFormOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('solarSaveFailed'));
    } finally { setSaving(false); }
  }

  return <section className="space-y-5">
    {formOpen && <>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 rounded-2xl border border-border bg-card p-4"><span className="block font-semibold">{t('solarDownList')}</span><textarea value={downText} onChange={(e) => setDownText(e.target.value)} placeholder={'DOWN\nRahcom (LTE-1-...) (...) (...)'} className="min-h-48 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" dir="auto" /></label>
      <label className="space-y-2 rounded-2xl border border-border bg-card p-4"><span className="block font-semibold">{t('solarUnreachableList')}</span><textarea value={unreachableText} onChange={(e) => setUnreachableText(e.target.value)} placeholder={'Unreachable\nRahcom (CAM-1-...) (...) (...)'} className="min-h-48 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" dir="auto" /></label>
    </div>

    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{t('solarVisibleColumns')}</h2><button type="button" onClick={() => setEditingColumns((open) => !open)} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground">{t(editingColumns ? 'solarDoneEditingColumns' : 'solarEditColumns')}</button></div>{editingColumns && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{[...commonEquipment, ...[...customEquipment].sort()].map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selectedEquipment.includes(item)} onChange={(event) => setSelectedEquipment((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} />{item}</label>)}</div>}</div>
      <div className="flex flex-wrap items-end gap-3"><span className="self-center text-xs text-muted-foreground">{t('solarCaptureDate')}: {capturedDate}</span><label className="grid gap-1 text-xs text-muted-foreground">{t('solarCaptureTime')}<input type="text" inputMode="numeric" dir="ltr" placeholder="23:59" maxLength={5} value={capturedTime} onChange={(event) => setCapturedTime(event.target.value)} className="h-10 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label><button type="button" disabled={saving} onClick={() => void saveSnapshot()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{t('solarSaveSnapshot')}</button></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>

    {entries.length > 0 && <div className="space-y-2"><h2 className="font-semibold">{t('solarPreview')}</h2><StatusTable entries={entries} columns={columns} locale={locale} /></div>}
    </>}

    <div className="space-y-3"><h2 className="text-lg font-bold">{t('solarHistory')}</h2>{loading ? <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : snapshots.length === 0 ? <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('solarNoSnapshots')}</p> : snapshots.map((snapshot, index) => {
      const columns = snapshot.equipmentColumns.map((column) => /^LTE-[12]$/i.test(column) ? 'LTE' : column).filter((column, columnIndex, all) => all.indexOf(column) === columnIndex);
      const entries = filterLtePairs([...parseList(snapshot.downText, 'down'), ...parseList(snapshot.unreachableText, 'unreachable')]);
      const previousSnapshot = snapshots[index + 1];
      const previousEntries = previousSnapshot ? filterLtePairs([...parseList(previousSnapshot.downText, 'down'), ...parseList(previousSnapshot.unreachableText, 'unreachable')]) : [];
      const changes = previousSnapshot ? compareEntries(entries, previousEntries).filter((change) => columns.includes(change.equipment) || (columns.includes('LTE') && /^LTE-[12]$/i.test(change.equipment))) : [];
      return <details key={snapshot.id} className="group rounded-2xl border border-border bg-card p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold"><span className="flex items-center gap-2"><Check size={16} className="text-primary" />{formatCapturedAt(snapshot.capturedAt, locale)}</span><span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">{t('solarExpandSnapshot')}<ChevronDown size={16} className="transition-transform group-open:rotate-180" /></span></summary><div className="mt-4 space-y-4">{previousSnapshot && <section className="space-y-2 rounded-xl border border-border p-3"><h3 className="font-semibold">{t('solarChangesFromPrevious')}</h3>{changes.length === 0 ? <p className="text-sm text-muted-foreground">{t('solarNoChanges')}</p> : <ul className="space-y-1 text-sm">{changes.map((change) => <li key={`${change.site}:${change.equipment}`} dir="auto"><span className="font-mono" dir="ltr">{change.site}</span> · <span dir="ltr">{change.equipment}</span>: {t(change.previousState === 'normal' ? 'solarStatusNormal' : change.previousState === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable')} → {t(change.currentState === 'normal' ? 'solarStatusNormal' : change.currentState === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable')}{change.previousState === change.currentState ? ` · ${t('solarStatusContinued')}` : ''}</li>)}</ul>}</section>}<StatusTable entries={entries} columns={columns} locale={locale} /></div></details>;
    })}</div>
  </section>;
}
