'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, Download, FileUp, LoaderCircle, TriangleAlert } from 'lucide-react';
import { usePreferences, getLocaleDirection } from '@/components/preferences-provider';
import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi } from '@/app/(workspace)/settings/settings-api';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomRoadListSnapshot, type RahcomSolarSnapshot, type RahcomSolarSpecialSystem, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { formatJalaliDate } from '@/lib/api/rahcom/jalali-date';
import { filterRahcomLtePairs, isRahcomIncidentValue, parseRahcomSolarList, rahcomSystemKey, tehranDateKey } from '@/lib/api/rahcom/solar-status';
import { RahcomHeaderDate } from '@/app/(workspace)/rahcom/_shared/rahcom-header-date';
import { RahcomRecordSummary } from '@/app/(workspace)/rahcom/_shared/rahcom-record-summary';
import { RahcomCountCapsule } from '@/app/(workspace)/rahcom/_shared/rahcom-count-capsule';
import { SolarSnapshotPicker } from '@/app/(workspace)/rahcom/_shared/rahcom-section';

const PAGE_SIZE = 100;
const buildRoadListImagePrompt = (jalaliDate: string) => `از تصویر پیوست‌شده، جدول راهداری را با دقت از روی تصویر استخراج کن و نتیجه را به صورت یک فایل Excel با پسوند .xlsx تحویل بده.

تاریخ این فهرست ${jalaliDate} است. فایل را با نام road-list-${jalaliDate.replaceAll('/', '-')}.xlsx ذخیره کن. این تاریخ را به عنوان تاریخ فهرست در نظر بگیر؛ آن را به شکل سطر عنوان یا ستون جدید وارد جدول نکن، مگر اینکه خود تصویر چنین ستونی داشته باشد.

قواعد استخراج:
- فقط ردیف‌ها و ستون‌هایی را وارد کن که در تصویر دیده می‌شوند. فلش‌های فیلتر، نوار ابزار اکسل و عناصر رابط کاربری را داده حساب نکن.
- هر ردیف جدول دقیقاً یک ردیف در اکسل باشد. ردیف عنوان ستون‌ها فقط یک‌بار و در سطر اول فایل بیاید؛ عنوان یا توضیح اضافه بالای جدول نگذار.
- عنوان ستون کدهای هشت‌رقمی را دقیقاً «کد ایستگاه» بگذار و کد را به صورت متن نگه دار تا صفر ابتدایی یا رقم آن تغییر نکند.
- عنوان ستون نام ایستگاه را دقیقاً «نام ایستگاه» بگذار.
- عنوان ستون محور را دقیقاً «محور ایستگاه» بگذار.
- سایر ستون‌ها را با همان عنوان قابل‌خواندن در تصویر و به همان ترتیب چپ‌به‌راست جدول نگه دار؛ از جمله مواردی مثل «وضعیت فعالیت»، «استان» و «سیستم» اگر در تصویر وجود دارند. ستون‌ها یا اطلاعات تازه حدس نزن.
- اعداد فارسی و عربی را درست بخوان. کدها و مقادیر را بدون گردکردن، تبدیل قالب، حذف رقم یا تغییر محتوا ثبت کن.
- بخش ناخوانا یا نامشخص را خالی بگذار و حدس نزن. ردیف‌های تکراریِ واقعی را حذف نکن.
- سلول‌ها را به‌صورت جدول ساده و قابل بارگذاری بساز؛ از ادغام سلول‌ها، تصویر داخل فایل، فرمول، سطر جمع و قالب‌بندی پیچیده استفاده نکن.

فایل نهایی باید یک برگه داشته باشد و سطر اول آن عنوان ستون‌ها باشد. فایل Excel را برای دریافت ارائه کن.`;
const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\s_\-./()]/g, '');
const isRoadListAxisHeader = (value: string) => normalizeHeader(value).includes('\u0645\u062d\u0648\u0631') || normalizeHeader(value).includes('axis');
const isRoadListStationCodeHeader = (value: string) => {
  const normalized = normalizeHeader(value);
  const isCode = normalized.includes('\u06a9\u062f') || normalized.includes('code');
  const isStationIdentifier = normalized.includes('\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || normalized.includes('\u0633\u0627\u0645\u0627\u0646\u0647') || normalized.includes('\u0634\u0646\u0627\u0633') || normalized.includes('station') || normalized.includes('system') || normalized.includes('identifier');
  return isCode && (isStationIdentifier || normalized === '\u06a9\u062f' || normalized === 'code');
};
const isRoadListStationNameHeader = (value: string) => {
  const normalized = normalizeHeader(value);
  const isName = normalized.includes('\u0646\u0627\u0645') || normalized.includes('name');
  const isStationIdentifier = normalized.includes('\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || normalized.includes('\u0633\u0627\u0645\u0627\u0646\u0647') || normalized.includes('station') || normalized.includes('system');
  return isName && isStationIdentifier;
};
const canonicalRoadListHeader = (value: string) => isRoadListAxisHeader(value)
  ? '\u0645\u062d\u0648\u0631'
  : isRoadListStationCodeHeader(value)
    ? '\u06a9\u062f \u0627\u06cc\u0633\u062a\u06af\u0627\u0647'
    : isRoadListStationNameHeader(value)
      ? '\u0646\u0627\u0645 \u0627\u06cc\u0633\u062a\u06af\u0627\u0647'
      : value;
const classifyIncidentLabel = (value: string | null | undefined): 'solarWideningRelocation' | 'rahcomIncidentBoth' | 'rahcomIncidentTheft' | 'rahcomIncidentDamage' | null => {
  const normalized = normalizeHeader(value ?? '');
  const hasTheft = normalized.includes('\u0633\u0631\u0642\u062a') || normalized.includes('theft');
  const hasDamage = normalized.includes('\u062a\u062e\u0631\u06cc\u0628') || normalized.includes('damage');
  if (normalized.includes('\u062a\u0639\u0631\u06cc\u0636') || normalized.includes('\u062c\u0627\u0628\u0647\u062c\u0627\u06cc\u06cc') || normalized.includes('\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc') || normalized.includes('widening') || normalized.includes('relocation')) return 'solarWideningRelocation';
  if (hasTheft && hasDamage) return 'rahcomIncidentBoth';
  if (hasTheft) return 'rahcomIncidentTheft';
  if (hasDamage) return 'rahcomIncidentDamage';
  return null;
};
const isSolarHeader = (value: string) => normalizeHeader(value).includes(normalizeHeader('سولار')) || normalizeHeader(value).includes('solar') || normalizeHeader(value).includes(normalizeHeader('وضعیت لیست تردد')) || normalizeHeader(value).includes('trafficliststatus');
const normalizeIdentifier = (value: unknown) => String(value ?? '').normalize('NFKC')
  .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
  .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
  .replace(/[\u200c\s]/g, '').toLocaleUpperCase('fa');
const hasTableData = (snapshot: RahcomRoadListSnapshot) => Array.isArray(snapshot.headers)
  && Array.isArray(snapshot.rows)
  && snapshot.headers.every((header) => typeof header === 'string')
  && snapshot.rows.every((row) => Array.isArray(row));

export function RahcomRoadList() {
  const { locale } = usePreferences();
  const { date } = useRahcomDate();
  const selectedDate = date ?? tehranDateKey();
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const [canView, setCanView] = useState<boolean | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [province, setProvince] = useState('');
  const [snapshot, setSnapshot] = useState<RahcomRoadListSnapshot | null>(null);
  const [traffic, setTraffic] = useState<RahcomTrafficSnapshot | null>(null);
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [specialSystems, setSpecialSystems] = useState<RahcomSolarSpecialSystem[]>([]);
  const [solarSnapshots, setSolarSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [selectedSolarSnapshotId, setSelectedSolarSnapshotId] = useState('');
  const [showIncidents, setShowIncidents] = useState(true);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [roadListPromptCopyState, setRoadListPromptCopyState] = useState<'copied' | 'failed' | null>(null);

  useEffect(() => {
    const initialized = window.localStorage.getItem('rahcom-show-incidents-default-v2') === 'true';
    if (!initialized) {
      window.localStorage.setItem('rahcom-show-incidents', 'true');
      window.localStorage.setItem('rahcom-show-incidents-default-v2', 'true');
      setShowIncidents(true);
      return;
    }
    setShowIncidents(window.localStorage.getItem('rahcom-show-incidents') !== 'false');
  }, []);

  useEffect(() => {
    let active = true;
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) { setCanView(false); setLoading(false); return; }
    void Promise.all([settingsApi.getOrganizationAccess(organizationId), rahcomApi.access()])
      .then(([organizationAccess, rahcomAccess]) => {
        if (!active) return;
        setCanView(Boolean(organizationAccess.canViewRahcom));
        setCanManage(Boolean(organizationAccess.canManageRahcom));
        if (rahcomAccess.selectedProvince && rahcomAccess.selectedProvince !== 'all') setProvince(rahcomAccess.selectedProvince);
        else if (!rahcomAccess.isAdmin && rahcomAccess.province) setProvince(rahcomAccess.province);
      })
      .catch(() => { if (active) setCanView(false); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!province || canView !== true) { setSnapshot(null); setTraffic(null); setSystems([]); setSpecialSystems([]); setSolarSnapshots([]); return; }
    let active = true;
    setSnapshot(null);
    setTraffic(null);
    setLoading(true);
    setError('');
    void Promise.all([rahcomApi.roadList(province, selectedDate), rahcomApi.trafficSnapshot(province, selectedDate), rahcomApi.systems(province), rahcomApi.solarSnapshots(province, selectedDate), rahcomApi.solarSpecialSystems(province)])
      .then(([result, trafficResult, systemRows, solarRows, specialRows]) => {
        if (!active) return;
        if (result && !hasTableData(result)) {
          setSnapshot(null);
          setError(t('rahcomRoadListInvalidFile'));
          return;
        }
        setSnapshot(result);
        setSystems(systemRows);
        setSpecialSystems(specialRows);
        setSolarSnapshots(solarRows.filter((item) => tehranDateKey(item.capturedAt) === selectedDate));
        setTraffic(trafficResult && Array.isArray(trafficResult.headers) && Array.isArray(trafficResult.rows)
          ? { ...trafficResult, headers: trafficResult.headers.map((header) => String(header ?? '')), rows: trafficResult.rows.filter(Array.isArray).map((row) => row.map((cell) => String(cell ?? ''))) }
          : null);
        setPage(0);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : t('rahcomRoadListInvalidFile')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [province, canView, t, selectedDate]);

  const loadRoadListDates = useCallback((from: string, to: string) => province ? rahcomApi.roadListDates(province, from, to) : Promise.resolve([]), [province]);
  useEffect(() => { setSelectedSolarSnapshotId((current) => solarSnapshots.some((snapshot) => snapshot.id === current) ? current : solarSnapshots[0]?.id ?? ''); }, [solarSnapshots]);

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    setError('');
    setMessage('');
    if (!file) return;
    if (!province) { setError(t('rahcomRoadListChooseProvince')); input.value = ''; return; }
    if (file.size > 20 * 1024 * 1024) { setError(t('rahcomRoadListFileTooLarge')); input.value = ''; return; }
    setBusy(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
      let upload: Pick<RahcomRoadListSnapshot, 'province' | 'fileName' | 'sheetName' | 'headers' | 'rows'> & { listDate: string } | null = null;
      for (const sheetName of workbook.SheetNames) {
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: false });
        const headerIndex = matrix.findIndex((row) => {
          if (!Array.isArray(row)) return false;
          const cells = row.map((cell) => String(cell ?? ''));
          const hasProvince = cells.some((cell) => normalizeHeader(cell).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(cell) === 'province');
          const hasStationCode = cells.some(isRoadListStationCodeHeader);
          const hasStationName = cells.some(isRoadListStationNameHeader);
          return hasProvince || hasStationCode && hasStationName;
        });
        if (headerIndex < 0 || !Array.isArray(matrix[headerIndex])) continue;
        const rawHeaders = matrix[headerIndex].map((value) => String(value ?? '').trim());
        if (!rawHeaders.length || rawHeaders.length > 100) continue;
        const provinceColumnIndex = rawHeaders.findIndex((header) => normalizeHeader(header).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(header) === 'province');
        const stationOnlyWorkbook = provinceColumnIndex < 0
          && rawHeaders.some(isRoadListStationCodeHeader)
          && rawHeaders.some(isRoadListStationNameHeader);
        if (provinceColumnIndex < 0 && !stationOnlyWorkbook) continue;
        const headers = rawHeaders.map((value, index) => canonicalRoadListHeader(value || `${t('rahcomTrafficColumn')} ${index + 1}`));
        if (stationOnlyWorkbook) headers.push(t('rahcomProvince'));
        const rows = matrix.slice(headerIndex + 1)
          .filter((row) => Array.isArray(row) && row.some((value) => value !== '' && value !== null && value !== undefined))
          .map((row) => [
            ...rawHeaders.map((_, index) => String(row[index] ?? '').trim()),
            ...(stationOnlyWorkbook ? [province] : []),
          ]);
        if (!rows.length) throw new Error(t('rahcomRoadListInvalidFile'));
        if (rows.length > 10000) throw new Error(t('rahcomTrafficTooManyRows'));
        const payload = { province, listDate: selectedDate, fileName: file.name, sheetName, headers, rows };
        if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 8 * 1024 * 1024) throw new Error(t('rahcomRoadListFileTooLarge'));
        upload = payload;
        break;
      }
      if (!upload) throw new Error(t('rahcomRoadListInvalidFile'));
      const saved = await rahcomApi.replaceRoadList(upload);
      if (!hasTableData(saved)) throw new Error(t('rahcomRoadListInvalidFile'));
      setSnapshot(saved);
      setPage(0);
      setMessage(t('rahcomRoadListUploadDone'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('rahcomRoadListInvalidFile'));
    } finally {
      input.value = '';
      setBusy(false);
    }
  }

  const headers = Array.isArray(snapshot?.headers) ? snapshot.headers : [];
  const stationCodeIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes(normalizeHeader('\u06a9\u062f \u0627\u06cc\u0633\u062a\u06af\u0627\u0647'))
      || normalized.includes(normalizeHeader('\u06a9\u062f \u062a\u062c\u0645\u06cc\u0639'))
      || normalized.includes('stationcode')
      || normalized.includes('aggregationcode')
      || normalized.includes('aggregatecode');
  });
  const identifierIndex = stationCodeIndex >= 0 ? stationCodeIndex : headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes(normalizeHeader('\u0634\u0646\u0627\u0633\u0647'))
      || normalized === 'id'
      || normalized === 'identifier';
  });
  const positionIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0645\u0648\u0642\u0639\u06cc\u062a') || normalizeHeader(header).includes('position'));
  const cityIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0634\u0647\u0631') || normalizeHeader(header) === 'city');
  const wideSingleLineIndexes = headers.flatMap((header, index) => { const normalized = normalizeHeader(header); return normalized.includes('\u0633\u0627\u0645\u0627\u0646\u0647') || normalized.includes('system') || normalized.includes('\u067e\u06cc\u0645\u0627\u0646\u06a9\u0627\u0631') || normalized.includes('contractor') ? [index] : []; });
  const incidentIndexes = (traffic?.headers ?? []).flatMap((header, index) => { const normalized = normalizeHeader(header); return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', 'theft', 'damage'].some((term) => normalized.includes(normalizeHeader(term))) ? [index] : []; });
  const systemsByCode = useMemo(() => new Map(systems.map((system) => [normalizeIdentifier(system.systemCode), system])), [systems]);
  const specialSystemsByCode = useMemo(() => new Map(specialSystems.map((system) => [normalizeIdentifier(system.systemCode), system])), [specialSystems]);
  const selectedSolarSnapshot = solarSnapshots.find((item) => item.id === selectedSolarSnapshotId) ?? solarSnapshots[0];
  const solarStateByCode = useMemo(() => {
    const states = new Map<string, Array<{ equipment: string; state: 'down' | 'unreachable' }>>();
    const selectedColumns = new Set((selectedSolarSnapshot?.equipmentColumns ?? []).map((column) => /^LTE-[12]$/i.test(column) ? 'LTE' : column.toUpperCase()));
    if (selectedSolarSnapshot) {
      const entries = filterRahcomLtePairs([
        ...parseRahcomSolarList(selectedSolarSnapshot.downText, 'down'),
        ...parseRahcomSolarList(selectedSolarSnapshot.unreachableText, 'unreachable'),
      ]).filter(({ equipment }) => selectedColumns.has(equipment.toUpperCase()) || (/^LTE-[12]$/i.test(equipment) && selectedColumns.has('LTE')));
      for (const entry of entries) {
        const code = normalizeIdentifier(entry.site);
        const provinceKey = selectedSolarSnapshot.province ?? entry.province ?? province;
        if (!code || !provinceKey) continue;
        const key = rahcomSystemKey(provinceKey, code);
        states.set(key, [...(states.get(key) ?? []), { equipment: entry.equipment, state: entry.state }]);
      }
    }
    return states;
  }, [province, selectedSolarSnapshot]);
  const activityIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0641\u0639\u0627\u0644\u06cc\u062a') || normalizeHeader(header).includes('activity'));
  const axisIndexes = headers.flatMap((header, index) => normalizeHeader(header).includes('\u0645\u062d\u0648\u0631') || normalizeHeader(header).includes('axis') ? [index] : []);
  const stationNameIndex = headers.findIndex(isRoadListStationNameHeader);
  const prioritizedIndexes = [positionIndex, cityIndex, stationNameIndex, ...axisIndexes, activityIndex].filter((index, order, indexes): index is number => index >= 0 && indexes.indexOf(index) === order);
  const orderedDataIndexes = [...prioritizedIndexes, ...headers.map((_, index) => index).filter((index) => index !== identifierIndex && !prioritizedIndexes.includes(index))];
  const provinceIndex = headers.findIndex((header) => normalizeHeader(header).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(header) === 'province');
  const contractorIndex = headers.findIndex((header) => {
    const normalized = normalizeHeader(header);
    return normalized.includes('\u067e\u06cc\u0645\u0627\u0646\u06a9\u0627\u0631') || normalized.includes('contractor') || normalized.includes('\u0634\u0631\u06a9\u062a') || normalized.includes('company');
  });
  const lastAxisPosition = orderedDataIndexes.reduce((last, index, position) => axisIndexes.includes(index) || index === cityIndex ? position : last, -1);
  const provincePosition = orderedDataIndexes.findIndex((index) => index === provinceIndex);
  const activityPosition = orderedDataIndexes.findIndex((index) => index === activityIndex);
  const solarInsertPosition = activityPosition >= 0
    ? activityPosition
    : provincePosition >= 0 && provincePosition > lastAxisPosition
      ? provincePosition
      : lastAxisPosition >= 0
        ? lastAxisPosition + 1
        : provincePosition >= 0
          ? provincePosition
          : orderedDataIndexes.length;
  const displayedDataColumns: Array<number | 'solar'> = [...orderedDataIndexes];
  displayedDataColumns.splice(solarInsertPosition, 0, 'solar');
  const contractorPosition = displayedDataColumns.indexOf(contractorIndex);
  const displayedProvincePosition = displayedDataColumns.indexOf(provinceIndex);
  if (contractorIndex >= 0 && displayedProvincePosition >= 0 && contractorPosition >= 0 && contractorPosition !== displayedProvincePosition + 1) {
    displayedDataColumns.splice(contractorPosition, 1);
    displayedDataColumns.splice(displayedDataColumns.indexOf(provinceIndex) + 1, 0, contractorIndex);
  }
  const trafficMatches = useMemo(() => {
    const trafficHeaders = Array.isArray(traffic?.headers) ? traffic.headers : [];
    const aggregationIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u06a9\u062f\u062a\u062c\u0645\u06cc\u0639') || normalized.includes('aggregationcode') || normalized.includes('aggregatecode');
    });
    const systemCodeIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || normalized === 'systemcode';
    });
    const systemNameIndex = trafficHeaders.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return normalized.includes('\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || normalized.includes('\u0646\u0627\u0645\u0633\u0627\u0645\u0627\u0646\u0647') || normalized === 'systemname';
    });
    const provinceIndex = trafficHeaders.findIndex((header) => normalizeHeader(header).includes('\u0627\u0633\u062a\u0627\u0646') || normalizeHeader(header) === 'province');
    const incidentIndexes = trafficHeaders.flatMap((header, index) => { const normalized = normalizeHeader(header); return ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', '\u062a\u0639\u0631\u06cc\u0636', '\u062c\u0627\u0628\u0647\u062c\u0627\u06cc\u06cc', 'theft', 'damage', 'widening', 'relocation'].some((term) => normalized.includes(normalizeHeader(term))) ? [index] : []; });
    const provinceLabel = iranProvinces.find(([id]) => id === province)?.[1] ?? province;
    const validProvinces = new Set([normalizeIdentifier(province), normalizeIdentifier(provinceLabel)]);
    const matches = new Map<string, Array<{ systemCode: string; systemName: string; trafficIncident: string }>>();
    if (aggregationIndex < 0 || systemCodeIndex < 0 || systemNameIndex < 0) return matches;
    for (const row of traffic?.rows ?? []) {
      const rowProvince = provinceIndex >= 0 ? normalizeIdentifier(row[provinceIndex]) : '';
      if (rowProvince && !validProvinces.has(rowProvince)) continue;
      const aggregationCode = normalizeIdentifier(row[aggregationIndex]);
      if (!aggregationCode) continue;
      const candidates = matches.get(aggregationCode) ?? [];
      const trafficIncident = incidentIndexes.filter((index) => isRahcomIncidentValue(row[index])).map((index) => {
        const value = String(row[index] ?? '').trim();
        if (classifyIncidentLabel(value)) return value;
        const header = String(trafficHeaders[index] ?? '').trim();
        const normalizedHeader = normalizeHeader(header);
        const hasTheft = normalizedHeader.includes('\u0633\u0631\u0642\u062a') || normalizedHeader.includes('theft');
        const hasDamage = normalizedHeader.includes('\u062a\u062e\u0631\u06cc\u0628') || normalizedHeader.includes('damage');
        if (hasTheft && hasDamage) return '';
        return header;
      }).filter(Boolean).join(' · ');
      candidates.push({ systemCode: String(row[systemCodeIndex] ?? '').trim(), systemName: String(row[systemNameIndex] ?? '').trim(), trafficIncident });
      matches.set(aggregationCode, candidates);
    }
    return matches;
  }, [province, traffic]);
  const getMatch = (row: string[]) => {
    const identifier = identifierIndex >= 0 ? normalizeIdentifier(row[identifierIndex]) : '';
    const candidates = identifier ? trafficMatches.get(identifier) ?? [] : [];
    return candidates.length === 1 ? candidates[0] : null;
  };
  const getIncidentText = (match: ReturnType<typeof getMatch>) => {
    const special = match ? specialSystemsByCode.get(normalizeIdentifier(match.systemCode)) : undefined;
    if (special) return t(special.category === 'WIDENING_RELOCATION' ? 'solarWideningRelocation' : special.category === 'THEFT' ? 'rahcomIncidentTheft' : special.category === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth');
    const system = match ? systemsByCode.get(normalizeIdentifier(match.systemCode)) : undefined;
    const detailCategory = classifyIncidentLabel(system?.incidentDetails);
    if (detailCategory) return t(detailCategory);
    const trafficCategory = classifyIncidentLabel(match?.trafficIncident);
    if (trafficCategory) return t(trafficCategory);
    if (system?.incidentType) return t(system.incidentType === 'WIDENING_RELOCATION' ? 'solarWideningRelocation' : system.incidentType === 'THEFT' ? 'rahcomIncidentTheft' : system.incidentType === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth');
    if (system?.incidentDetails?.trim()) return system.incidentDetails.trim();
    return match?.trafficIncident || '\u2014';
  };
  const filteredRows = useMemo(() => {
    const rows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
    if (showIncidents) return rows;
    return rows.filter((row) => {
      const identifier = identifierIndex >= 0 ? normalizeIdentifier(row[identifierIndex]) : '';
      const matches = identifier ? trafficMatches.get(identifier) ?? [] : [];
      return !matches.some((match) => isRahcomIncidentValue(match.trafficIncident));
    });
  }, [identifierIndex, showIncidents, snapshot, trafficMatches]);
  const visibleRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const getSolarStatuses = (match: ReturnType<typeof getMatch>) => {
    const system = match ? systemsByCode.get(normalizeIdentifier(match.systemCode)) : undefined;
    const solarProvince = system?.province ?? province;
    if (!match || !selectedSolarSnapshot || (selectedSolarSnapshot.province && selectedSolarSnapshot.province !== solarProvince)) return [];
    return solarStateByCode.get(rahcomSystemKey(solarProvince, match.systemCode)) ?? [];
  };
  const downloadExcel = () => {
    if (!snapshot) return;
    const exportHeaders = [t('rahcomRowNumber'), t('rahcomSystemName'), t('rahcomSystemCode'), t('rahcomIncidentFilter'), ...(identifierIndex >= 0 ? [t('rahcomRoadStationCode')] : []),
      ...displayedDataColumns.map((column) => column === 'solar' ? t('rahcomSystemSolar') : column === positionIndex ? t('rahcomRoadStationName') : column === cityIndex ? t('rahcomAxis') : isSolarHeader(headers[column]) ? t('rahcomTrafficImportedStatus') : isRoadListAxisHeader(headers[column]) ? t('rahcomAxis') : isRoadListStationCodeHeader(headers[column]) ? t('rahcomRoadStationCode') : isRoadListStationNameHeader(headers[column]) ? t('rahcomRoadStationName') : headers[column])];
    const exportRows = filteredRows.map((row, rowIndex) => {
      const match = getMatch(row);
      const solarText = getSolarStatuses(match).map(({ equipment, state }) => `${equipment}: ${t(state === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable')}`).join(', ') || '\u2014';
      return [rowIndex + 1, match?.systemName || '\u2014', match?.systemCode || '\u2014', getIncidentText(match), ...(identifierIndex >= 0 ? [row[identifierIndex] ?? ''] : []),
        ...displayedDataColumns.map((column) => column === 'solar' ? solarText : row[column] ?? '')];
    });
    const worksheet = XLSX.utils.aoa_to_sheet([exportHeaders, ...exportRows]);
    worksheet['!cols'] = exportHeaders.map((_, index) => ({ wch: index === 0 ? 8 : index === 1 ? 16 : 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Road list');
    XLSX.writeFile(workbook, `road-list-${province}-${selectedDate}.xlsx`);
  };
  const copyRoadListImagePrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildRoadListImagePrompt(formatJalaliDate(selectedDate)));
      setRoadListPromptCopyState('copied');
    } catch {
      setRoadListPromptCopyState('failed');
    }
    window.setTimeout(() => setRoadListPromptCopyState(null), 1800);
  };
  if (loading && canView === null) return <main dir={getLocaleDirection(locale)} className="mx-auto w-full max-w-none rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</main>;
  if (!canView) return <main dir={getLocaleDirection(locale)} className="mx-auto w-full max-w-none rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">{uiMessage(locale, 'rahcomAccessDenied')}</main>;

  return <main dir={getLocaleDirection(locale)} className="mx-auto min-w-0 w-full max-w-full overflow-x-clip space-y-3">
    <header className="rahcom-mobile-toolbar rahcom-page-toolbar max-sm:-mb-2 flex flex-nowrap items-center justify-start gap-3 overflow-x-auto overflow-y-hidden pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0">
      <RahcomHeaderDate compact loadMarkedDates={loadRoadListDates} />
      {solarSnapshots.length > 0 && <SolarSnapshotPicker snapshots={solarSnapshots} selectedId={selectedSolarSnapshotId} locale={locale} onSelect={setSelectedSolarSnapshotId} />}
      <RahcomCountCapsule count={filteredRows.length} />
      <div className="flex flex-nowrap items-center gap-2">
        <button type="button" aria-pressed={showIncidents} aria-label={t('rahcomIncidentFilter')} title={t('rahcomIncidentFilter')} onClick={() => { const enabled = !showIncidents; setShowIncidents(enabled); window.localStorage.setItem('rahcom-show-incidents', String(enabled)); setPage(0); }} style={showIncidents ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : undefined} className={`grid size-9 shrink-0 place-items-center rounded-full border transition-colors ${showIncidents ? '' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}><TriangleAlert size={16} aria-hidden="true" /></button>
        {snapshot && <button type="button" onClick={downloadExcel} aria-label={t('solarDownloadExcel')} title={t('solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary"><Download size={16} aria-hidden="true" /></button>}
        <button type="button" onClick={() => void copyRoadListImagePrompt()} aria-label={locale === 'fa' ? 'کپی پرامپت استخراج تصویر راهداری' : 'Copy road list image extraction prompt'} title={roadListPromptCopyState === 'copied' ? locale === 'fa' ? 'پرامپت کپی شد' : 'Prompt copied' : roadListPromptCopyState === 'failed' ? locale === 'fa' ? 'کپی انجام نشد' : 'Copy failed' : locale === 'fa' ? 'کپی پرامپت استخراج تصویر راهداری' : 'Copy road list image extraction prompt'} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary">{roadListPromptCopyState === 'copied' ? <Check size={17} aria-hidden="true" className="text-primary" /> : <ClipboardCopy size={17} aria-hidden="true" />}</button>
        {canManage && <label aria-label={t('rahcomRoadListChooseFile')} title={t('rahcomRoadListChooseFile')} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm text-foreground transition hover:border-primary hover:text-primary ${busy || !province ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
          {busy ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
          <span>{busy ? t('rahcomRoadListUploading') : t('rahcomRoadListChooseFile')}</span>
          <input type="file" accept=".xlsx,.xls" disabled={busy || !province} onChange={(event) => void uploadFile(event)} className="sr-only" />
        </label>}
      </div>
    </header>

    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary">{message}</p>}
    {!province ? <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomRoadListChooseProvince')}</p> : loading ? <p role="status" className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : error ? null : !snapshot ? <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">{t('rahcomRoadListNoData')}</p> : <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3"><RahcomRecordSummary bare showRecordDate={false} showCount={false} locale={locale} source={t('rahcomRoadList')} fileName={snapshot.fileName} recordDate={snapshot.listDate.slice(0, 10)} count={snapshot.rowCount} savedAt={snapshot.importedAt} /></div>
      <div className="max-h-[68vh] overflow-auto">
        <table className="rahcom-sticky-table w-full min-w-max border-separate border-spacing-0 text-sm">
          <thead className="bg-card text-start text-xs text-muted-foreground"><tr>
            <th scope="col" className="border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomRowNumber')}</th>
            <th scope="col" className="min-w-[220px] border-b border-border px-3 py-2.5 font-semibold whitespace-nowrap">{t('rahcomSystemName')}</th>
            <th scope="col" className="min-w-[120px] border-b border-border px-2 py-2.5 text-center font-semibold whitespace-nowrap">{t('rahcomSystemCode')}</th>
            <th scope="col" className="min-w-[140px] max-w-[140px] border-b border-border px-2 py-2.5 text-center font-semibold whitespace-normal">{t('rahcomIncidentFilter')}</th>
            {identifierIndex >= 0 && <th scope="col" className="min-w-[100px] border-b border-border px-2 py-2.5 text-center font-semibold whitespace-nowrap">{t('rahcomRoadStationCode')}</th>}
            {displayedDataColumns.map((column, index) => column === 'solar'
              ? <th key="solar-status" scope="col" className="min-w-[180px] border-b border-border px-3 py-2.5 text-center font-semibold whitespace-nowrap">{t('rahcomSystemSolar')}</th>
              : <th key={`${headers[column]}-${column}-${index}`} scope="col" className={`border-b border-border px-3 py-2.5 font-semibold ${positionIndex === column ? 'min-w-[240px] whitespace-nowrap' : cityIndex === column ? 'min-w-[160px] whitespace-nowrap' : wideSingleLineIndexes.includes(column) ? 'min-w-[200px] whitespace-nowrap' : 'max-w-64 whitespace-normal'}`}>{column === positionIndex ? t('rahcomRoadStationName') : column === cityIndex ? t('rahcomAxis') : isSolarHeader(headers[column]) ? t('rahcomTrafficImportedStatus') : isRoadListAxisHeader(headers[column]) ? t('rahcomAxis') : isRoadListStationCodeHeader(headers[column]) ? t('rahcomRoadStationCode') : isRoadListStationNameHeader(headers[column]) ? t('rahcomRoadStationName') : headers[column]}</th>)}
          </tr></thead>
          <tbody>{visibleRows.map((row, rowIndex) => {
            const match = getMatch(row);
            return <tr key={page * PAGE_SIZE + rowIndex} className="odd:bg-background even:bg-muted/30">
              <td className="border-b border-border/70 px-3 py-2 text-center tabular-nums text-foreground">{new Intl.NumberFormat(locale).format(page * PAGE_SIZE + rowIndex + 1)}</td>
              <td className="min-w-[220px] whitespace-nowrap border-b border-border/70 px-3 py-2 align-top text-foreground">{match?.systemName || '—'}</td>
              <td dir="ltr" className="min-w-[120px] whitespace-nowrap border-b border-border/70 px-2 py-2 text-center font-mono text-foreground">{match?.systemCode || '—'}</td>
              <td className="min-w-[140px] max-w-[140px] border-b border-border/70 px-2 py-2 text-center align-middle text-foreground">{getIncidentText(match)}</td>
              {identifierIndex >= 0 && <td dir="ltr" className="min-w-[100px] whitespace-nowrap border-b border-border/70 px-2 py-2 text-center align-middle font-mono text-foreground">{row[identifierIndex] ?? ''}</td>}
              {displayedDataColumns.map((column, index) => column === 'solar'
                ? <td key="solar-status" className="min-w-[180px] whitespace-nowrap border-b border-border/70 px-3 py-2 text-center align-middle text-foreground">{(() => { const equipmentStatuses = getSolarStatuses(match); return equipmentStatuses.length ? <span className="inline-flex flex-nowrap items-center justify-center gap-x-3" dir="ltr">{equipmentStatuses.map(({ equipment, state }) => { const label = t(state === 'down' ? 'solarStatusDown' : 'solarStatusUnreachable'); return <span key={equipment} className="inline-flex items-center gap-1.5" title={`${equipment}: ${label}`} aria-label={`${equipment}: ${label}`}><bdi className="font-mono text-xs">{equipment}</bdi><span className={`inline-block size-3 rounded-full ${state === 'down' ? 'bg-red-600' : 'bg-gray-400'}`} /></span>; })}</span> : '\u2014'; })()}</td>
                : <td key={`${column}-${index}`} title={row[column] ?? ''} className={`border-b border-border/70 px-3 py-2 align-top text-foreground ${positionIndex === column || cityIndex === column || wideSingleLineIndexes.includes(column) ? 'whitespace-nowrap' : 'max-w-80 whitespace-pre-wrap'}`}>{row[column] ?? ''}</td>)}
            </tr>;
          })}</tbody>
        </table>
      </div>
      {pageCount > 1 && <div className="flex items-center justify-center gap-3 border-t border-border p-3 text-sm">
        <button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label={t('rahcomRoadListPreviousPage')} className="grid size-8 place-items-center rounded-full border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={16} /></button>
        <span className="tabular-nums text-muted-foreground">{new Intl.NumberFormat(locale).format(page + 1)} / {new Intl.NumberFormat(locale).format(pageCount)}</span>
        <button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label={t('rahcomRoadListNextPage')} className="grid size-8 place-items-center rounded-full border border-border text-foreground disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /></button>
      </div>}
    </section>}
  </main>;
}
