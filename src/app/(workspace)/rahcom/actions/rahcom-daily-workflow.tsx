'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clipboard, FileSpreadsheet, LoaderCircle, Save, Sparkles } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomActivity, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';

const workflowTypes = ['SYSTEM_CODES', 'VISIT_PLAN', 'COMPLETION_REPORT', 'DAILY_NOTE', 'EXCEL_UPDATE'] as const;
const completedMarker = '__COMPLETED__';
const card = 'rounded-xl border border-border bg-background/40 p-4';
const title = 'mb-2 flex items-center justify-between gap-2 font-semibold';
const button = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-60';

export function RahcomDailyWorkflow({ date, province, items, systems, onSaved }: { date: string | null; province: string; items: RahcomActivity[]; systems: RahcomSystem[]; onSaved: () => Promise<void> }) {
  const { locale } = usePreferences();
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const records = useMemo(() => Object.fromEntries(workflowTypes.map(type => [type, items.find(item => item.activityType === type && item.provinceSnapshot === province) ?? null])) as Record<typeof workflowTypes[number], RahcomActivity | null>, [items, province]);
  const [codes, setCodes] = useState('');
  const [plan, setPlan] = useState('');
  const [report, setReport] = useState('');
  const [note, setNote] = useState('');
  const [excelName, setExcelName] = useState('');
  const [excelDone, setExcelDone] = useState(false);
  const [saving, setSaving] = useState('');
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    setCodes(records.SYSTEM_CODES?.description ?? '');
    setPlan(records.VISIT_PLAN?.description ?? '');
    setReport(records.COMPLETION_REPORT?.description ?? '');
    setNote(records.DAILY_NOTE?.description ?? '');
    const excel = records.EXCEL_UPDATE?.description ?? '';
    setExcelDone(Boolean(excel));
    setExcelName(excel === completedMarker ? '' : excel);
  }, [records]);

  const codeList = useMemo(() => [...new Set(codes.split(/[\s,،;؛]+/).map(code => code.trim()).filter(Boolean))], [codes]);
  const selectedSystems = useMemo(() => codeList.map(systemCode => systems.find(system => system.systemCode.toLocaleLowerCase() === systemCode.toLocaleLowerCase())).filter((system): system is RahcomSystem => Boolean(system)), [codeList, systems]);
  const missingCodes = codeList.filter(code => !systems.some(system => system.systemCode.toLocaleLowerCase() === code.toLocaleLowerCase()));
  const jalaliDate = date ? formatJalaliDate(date) : '';
  const provinceName = iranProvinces.find(([id]) => id === province)?.[1] ?? province;
  const deadline = date ? (() => { const d = new Date(date + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return formatJalaliDate(d.toISOString().slice(0, 10)); })() : '';

  async function save(stage: string, nextExcelDone = excelDone, nextExcelName = excelName) {
    if (!date || !province) return false;
    setSaving(stage); setError('');
    try {
      await rahcomApi.saveDailyWorkflow({ date, province, systemCodes: codes, visitPlan: plan, completionReport: report, dailyNote: note, excelUpdated: nextExcelDone, excelFileName: nextExcelName });
      await onSaved();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save daily workflow.'); return false; }
    finally { setSaving(''); }
  }
  function systemDescription(code: string) {
    const system = systems.find(item => item.systemCode.toLocaleLowerCase() === code.toLocaleLowerCase());
    return system ? '، ' + system.systemName + (system.announcedAxis || system.axis ? '، محور ' + (system.announcedAxis || system.axis) : '') : '';
  }
  function generatePlan() {
    const entries = codeList.map((code, index) => (index + 1) + '. سامانه ' + code + systemDescription(code) + ':\nشرح برنامه مراجعه را وارد کنید.');
    setPlan('استان: ' + provinceName + '\nتاریخ: ' + jalaliDate + '\nبرنامه مراجعه\n\n' + entries.join('\n\n'));
  }
  function generateReport() {
    const entries = codeList.map((code, index) => (index + 1) + '. سامانه ' + code + systemDescription(code) + ':\nشرح اقدام و نتیجه را وارد کنید.');
    setReport('استان: ' + provinceName + '\nتاریخ: ' + jalaliDate + '\nگزارش تکمیلی پایان کار\n\nمراجعه موفق تعداد: [تعداد] مورد\n\n' + entries.join('\n\n') + '\n\nسایر اقدامات:\n[در صورت وجود وارد کنید]');
  }
  async function copyText(kind: 'plan' | 'report', text: string) {
    if (!text.trim()) return;
    try { await navigator.clipboard.writeText(text); setCopied(kind); window.setTimeout(() => setCopied(value => value === kind ? '' : value), 1800); }
    catch { setError('Copy failed. Check clipboard permissions.'); }
  }
  async function downloadExcel() {
    if (!date) return;
    const filename = (excelName.trim() || 'گزارش-روزانه-' + date).replace(/[\\/:*?"<>|]/g, '-').replace(/\.xlsx$/i, '') + '.xlsx';
    const saved = await save('excel', true, filename);
    if (!saved) return;
    setExcelDone(true); setExcelName(filename);
    const workbook = XLSX.utils.book_new();
    const systemRows = selectedSystems.length
      ? selectedSystems.map((system, index) => [index + 1, system.systemCode, system.systemName, system.announcedAxis || system.axis || '', system.axisCode || '', system.province])
      : codeList.map((code, index) => [index + 1, code, '', '', '', province]);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['ردیف', 'کد سامانه', 'نام سامانه', 'نام محور', 'کد محور', 'استان'], ...systemRows]), 'سامانه‌ها');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['استان', provinceName], ['تاریخ', jalaliDate], [], ['برنامه مراجعه'], [plan], [], ['گزارش تکمیلی پایان کار'], [report], [], ['یادداشت روزانه'], [note]]), 'گزارش روزانه');
    XLSX.writeFile(workbook, filename);
  }

  return <section className="mb-5 space-y-3" aria-label={t('rahcomDailyWorkflow')}>
    <h3 className="font-bold">{t('rahcomDailyWorkflow')}</h3>
    <div className="grid gap-3 lg:grid-cols-2">
      <div className={card}>
        <div className={title}><span>{t('rahcomWorkflowCodes')}</span><span className="text-xs text-muted-foreground">{records.SYSTEM_CODES ? t('rahcomWorkflowSaved') : t('rahcomWorkflowPending')}</span></div>
        <textarea maxLength={10000} value={codes} onChange={e => setCodes(e.target.value)} placeholder={t('rahcomWorkflowCodesPlaceholder')} className="min-h-24 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm text-foreground" dir="auto"/>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" disabled={!date || saving !== ''} onClick={() => void save('codes')} className={button}>{saving === 'codes' ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/>} {t('rahcomSave')}</button>
          <span className="text-xs text-muted-foreground">{selectedSystems.length} / {codeList.length} سامانه</span>
          {missingCodes.length > 0 && <span className="text-xs text-amber-500">کدهای پیدا نشده: {missingCodes.join('، ')}</span>}
        </div>
      </div>
      <div className={card}>
        <div className={title}><span>{t('rahcomWorkflowPlan')}</span><span className="text-xs text-muted-foreground">{records.VISIT_PLAN ? t('rahcomWorkflowSaved') : t('rahcomWorkflowPending')}</span></div>
        <textarea maxLength={10000} value={plan} onChange={e => setPlan(e.target.value)} placeholder={t('rahcomWorkflowPlanPlaceholder')} className="min-h-32 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm text-foreground" dir="auto"/>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={!codeList.length} onClick={generatePlan} className={button}><Sparkles size={15}/>{t('rahcomWorkflowGeneratePlan')}</button>
          <button type="button" disabled={!plan.trim()} onClick={() => void copyText('plan', plan)} className={button}>{copied === 'plan' ? <Check size={15}/> : <Clipboard size={15}/ >}{copied === 'plan' ? t('rahcomWorkflowCopied') : t('rahcomWorkflowCopy')}</button>
          <button type="button" disabled={!date || saving !== ''} onClick={() => void save('plan')} className={button}>{saving === 'plan' ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/ >}{t('rahcomSave')}</button>
        </div>
      </div>
      <div className={card}>
        <div className={title}><span>{t('rahcomWorkflowReport')}</span><span className="text-xs text-muted-foreground">{records.COMPLETION_REPORT ? t('rahcomWorkflowSaved') : t('rahcomWorkflowPending')}</span></div>
        <textarea maxLength={10000} value={report} onChange={e => setReport(e.target.value)} placeholder={t('rahcomWorkflowReportPlaceholder')} className="min-h-32 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm text-foreground" dir="auto"/>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" disabled={!codeList.length} onClick={generateReport} className={button}><Sparkles size={15}/>{t('rahcomWorkflowGenerateReport')}</button>
          <button type="button" disabled={!report.trim()} onClick={() => void copyText('report', report)} className={button}>{copied === 'report' ? <Check size={15}/> : <Clipboard size={15}/ >}{copied === 'report' ? t('rahcomWorkflowCopied') : t('rahcomWorkflowCopy')}</button>
          <button type="button" disabled={!date || saving !== ''} onClick={() => void save('report')} className={button}>{saving === 'report' ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/ >}{t('rahcomSave')}</button>
        </div>
      </div>
      <div className={card}>
        <div className={title}><span>{t('rahcomWorkflowNote')}</span><span className="text-xs text-muted-foreground">{records.DAILY_NOTE ? t('rahcomWorkflowSaved') : t('rahcomWorkflowPending')}</span></div>
        <textarea maxLength={10000} value={note} onChange={e => setNote(e.target.value)} placeholder={t('rahcomWorkflowNotePlaceholder')} className="min-h-32 w-full resize-y rounded-lg border border-border bg-card p-3 text-sm text-foreground" dir="auto"/>
        <button type="button" disabled={!date || saving !== ''} onClick={() => void save('note')} className={button + ' mt-2'}>{saving === 'note' ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/ >}{t('rahcomSave')}</button>
      </div>
      <div className={card}>
        <div className={title}><span>{t('rahcomWorkflowExcel')}</span><span className="text-xs text-muted-foreground">{records.EXCEL_UPDATE ? t('rahcomWorkflowSaved') : t('rahcomWorkflowPending')}</span></div>
        <p className="mb-3 text-sm text-muted-foreground">{t('rahcomWorkflowDeadline')}: {deadline || '—'}</p>
        <label className="mb-3 grid gap-1 text-xs text-muted-foreground">{t('rahcomWorkflowExcelFileName')}<input maxLength={255} value={excelName} onChange={e => setExcelName(e.target.value)} className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground"/></label>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!date || saving !== ''} onClick={() => void downloadExcel()} className={button}>{saving === 'excel' ? <LoaderCircle size={15} className="animate-spin"/> : <FileSpreadsheet size={15}/ >}{t('rahcomWorkflowDownloadExcel')}</button>
          <button type="button" disabled={!date || saving !== ''} onClick={() => { const next = !excelDone; setExcelDone(next); void save('excel', next); }} className={button}>{saving === 'excel' ? <LoaderCircle size={15} className="animate-spin"/> : excelDone ? <Check size={15}/> : <FileSpreadsheet size={15}/ >}{excelDone ? t('rahcomWorkflowMarkExcelPending') : t('rahcomWorkflowMarkExcelDone')}</button>
        </div>
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
