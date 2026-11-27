'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { getLocaleDirection, usePreferences } from '@/components/providers/preferences-provider';
import { RahcomDataListLayout, RahcomDataListToolbar } from '@/components/rahcom/data-list-layout';
import { RahcomTableCount } from '@/components/rahcom/table';
import { RahcomTable } from '@/components/rahcom/table';
import { RahcomInfoHeader, RahcomRowInfo } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';
import { useBackupActionsPreference } from '@/components/rahcom/use-backup-actions-preference';
import { uiMessage } from '@/lib/ui-messages';
import { getAccessToken } from '@/lib/api-client';
import { rahcomApi, type RahcomAccess, type RahcomMissionDefaults, type RahcomMissionList } from '@/lib/api/rahcom/rahcom-api';

const provinceId = 'isfahan';
const normalize = (value: string) => value.trim().normalize('NFKC')
  .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[\s\u200c\u200f]/g, '').toLocaleLowerCase();
const cellText = (value: unknown) => value == null ? '' : String(value).trim();

type ParsedMissionWorkbook = Pick<RahcomMissionList, 'fileName' | 'sheetName' | 'headers' | 'rows'>;
type MissionDefaultValues = Omit<RahcomMissionDefaults, 'updatedAt'>;
const initialMissionDefaults: MissionDefaultValues = {
  province: provinceId,
  requestType: 'ماموریت',
  provincialManager: 'کیانوش بیرانوند',
  missionField: 'برون شهری عملیاتی',
  provincialOfficeSupervisor: 'علی چنگانی',
  provincialOperationsExpert: 'نیکتا ایزدی',
};

function parseMissionWorkbook(fileName: string, workbook: XLSX.WorkBook): ParsedMissionWorkbook {
  const preferredSheet = workbook.Sheets['Data-Rp'];
  const sheetName = preferredSheet ? 'Data-Rp' : workbook.SheetNames[0];
  const sheet = preferredSheet ?? workbook.Sheets[sheetName];
  if (!sheet) throw new Error('برگهٔ گزارش در فایل اکسل پیدا نشد.');
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '' });
  const maxColumns = Math.max(...matrix.map((row) => row.length));
  const hasGroupedHeaders = (sheet['!merges'] ?? []).some((merge) => merge.s.r === 0 && merge.e.r === 0 && merge.e.c > merge.s.c);
  const provinceHeaderRow = [0, 1].find((rowIndex) =>
    Array.from({ length: maxColumns }, (_, column) => normalize(cellText(matrix[rowIndex]?.[column])))
      .includes(normalize('استان')),
  );
  if (provinceHeaderRow === undefined) throw new Error('ستون استان در فایل اکسل پیدا نشد.');
  const dataStartRow = hasGroupedHeaders ? 2 : provinceHeaderRow + 1;
  if (matrix.length <= dataStartRow) throw new Error('ساختار فایل یا ردیف‌های گزارش معتبر نیست.');
  const populatedColumns = Array.from({ length: maxColumns }, (_, column) => column)
    .filter((column) => matrix.slice(dataStartRow).some((row) => cellText(row[column]) !== ''));
  const provinceColumn = populatedColumns.find((column) => normalize(cellText(matrix[provinceHeaderRow]?.[column])) === normalize('استان'));
  if (provinceColumn === undefined) throw new Error('ستون استان در فایل اکسل پیدا نشد.');

  const headers = populatedColumns.map((column) => {
    const top = cellText(matrix[0]?.[column]);
    const sub = hasGroupedHeaders ? cellText(matrix[1]?.[column]) : '';
    const parent = hasGroupedHeaders ? (sheet['!merges'] ?? []).find((merge) => merge.s.r === 0 && merge.s.c <= column && merge.e.c >= column) : undefined;
    const group = parent ? cellText(matrix[0]?.[parent.s.c]) : top;
    const header = group && sub && normalize(group) !== normalize(sub) ? `${group} — ${sub}` : (sub || group);
    return header || `ستون بدون عنوان (${XLSX.utils.encode_col(column)})`;
  });
  const uniqueHeaders = headers.map((header, index) => headers.indexOf(header) === index ? header : `${header} (${index + 1})`);
  const rows = matrix.slice(dataStartRow).map((row) => populatedColumns.map((column) => cellText(row[column])))
    .filter((row) => row.some(Boolean));
  const provinceIndex = populatedColumns.indexOf(provinceColumn);
  if (!rows.length || rows.some((row) => !['اصفهان', 'isfahan'].includes(normalize(row[provinceIndex] ?? ''))))
    throw new Error('فایل باید فقط شامل گزارش‌های استان اصفهان باشد.');

  return { fileName, sheetName, headers: uniqueHeaders, rows };
}

export default function DocumentsMissionPage() {
  const { locale } = usePreferences();
  const { open: backupActionsOpen, toggle: toggleBackupActions } = useBackupActionsPreference();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [access, setAccess] = useState<RahcomAccess | null>(null);
  const [list, setList] = useState<RahcomMissionList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [wrap, setWrap] = useState(false);
  const [missionDefaults, setMissionDefaults] = useState<MissionDefaultValues>(initialMissionDefaults);
  const [draftMissionDefaults, setDraftMissionDefaults] = useState<MissionDefaultValues>(initialMissionDefaults);
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [defaultsError, setDefaultsError] = useState('');
  const [defaultsSaved, setDefaultsSaved] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const currentAccess = await rahcomApi.access();
      setAccess(currentAccess);
      if ((currentAccess.selectedProvince ?? currentAccess.province) !== provinceId) {
        setList(null);
        setLoadError(uiMessage(locale, 'rahcomProvinceSelectionRequired'));
        return;
      }
      setList(await rahcomApi.missionList(provinceId));
      try {
        const savedDefaults = await rahcomApi.missionDefaults(provinceId);
        if (savedDefaults) {
          setMissionDefaults(savedDefaults);
        } else {
          setMissionDefaults(initialMissionDefaults);
        }
      } catch {
        setMissionDefaults(initialMissionDefaults);
      }
    } catch {
      setLoadError('بارگذاری گزارش‌های مأموریت ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => { void refresh(); }, [refresh]);

  const filteredRows = useMemo(() => {
    const search = normalize(query);
    if (!search) return list?.rows ?? [];
    return (list?.rows ?? []).filter((row) => row.some((cell) => normalize(cell).includes(search)));
  }, [list, query]);

  const uploadWorkbook = async (file?: File) => {
    if (!file) return;
    setOperationError('');
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const parsed = parseMissionWorkbook(file.name, workbook);
      if (list?.rows.length && !window.confirm(`فهرست فعلی ${list.rows.length} ردیف دارد. با واردکردن این فایل، فهرست استان اصفهان با ${parsed.rows.length} ردیف جایگزین شود؟`)) return;
      const saved = await rahcomApi.replaceMissionList({ province: provinceId, ...parsed });
      setList({ province: provinceId, ...parsed, rowCount: saved.rowCount, updatedAt: saved.updatedAt });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'واردکردن فایل انجام نشد.');
    } finally {
      setBusy(false);
    }
  };

  const restoreMissionBackup = async () => {
    if (busy || loading || !canManage) return;
    const token = getAccessToken();
    if (!token) { setOperationError(uiMessage(locale, 'rahcomSystemsLoadError')); return; }
    setOperationError('');
    setBusy(true);
    try {
      const response = await fetch('/api/provinces/isfahan/missions/backup', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(uiMessage(locale, 'rahcomSystemsLoadError'));
      const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: 'array' });
      const parsed = parseMissionWorkbook('ESF-missions.xlsx', workbook);
      if (list?.rows.length && !window.confirm(`ÙÙ‡Ø±Ø³Øª ÙØ¹Ù„ÛŒ ${list.rows.length} Ø±Ø¯ÛŒÙ Ø¯Ø§Ø±Ø¯. Ø¨Ø§ Ø¨Ø§Ø²ÛŒØ§Ø¨ÛŒ Ù¾Ø´ØªÛŒØ¨Ø§Ù† Ø§ØµÙÙ‡Ø§Ù†ØŒ ÙÙ‡Ø±Ø³Øª Ø¬Ø§ÛŒÚ¯Ø²ÛŒÙ† Ø´ÙˆØ¯ØŸ`)) return;
      const saved = await rahcomApi.replaceMissionList({ province: provinceId, ...parsed });
      setList({ province: provinceId, ...parsed, rowCount: saved.rowCount, updatedAt: saved.updatedAt });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : uiMessage(locale, 'rahcomSystemsLoadError'));
    } finally {
      setBusy(false);
    }
  };

  const downloadWorkbook = (rows = list?.rows) => {
    if (!list || !rows) return;
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([list.headers, ...rows]);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Data-Rp');
    XLSX.writeFile(workbook, 'ESF-missions.xlsx');
  };

  const canManage = Boolean(access?.canManageAssignments);
  const saveMissionDefaults = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingDefaults(true);
    setDefaultsError('');
    setDefaultsSaved(false);
    try {
      const saved = await rahcomApi.saveMissionDefaults({ ...draftMissionDefaults, province: provinceId });
      const { updatedAt: _updatedAt, ...values } = saved;
      setMissionDefaults(values);
      setDefaultsSaved(true);
    } catch (error) {
      setDefaultsError(error instanceof Error ? error.message : 'ذخیرهٔ پیش‌فرض‌های مأموریت انجام نشد.');
    } finally {
      setSavingDefaults(false);
    }
  };
  const toolbar = <RahcomDataListToolbar
    compactOnNarrow
    count={filteredRows.length > 0 && <RahcomTableCount label={`${filteredRows.length.toLocaleString(locale)} ${uiMessage(locale, 'hrRequestsMission')}`} title={uiMessage(locale, 'hrRequestsMission')}>{filteredRows.length.toLocaleString(locale)}</RahcomTableCount>}
    wrap={{ label: 'نمایش متن کامل', singleLineLabel: 'نمایش تک‌خطی', pressed: wrap, onToggle: () => setWrap((value) => !value), disabled: !list }}
    download={{ label: uiMessage(locale, 'solarDownloadExcel'), onClick: () => downloadWorkbook(filteredRows), disabled: !list || loading }}
    search={{ value: query, onChange: setQuery, placeholder: uiMessage(locale, 'searchDescription'), label: uiMessage(locale, 'searchDescription'), clearLabel: uiMessage(locale, 'searchClear') }}
    settings={canManage ? { label: 'تنظیم پیش‌فرض مأموریت‌های اصفهان', onClick: () => { setDraftMissionDefaults(missionDefaults); setDefaultsError(''); setDefaultsSaved(false); setDefaultsDialogOpen(true); }, disabled: loading } : undefined}
    backup={canManage ? {
      open: backupActionsOpen,
      onToggle: toggleBackupActions,
      label: uiMessage(locale, 'rahcomSaveSystemsBackup'),
      controlsId: 'missions-backup-actions',
      save: { label: uiMessage(locale, 'rahcomSaveSystemsBackup'), onClick: () => downloadWorkbook(), disabled: loading || !list },
      restore: { label: uiMessage(locale, 'rahcomRestoreSystemsBackup'), onClick: () => void restoreMissionBackup(), disabled: loading || busy || (access?.selectedProvince ?? access?.province) !== provinceId, busy },
    } : undefined}
  />;

  return <main dir={getLocaleDirection(locale)} className="h-full min-h-0 w-full min-w-0">
    <input ref={uploadRef} type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void uploadWorkbook(file); }} />
    {defaultsDialogOpen && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) setDefaultsDialogOpen(false); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="mission-defaults-title" onSubmit={(event) => void saveMissionDefaults(event)} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl">
        <div className="flex items-center justify-between gap-3"><h2 id="mission-defaults-title" className="text-lg font-bold">پیش‌فرض مأموریت‌های استان اصفهان</h2><button type="button" onClick={() => setDefaultsDialogOpen(false)} className="rounded-lg border border-border px-3 py-1.5 text-sm">بستن</button></div>
        <p className="text-sm text-muted-foreground">این مقادیر برای استفادهٔ دوباره در فرم ثبت مأموریت ذخیره می‌شوند.</p>
        {([
          ['requestType', 'نوع درخواست'],
          ['provincialManager', 'مدیر استان'],
          ['missionField', 'زمینه مأموریت'],
          ['provincialOfficeSupervisor', 'سرپرست دفتر استان'],
          ['provincialOperationsExpert', 'کارشناس عملیات استان'],
        ] as const).map(([key, label]) => <label key={key} className="grid gap-1.5 text-sm"><span className="font-medium">{label}</span><input required maxLength={200} value={draftMissionDefaults[key]} onChange={(event) => setDraftMissionDefaults((current) => ({ ...current, [key]: event.target.value }))} className="h-10 rounded-lg border border-border bg-background px-3" /></label>)}
        {defaultsError && <p role="alert" className="text-sm text-destructive">{defaultsError}</p>}
        {defaultsSaved && <p role="status" className="text-sm text-emerald-600">پیش‌فرض‌ها در پایگاه داده ذخیره شدند.</p>}
        <div className="flex justify-end"><button type="submit" disabled={savingDefaults} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{savingDefaults ? 'در حال ذخیره…' : 'ذخیره پیش‌فرض‌ها'}</button></div>
      </form>
    </div>}
    <RahcomDataListLayout
      dir={getLocaleDirection(locale)} toolbar={toolbar} compactToolbarSpacing isLoading={loading}
      loadingMessage={uiMessage(locale, 'reportsLoading')} error={loadError}
      emptyMessage={uiMessage(locale, query.trim() ? 'searchNoResults' : 'rahcomRoadListNoData')} hasRows={filteredRows.length > 0}
      beforeResults={operationError ? <p role="alert" className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">{operationError}</p> : undefined}
    >
      <RahcomTable className="rahcom-sticky-table w-full min-w-max text-sm">
        <thead className="bg-muted/50"><tr>
          <th className="whitespace-nowrap p-3 text-center align-middle">{uiMessage(locale, 'rahcomRowNumber')}</th>
          <th className="w-9 whitespace-nowrap px-1 py-3 text-center"><RahcomInfoHeader /></th>
          {(list?.headers ?? []).map((header, index) => <th key={`${index}-${header}`} className="whitespace-nowrap p-3 text-start">{header}</th>)}
        </tr></thead>
        <tbody>{filteredRows.map((row, rowIndex) => <tr key={`${row[0] ?? 'mission'}-${rowIndex}`} className="border-t border-border text-foreground hover:bg-muted/40">
          <td className="p-2 text-center tabular-nums">{(rowIndex + 1).toLocaleString(locale)}</td>
          <td className="w-9 px-1 py-1 text-center"><RahcomRowInfo title={row[0] || row[1] || uiMessage(locale, 'hrRequestsMission')} fields={(list?.headers ?? []).map((header, index) => ({ label: header, value: row[index] ?? '' }))} /></td>
          {(list?.headers ?? []).map((_, columnIndex) => <td key={columnIndex} className={`max-w-72 p-2 ${wrap ? 'whitespace-normal' : 'truncate whitespace-nowrap'}`} title={row[columnIndex] ?? ''}>{row[columnIndex] ?? '—'}</td>)}
        </tr>)}</tbody>
      </RahcomTable>
    </RahcomDataListLayout>
  </main>;
}
