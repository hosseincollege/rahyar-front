import { iranProvinces, type RahcomSolarSnapshot, type RahcomSystem } from '@/lib/api/rahcom/rahcom-api';
import { jalaliDateToGregorian } from '@/lib/api/rahcom/jalali-date';

export type RahcomSolarState = 'down' | 'unreachable';
export type RahcomSolarEntry = { site: string; equipment: string; state: RahcomSolarState; province?: string };

export function parseRahcomSolarList(text: string, state: RahcomSolarState): RahcomSolarEntry[] {
  const output: RahcomSolarEntry[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^(down|unreachable)$/i.test(line)) continue;
    const match = line.match(/Rahcom\s*\(([^)]+)\)/i);
    if (match) {
      const equipment = match[1].match(/^(LTE-[12])(?:-|$)/i)?.[1]
        ?? match[1].match(/^(.+?)-ESF/i)?.[1]
        ?? match[1].match(/^([A-Z]+-\d+)(?:-|$)/i)?.[1]
        ?? match[1].split('-')[0];
      const site = line.match(/\d{3}[A-Z]\d{5}/i)?.[0];
      const province = /(?:^|-)ESF(?:-|$)|ISFAHAN/i.test(match[1]) ? 'isfahan' : undefined;
      if (site) output.push({ site: site.toUpperCase(), equipment: equipment.toUpperCase(), state, province });
      continue;
    }
    const site = line.match(/\d{3}[A-Z]\d{5}/i)?.[0];
    if (site) output.push({ site: site.toUpperCase(), equipment: 'WLP2P', state });
  }
  return output;
}

export function filterRahcomLtePairs(entries: RahcomSolarEntry[]): RahcomSolarEntry[] {
  const failedSimsBySite = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!/^LTE-[12]$/i.test(entry.equipment)) continue;
    const failedSims = failedSimsBySite.get(entry.site) ?? new Set<string>();
    failedSims.add(entry.equipment.toUpperCase());
    failedSimsBySite.set(entry.site, failedSims);
  }
  return entries.filter((entry) => !/^LTE-[12]$/i.test(entry.equipment) || failedSimsBySite.get(entry.site)?.size === 2);
}

export function tehranDateKey(value: Date | string = new Date()) {
  const parts = new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Use the ticket's creation date when present, falling back to its import day. */
export function rahcomTicketDateKey(createdOn: string, importedAt: string) {
  const normalized = createdOn.normalize('NFKC').replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)).trim();
  const match = normalized.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    if (year >= 1300 && year <= 1600) {
      const gregorian = jalaliDateToGregorian(`${match[1]}/${match[2]}/${match[3]}`);
      if (gregorian) return gregorian;
    } else {
      const dateKey = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      if (!Number.isNaN(new Date(`${dateKey}T12:00:00Z`).getTime())) return dateKey;
    }
  }
  return tehranDateKey(importedAt);
}

export function rahcomSolarSnapshotNumber(snapshot: RahcomSolarSnapshot, snapshots: RahcomSolarSnapshot[]) {
  const sameDay = snapshots.filter((item) => item.province === snapshot.province && tehranDateKey(item.capturedAt) === tehranDateKey(snapshot.capturedAt))
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
      || new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime());
  const index = sameDay.findIndex((item) => item.id === snapshot.id);
  return index >= 0 ? index + 1 : sameDay.length + 1;
}

export function latestRahcomSolarSnapshotForToday(snapshots: RahcomSolarSnapshot[], today = tehranDateKey()) {
  return snapshots
    .filter((snapshot) => tehranDateKey(snapshot.capturedAt) === today)
    .sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()
      || new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0] ?? null;
}

/** Keep each province's latest observation; a newer province must not hide another. */
export function latestRahcomSolarSnapshotsByProvince(snapshots: RahcomSolarSnapshot[], today = tehranDateKey()) {
  const latest = new Map<string | null, RahcomSolarSnapshot>();
  for (const snapshot of [...snapshots].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || b.createdAt.localeCompare(a.createdAt))) {
    if (tehranDateKey(snapshot.capturedAt) === today && !latest.has(snapshot.province)) latest.set(snapshot.province, snapshot);
  }
  return [...latest.values()];
}

export function rahcomSystemKey(province: string, code: string) {
  return `${province}:${normalizeRahcomSystemCode(code)}`;
}

export function normalizeRahcomSystemCode(code: string) {
  return code.normalize('NFKC')
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9')
    .replace(/[\s\u200c]/g, '').toUpperCase();
}

export function rahcomSystemHasLongOutage(system: Pick<RahcomSystem, 'longOutage' | 'longOutageReason'> | null | undefined) {
  return Boolean(system && (system.longOutage || system.longOutageReason));
}

const longOutageReasonLabels = [
  ['THEFT_DAMAGE', '\u0633\u0631\u0642\u062a \u0648 \u062a\u062e\u0631\u06cc\u0628'],
  ['RELOCATION', '\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc \u06cc\u0627 \u062a\u0639\u0631\u06cc\u0636'],
  ['ELECTRICITY_DEBT', '\u0628\u062f\u0647\u06cc \u0642\u0628\u0636 \u0628\u0631\u0642'],
  ['PAYMENT_ARREARS', '\u0645\u0639\u0648\u0642\u0627\u062a \u067e\u0631\u062f\u0627\u062e\u062a'],
  ['POWER_OUTAGE', '\u0642\u0637\u0639\u06cc \u0628\u0631\u0642'],
  ['OTHER', '\u0633\u0627\u06cc\u0631'],
] as const;

export function rahcomLongOutageReasonLabel(reason: string | null | undefined, details?: string | null) {
  if (!reason) return '';
  const normalized = reason.normalize('NFKC').trim().toLocaleLowerCase('fa')
    .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_-]/g, '');
  const match = longOutageReasonLabels.find(([code, label]) =>
    normalized === code.toLowerCase().replace(/_/g, '') || normalized === label.normalize('NFKC').replace(/[\s\u200c_-]/g, ''),
  );
  if (match?.[0] === 'OTHER') return details?.trim() || match[1];
  return match?.[1] ?? reason.trim();
}

export function rahcomProvinceFromLabel(value: string) {
  const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/^(?:استان\s*|province\s*:?\s*)/i, '').replace(/[\s\u200c_-]/g, '');
  return iranProvinces.find(([id, label]) => normalize(id) === normalize(value) || normalize(label) === normalize(value))?.[0] ?? null;
}

export function failedRahcomSystemKeys(snapshots: RahcomSolarSnapshot[], systems: RahcomSystem[], day: string, fallbackProvince?: string) {
  const failed = new Set<string>();
  for (const snapshot of latestRahcomSolarSnapshotsByProvince(snapshots, day)) {
    for (const code of failedRahcomSystemCodes(snapshot)) {
      const snapshotProvince = snapshot.province || fallbackProvince;
      const matches = systems.filter((system) => system.systemCode.trim().toUpperCase() === code && (!snapshotProvince || system.province === snapshotProvince));
      if (!snapshotProvince && matches.length !== 1) continue;
      for (const system of matches) failed.add(rahcomSystemKey(system.province, code));
    }
  }
  return failed;
}

export function failedRahcomSystemCodes(snapshot: RahcomSolarSnapshot | null) {
  if (!snapshot) return new Set<string>();
  const selectedColumns = new Set((snapshot.equipmentColumns ?? []).map((column) => /^LTE-[12]$/i.test(column) ? 'LTE' : column.toUpperCase()));
  const entries = filterRahcomLtePairs([
    ...parseRahcomSolarList(snapshot.downText, 'down'),
    ...parseRahcomSolarList(snapshot.unreachableText, 'unreachable'),
  ]).filter(({ equipment }) => selectedColumns.has(equipment.toUpperCase()) || (/^LTE-[12]$/i.test(equipment) && selectedColumns.has('LTE')));
  return new Set(entries.map(({ site }) => site));
}

export function isRahcomIncidentValue(value: string | null | undefined) {
  const raw = (value ?? '').normalize('NFKC').trim().toLocaleLowerCase();
  if (!raw || /^[-\u2014\u2013]+$/.test(raw)) return false;
  const normalized = raw.replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0)).replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660)).replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-]/g, '');
  return !/^0+(?:\.0+)?$/.test(normalized) && !['false', 'no', 'n', 'none', 'null', 'n/a', 'noincident', '\u0646\u062f\u0627\u0631\u062f', '\u0646\u062f\u0627\u0634\u062a\u0647', '\u062e\u06cc\u0631', '\u0646\u0647', '\u0641\u0627\u0642\u062f', '\u0628\u062f\u0648\u0646\u0645\u0648\u0631\u062f'].includes(normalized);
}

export type RahcomTrafficLongOutageColumns = { indexes: number[]; isGeneric: boolean };

export function rahcomTrafficLongOutageColumns(headers: string[]): RahcomTrafficLongOutageColumns {
  const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
    .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-./()]/g, '');
  const genericIndex = headers.findIndex((header) => {
    const normalized = normalize(header);
    return normalized.includes(normalize('\u0642\u0637\u0639\u06cc \u0632\u0645\u0627\u0646\u200c\u0628\u0631')) || normalized.includes('longoutage');
  });
  return {
    indexes: genericIndex >= 0 ? [genericIndex] : headers.flatMap((header, index) =>
      ['\u0633\u0631\u0642\u062a', '\u062a\u062e\u0631\u06cc\u0628', '\u062a\u0639\u0631\u06cc\u0636', '\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc', 'theft', 'damage', 'widening', 'relocation']
        .some((term) => normalize(header).includes(normalize(term))) ? [index] : []),
    isGeneric: genericIndex >= 0,
  };
}

export function rahcomTrafficLongOutageValues(headers: string[], row: string[], columns = rahcomTrafficLongOutageColumns(headers)) {
  return columns.indexes.flatMap((index) => {
    const value = String(row[index] ?? '').trim();
    if (!isRahcomIncidentValue(value)) return [];
    return columns.isGeneric || !/^\d+(?:[.,]\d+)?$/.test(value) ? [value] : [headers[index].trim()];
  });
}

export function downRahcomSystemCodes(snapshot: RahcomSolarSnapshot | null) {
  if (!snapshot) return new Set<string>();
  const entries = filterRahcomLtePairs(parseRahcomSolarList(snapshot.downText, 'down'));
  return new Set(entries.map(({ site }) => site));
}
