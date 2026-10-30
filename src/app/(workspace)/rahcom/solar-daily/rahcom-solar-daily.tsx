'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Download, LoaderCircle, Pencil, Search, Save, Trash2, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { filterRahcomLtePairs, isRahcomIncidentValue, parseRahcomSolarList as parseList, type RahcomSolarEntry as Entry } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';

const commonEquipment = ['LTE', 'RTR-1', 'RTR-2', 'CAM-1', 'RAD-1', 'RAD-2', 'PC', 'RLY', 'RLY-1', 'WL-1', 'WLP2P'];
const emptyTrafficHeaders: string[] = [];
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

function jalaliDateTimeFromTimestamp(value: string) {
  const date = jalaliParts(new Date(value));
  const time = Object.fromEntries(new Intl.DateTimeFormat('en-u-ca-gregory-nu-latn', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  const pad = (part: string | undefined) => (part ?? '0').padStart(2, '0');
  return { date: `${date.year}/${pad(date.month)}/${pad(date.day)}`, time: `${time.hour}:${time.minute}` };
}

function toAsciiDigits(value: string) {
  return value.replace(/[Û°-Û¹Ù -Ù©]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) >= 0x06f0 && digit.charCodeAt(0) <= 0x06f9 ? digit.charCodeAt(0) - 0x06f0 + 48 : digit.charCodeAt(0) - 0x0660 + 48));
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

function workbookWithColoredSolarStatuses(workbook: XLSX.WorkBook) {
  const original = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const archive = XLSX.CFB.read(new Uint8Array(original), { type: 'array' });
  const worksheetFile = XLSX.CFB.find(archive, '/xl/worksheets/sheet1.xml');
  const stylesFile = XLSX.CFB.find(archive, '/xl/styles.xml');
  if (!worksheetFile || !stylesFile) return original;

  let stylesXml = new TextDecoder().decode(stylesFile.content as Uint8Array);
  const existingFillCount = Number(stylesXml.match(/<fills\b[^>]*count="(\d+)"/)?.[1] ?? 0);
  const existingFontCount = Number(stylesXml.match(/<fonts\b[^>]*count="(\d+)"/)?.[1] ?? 0);
  const existingXfCount = Number(stylesXml.match(/<cellXfs\b[^>]*count="(\d+)"/)?.[1] ?? 1);
  const worksheet = workbook.Sheets.Solar;
  const sheetRange = worksheet?.['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
  const lteColumnIndex = sheetRange ? Array.from({ length: sheetRange.e.c - sheetRange.s.c + 1 }, (_, index) => sheetRange.s.c + index)
    .find((columnIndex) => String(worksheet[XLSX.utils.encode_cell({ r: sheetRange.s.r, c: columnIndex })]?.v ?? '').trim().toUpperCase() === 'LTE') ?? -1 : -1;
  const newFills = [
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF0F4F8"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF29445F"/><bgColor indexed="64"/></patternFill></fill>',
  ].join('');
  stylesXml = stylesXml.replace(/<fills\b([^>]*)>([\s\S]*?)<\/fills>/, (_all, attributes: string, body: string) => {
    const updatedAttributes = attributes.replace(/\s+count="\d+"/, '').trim();
    return `<fills ${updatedAttributes} count="${existingFillCount + 3}">${body}${newFills}</fills>`;
  });
  const newHeaderFont = '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font>';
  stylesXml = stylesXml.replace(/<fonts\b([^>]*)>([\s\S]*?)<\/fonts>/, (_all, attributes: string, body: string) => {
    const updatedAttributes = attributes.replace(/\s+count="\d+"/, '').trim();
    return `<fonts ${updatedAttributes} count="${existingFontCount + 1}">${body}${newHeaderFont}</fonts>`;
  });
  const alignment = '<alignment horizontal="center" vertical="center" wrapText="1"/>';
  const noWrapAlignment = '<alignment horizontal="center" vertical="center"/>';
  const newCellFormats = [
    `<xf numFmtId="0" fontId="0" fillId="${existingFillCount}" borderId="0" xfId="0" applyFill="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="0" fontId="0" fillId="${existingFillCount + 1}" borderId="0" xfId="0" applyFill="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="0" fontId="${existingFontCount}" fillId="${existingFillCount + 2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${alignment}</xf>`,
    `<xf numFmtId="0" fontId="0" fillId="${existingFillCount}" borderId="0" xfId="0" applyFill="1" applyAlignment="1">${noWrapAlignment}</xf>`,
    `<xf numFmtId="0" fontId="0" fillId="${existingFillCount + 1}" borderId="0" xfId="0" applyFill="1" applyAlignment="1">${noWrapAlignment}</xf>`,
    `<xf numFmtId="0" fontId="${existingFontCount}" fillId="${existingFillCount + 2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${noWrapAlignment}</xf>`,
  ].join('');
  stylesXml = stylesXml.replace(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/, (_all, attributes: string, body: string) => {
    const updatedAttributes = attributes.replace(/\s+count="\d+"/, '').trim();
    return `<cellXfs ${updatedAttributes} count="${existingXfCount + 6}">${body}${newCellFormats}</cellXfs>`;
  });

  let worksheetXml = new TextDecoder().decode(worksheetFile.content as Uint8Array);
  if (/<sheetView\b[^>]*>/i.test(worksheetXml)) {
    worksheetXml = worksheetXml.replace(/<sheetView\b([^>]*?)(\/?)>/i, (_all, attributes: string, selfClosing: string) => {
      const updatedAttributes = attributes.replace(/\s+rightToLeft="[^"]*"/i, '').trim();
      return `<sheetView ${updatedAttributes} rightToLeft="1"${selfClosing ? '/' : ''}>`;
    });
  } else {
    const view = '<sheetViews><sheetView workbookViewId="0" rightToLeft="1"/></sheetViews>';
    worksheetXml = /<dimension\b[^>]*\/>/i.test(worksheetXml)
      ? worksheetXml.replace(/<dimension\b[^>]*\/>/i, (dimension) => `${dimension}${view}`)
      : worksheetXml.replace(/<worksheet\b[^>]*>/i, (root) => `${root}${view}`);
  }

  worksheetXml = worksheetXml.replace(/<c\b[^>]*>[\s\S]*?<\/c>/g, (cellXml) => {
    const cellReference = cellXml.match(/\br="([A-Z]+\d+)"/)?.[1];
    if (!cellReference) return cellXml;
    const rowNumber = Number(cellReference.match(/\d+$/)?.[0] ?? 1);
    const isLteColumn = XLSX.utils.decode_cell(cellReference).c === lteColumnIndex;
    const styleId = rowNumber === 1 ? existingXfCount + (isLteColumn ? 5 : 2) : rowNumber % 2 === 0 ? existingXfCount + (isLteColumn ? 3 : 0) : existingXfCount + (isLteColumn ? 4 : 1);
    let styledCellXml = cellXml;
    const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    if (value !== undefined) {
      const statusPattern = /\[\[RAHCOM_STATUS_(DOWN|UNREACHABLE)\]\]/g;
      const runs: string[] = [];
      let previousEnd = 0;
      let match: RegExpExecArray | null;
      let matchedStatus = false;
      while ((match = statusPattern.exec(value))) {
        const equipment = value.slice(previousEnd, match.index).trim();
        if (equipment) runs.push(`<r><t xml:space="preserve">${equipment}</t></r>`);
        const color = match[1] === 'DOWN' ? 'FFDC2626' : 'FF9CA3AF';
        runs.push(`<r><rPr><sz val="26"/><color rgb="${color}"/></rPr><t xml:space="preserve"> \u25CF </t></r>`);
        previousEnd = statusPattern.lastIndex;
        matchedStatus = true;
      }
      if (matchedStatus) {
        const remainingEquipment = value.slice(previousEnd).trim();
        if (remainingEquipment) runs.push(`<r><t xml:space="preserve">${remainingEquipment}</t></r>`);
        styledCellXml = `<c r="${cellReference}" t="inlineStr"><is>${runs.join('')}</is></c>`;
      }
    }
    return styledCellXml.replace(/<c\b([^>]*)>/, (_all, attributes: string) => {
      const updatedAttributes = attributes.replace(/\s+s="[^"]*"/, '').trim();
      return `<c ${updatedAttributes} s="${styleId}">`;
    });
  });

  XLSX.CFB.utils.cfb_add(archive, '/xl/styles.xml', new TextEncoder().encode(stylesXml));
  XLSX.CFB.utils.cfb_add(archive, '/xl/worksheets/sheet1.xml', new TextEncoder().encode(worksheetXml));
  return XLSX.CFB.write(archive, { fileType: 'zip', type: 'array' });
}

function sizeSolarWorksheetColumns(workbook: XLSX.WorkBook) {
  const worksheet = workbook.Sheets.Solar;
  if (!worksheet?.['!ref']) return;
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const lteColumnIndex = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => range.s.c + index)
    .find((columnIndex) => String(worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: columnIndex })]?.v ?? '').trim().toUpperCase() === 'LTE') ?? -1;
  const minimumWidths = [7, 18, 18, 14, 18];
  const maximumWidths = [10, 28, 42, 22, 36];
  const columnWidths = Array.from({ length: range.e.c + 1 }, (_, columnIndex) => {
    let longestValue = 0;
    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (!cell) continue;
      const value = String(cell.w ?? cell.v ?? '').replace(/\[\[RAHCOM_STATUS_(?:DOWN|UNREACHABLE)\]\]/g, '');
      longestValue = Math.max(longestValue, ...value.split(/\r?\n/).map((line) => Array.from(line.trim()).length));
    }
    const minimum = columnIndex === lteColumnIndex ? 36 : minimumWidths[columnIndex] ?? 12;
    const maximum = columnIndex === lteColumnIndex ? 44 : maximumWidths[columnIndex] ?? 48;
    const naturalWidth = Math.ceil(longestValue * 1.15 + 2);
    return Math.min(maximum, Math.max(minimum, naturalWidth));
  });
  worksheet['!cols'] = columnWidths.map((wch) => ({ wch }));
  worksheet['!rows'] = Array.from({ length: range.e.r + 1 }, (_, rowIndex) => {
    if (rowIndex === 0) return { hpt: 34 };
    let estimatedLines = 1;
    let hasStatusDot = false;
    for (let columnIndex = 0; columnIndex <= range.e.c; columnIndex += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      const value = String(cell?.w ?? cell?.v ?? '');
      hasStatusDot ||= value.includes('[[RAHCOM_STATUS_');
      const columnWidth = Math.max(8, columnWidths[columnIndex] - 2);
      const lines = value.replace(/\[\[RAHCOM_STATUS_(?:DOWN|UNREACHABLE)\]\]/g, '').split(/\r?\n/)
        .map((line) => Math.max(1, Math.ceil(Array.from(line).length / columnWidth)));
      estimatedLines = Math.max(estimatedLines, ...lines);
    }
    return { hpt: Math.min(150, Math.max(hasStatusDot ? 36 : 22, estimatedLines * 18 + 6)) };
  });
}

function axisTagStyle(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  const hue = (hash >>> 0) % 360;
  const color = `hsl(${hue} 68% 46%)`;
  return { color, borderColor: `color-mix(in srgb, ${color} 38%, transparent)`, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` };
}

function StatusTable({ entries, columns, locale, selectedProvince, systems = [], traffic = null, snapshots = [], currentSnapshot, viewProvince, showIncidents = false, showTrafficIncidents, showSystemIncidents }: { entries: Entry[]; columns: string[]; locale: Parameters<typeof uiMessage>[0]; selectedProvince: string; viewProvince?: string; systems?: RahcomSystem[]; traffic?: RahcomTrafficSnapshot | null; snapshots?: RahcomSolarSnapshot[]; currentSnapshot?: RahcomSolarSnapshot; showIncidents?: boolean; showTrafficIncidents: boolean; showSystemIncidents: boolean }) {
  const [sortBy, setSortBy] = useState<'code' | 'name'>('code');
  const [query, setQuery] = useState('');
  const tableRef = useRef<HTMLTableElement>(null);
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const provinceForTable = viewProvince ?? currentSnapshot?.province ?? selectedProvince;
  const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
    .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-./()]/g, '');
  const headers = traffic?.headers ?? emptyTrafficHeaders;
  const findHeader = (predicate: (normalized: string) => boolean) => headers.findIndex((header) => predicate(normalize(header)));
  const codeIndex = findHeader((header) => header.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || header.includes('systemcode'));
  const axisCodeIndex = findHeader((header) => header.includes('\u06a9\u062f\u0645\u062d\u0648\u0631') || header.includes('axiscode'));
  const axisNameIndex = findHeader((header) => header.includes('\u0646\u0627\u0645\u0645\u062d\u0648\u0631') || header.includes('axisname'));
  const systemNameIndex = findHeader((header) => header.includes('\u0646\u0627\u0645\u0633\u0627\u0645\u0627\u0646\u0647') || header.includes('systemname'));
  const stationNameIndex = findHeader((header) => header.includes('\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || header.includes('stationname'));
  const incidentIndexes = useMemo(() => headers.flatMap((header, index) => {
    const normalized = normalize(header);
    return normalized.includes('\u0633\u0631\u0642\u062a') || normalized.includes('\u062a\u062e\u0631\u06cc\u0628') || normalized.includes('\u062a\u0639\u0631\u06cc\u0636') || normalized.includes('\u062c\u0627\u0628\u062c\u0627\u06cc\u06cc') || normalized.includes('theft') || normalized.includes('damage') || normalized.includes('widening') || normalized.includes('relocation') ? [index] : [];
  }), [headers]);
  const outageIndex = findHeader((header) => header.includes('\u0631\u0648\u0632\u0642\u0637\u0639\u06cc') || header.includes('\u062a\u0639\u062f\u0627\u062f\u0631\u0648\u0632\u0642\u0637\u0639\u06cc') || header.includes('outagedays'));
  const solarIndex = findHeader((header) => header.includes('\u0633\u0648\u0644\u0627\u0631') || header.includes('solar'));
  const provinceName = iranProvinces.find(([id]) => id === provinceForTable)?.[1] ?? provinceForTable;
  const normalizeProvince = (value: string) => normalize(value).replace(/^Ø§Ø³ØªØ§Ù†/, '');
  const solarProvinceSites = new Set(entries.filter((entry) => provinceForTable === 'all' || entry.province === provinceForTable).map((entry) => entry.site.trim().toUpperCase()));
  const codeCounts = new Map<string, number>();
  for (const system of systems) { const code = system.systemCode.trim().toUpperCase(); codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1); }
  const provinceSystems = systems.filter((system) => provinceForTable === 'all' ? codeCounts.get(system.systemCode.trim().toUpperCase()) === 1 : normalizeProvince(system.province) === normalizeProvince(provinceForTable) || normalizeProvince(system.province) === normalizeProvince(provinceName));
  const systemsByCode = new Map(provinceSystems.map((system) => [system.systemCode.trim().toUpperCase(), system]));
  const allowedSites = new Set([...systemsByCode.keys(), ...solarProvinceSites]);
  const trafficRowsByCode = new Map((traffic?.rows ?? []).filter((row) => codeIndex >= 0 && allowedSites.has((row[codeIndex] ?? '').trim().toUpperCase())).map((row) => [(row[codeIndex] ?? '').trim().toUpperCase(), row]));
  const selectedColumns = new Set(columns.map((column) => column.toUpperCase()));
  const validEntries = filterRahcomLtePairs(entries).filter((entry) => allowedSites.has(entry.site.trim().toUpperCase()));
  const displayedEntries = validEntries.filter((entry) => selectedColumns.has(entry.equipment.toUpperCase()) || (selectedColumns.has('LTE') && /^LTE-[12]$/i.test(entry.equipment)));
  const solarSites = displayedEntries.map((entry) => entry.site.toUpperCase());
  const trafficIncidentsByCode = useMemo(() => {
    const incidents = new Map<string, string[]>();
    if (incidentIndexes.length > 0 && codeIndex >= 0) for (const row of traffic?.rows ?? []) {
      const code = (row[codeIndex] ?? '').trim().toUpperCase();
      if (!code) continue;
      const values = incidentIndexes.map((index) => row[index]?.trim() ?? '').filter(isRahcomIncidentValue);
      if (values.length) incidents.set(code, [...new Set([...(incidents.get(code) ?? []), ...values])]);
    }
    return incidents;
  }, [traffic, codeIndex, incidentIndexes]);
  const trafficIncidentSites = useMemo(() => new Set(trafficIncidentsByCode.keys()), [trafficIncidentsByCode]);
  const systemIncidentSites = useMemo(() => new Set(systems.filter((system) => system.incidentType || isRahcomIncidentValue(system.incidentDetails)).map((system) => system.systemCode.trim().toUpperCase())), [systems]);
  const solarSiteSet = new Set(solarSites);
  const sites = [...new Set([...solarSites, ...trafficIncidentSites, ...systemIncidentSites])].filter((site) => allowedSites.has(site))
    .filter((site) => {
      const hasTrafficIncident = trafficIncidentSites.has(site);
      const hasSystemIncident = systemIncidentSites.has(site);
      const isIncident = hasTrafficIncident || hasSystemIncident;
      if (isIncident && !showIncidents) return false;
      if (!isIncident) return solarSiteSet.has(site);
      return (showTrafficIncidents && hasTrafficIncident) || (showSystemIncidents && hasSystemIncident) || showIncidents;
    }).filter((site) => !query.trim() || `${site} ${systemsByCode.get(site)?.systemName ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort();
  const bySiteEquipment = new Map(validEntries.map((entry) => [`${entry.site.toUpperCase()}:${entry.equipment.toUpperCase()}`, entry.state]));
  const fixedEquipment = ['LTE', 'LTE-1', 'LTE-2', 'RTR-1', 'RTR-2', 'CAM-1', 'RAD-1', 'RAD-2'];
  const extraEquipment = [...selectedColumns].filter((item) => !fixedEquipment.includes(item)).sort((a, b) => a.localeCompare(b));
  const selectedRouters = ['RTR-1', 'RTR-2'].filter((equipment) => selectedColumns.has(equipment));
  const selectedRadars = ['RAD-1', 'RAD-2'].filter((equipment) => selectedColumns.has(equipment));
  const equipmentGroups = [
    ...(selectedColumns.has('LTE') ? [{ label: 'LTE', equipment: ['LTE-1', 'LTE-2'] }] : []),
    ...(selectedRouters.length ? [{ label: `${t('solarRouter')} (${selectedRouters.join('/')})`, equipment: selectedRouters }] : []),
    ...(selectedColumns.has('CAM-1') ? [{ label: `${t('solarCamera')} (CAM-1)`, equipment: ['CAM-1'] }] : []),
    ...(selectedRadars.length ? [{ label: `${t('solarRadar')} (${selectedRadars.join('/')})`, equipment: selectedRadars }] : []),
    ...extraEquipment.map((equipment) => ({ label: equipment, equipment: [equipment] })),
  ];
  const displayedEquipmentCodes = [...new Set(equipmentGroups.flatMap((group) => group.equipment.map((equipment) => equipment.toUpperCase())))];
  const recordRows = sites.map((site) => {
    const system = systemsByCode.get(site) ?? null;
    const trafficRow = trafficRowsByCode.get(site);
    const axisCode = system?.axisCode?.trim() || (axisCodeIndex >= 0 ? trafficRow?.[axisCodeIndex]?.trim() : '') || '';
    const axisName = (system?.axis?.trim() || (axisNameIndex >= 0 ? trafficRow?.[axisNameIndex]?.trim() : '') || '').replace(/^Ù…Ø­ÙˆØ±\s*/u, '').trim();
    const groupKey = axisCode || '__no_axis__';
    return { site, system, trafficRow, axisCode, axisName, groupKey };
  });
  const sortedRows = [...recordRows].sort((left, right) => (sortBy === 'code' ? left.axisCode : left.axisName).localeCompare(sortBy === 'code' ? right.axisCode : right.axisName, locale, { numeric: true, sensitivity: 'base' }) || left.site.localeCompare(right.site, 'en', { numeric: true, sensitivity: 'base' }));
  const snapshotsForProvince = snapshots.filter((snapshot) => snapshot.province === (currentSnapshot ? currentSnapshot.province : viewProvince ?? selectedProvince));
  const chronologicalSnapshots = [...snapshotsForProvince].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  const currentSnapshotIndex = currentSnapshot ? chronologicalSnapshots.findIndex((snapshot) => snapshot.id === currentSnapshot.id) : chronologicalSnapshots.length;
  const previousSnapshot = currentSnapshotIndex > 0 ? chronologicalSnapshots[currentSnapshotIndex - 1] : null;
  const previousStatesBySite = new Map<string, Map<string, 'down' | 'unreachable'>>();
  if (previousSnapshot) {
    for (const entry of filterRahcomLtePairs([...parseList(previousSnapshot.downText, 'down'), ...parseList(previousSnapshot.unreachableText, 'unreachable')])) {
      const siteStates = previousStatesBySite.get(entry.site.toUpperCase()) ?? new Map<string, 'down' | 'unreachable'>();
      siteStates.set(entry.equipment.toUpperCase(), entry.state);
      previousStatesBySite.set(entry.site.toUpperCase(), siteStates);
    }
  }
  const statusText = (state: 'normal' | 'down' | 'unreachable') => t(state === 'down' ? 'solarStatusDown' : state === 'unreachable' ? 'solarStatusUnreachable' : 'solarStatusNormal');
  const downloadExcel = () => {
    if (!tableRef.current) return;
    const exportTable = tableRef.current.cloneNode(true) as HTMLTableElement;
    exportTable.querySelectorAll<HTMLElement>('[data-export-state]').forEach((status) => {
      status.append(document.createTextNode(`[[RAHCOM_STATUS_${status.dataset.exportState?.toUpperCase()}]]`));
    });
    const workbook = XLSX.utils.table_to_book(exportTable, { sheet: 'Solar' });
    sizeSolarWorksheetColumns(workbook);
    const timestamp = (currentSnapshot?.capturedAt ?? new Date().toISOString()).replace(/[-:T.Z]/g, '').slice(0, 14);
    const fileData = workbookWithColoredSolarStatuses(workbook);
    const fileBytes = new Uint8Array(fileData as ArrayBuffer);
    const fileUrl = URL.createObjectURL(new Blob([fileBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = `solar-daily-${timestamp}.xlsx`;
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  };
  const columnCount = 8 + equipmentGroups.length + Number(showTrafficIncidents) + Number(showSystemIncidents);
  let nextRowNumber = 0;
  const numberedRows = sortedRows.map((row) => ({ ...row, rowNumber: ++nextRowNumber }));
  return <div className="space-y-3"><div className="flex flex-wrap items-center gap-3 text-sm"><div className="inline-flex overflow-hidden rounded-lg border border-border" role="group"><button type="button" aria-pressed={sortBy === 'code'} onClick={() => setSortBy('code')} className={`px-3 py-1.5 ${sortBy === 'code' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAxisCode')}</button><button type="button" aria-pressed={sortBy === 'name'} onClick={() => setSortBy('name')} className={`border-s border-border px-3 py-1.5 ${sortBy === 'name' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'}`}>{t('rahcomAxisName')}</button></div><label className="inline-flex h-9 min-w-48 items-center gap-2 rounded-lg border border-border bg-background px-3 text-muted-foreground"><Search size={16} /><input aria-label={t('solarSearch')} placeholder={t('solarSearch')} value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-foreground outline-none" /></label><span className="text-xs text-muted-foreground">{sites.length.toLocaleString(locale)} {t('rahcomSystemsOnMap')}</span><button type="button" onClick={downloadExcel} className="ms-auto inline-flex min-h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-medium text-foreground hover:border-primary hover:text-primary"><Download size={16} />{t('solarDownloadExcel')}</button></div><div className="overflow-x-auto rounded-2xl border border-border bg-card"><table ref={tableRef} className="w-full min-w-max text-sm"><thead className="bg-muted/50"><tr>
    <th className="p-3 text-center">{t('rahcomRowNumber')}</th><th className="p-3 text-start">{t('rahcomSystemCode')}</th><th className="p-3 text-start">{t('rahcomSystemName')}</th><th className="p-3 text-start">{t('rahcomAxisCode')}</th><th className="p-3 text-start">{t('rahcomAxisName')}</th>
    {equipmentGroups.map((group) => <th key={group.equipment.join('|')} className="whitespace-nowrap p-3 text-center" dir="ltr">{group.label}</th>)}
    {showTrafficIncidents && <th className="p-3 text-start">{t('rahcomTrafficIncidentColumn')}</th>}{showSystemIncidents && <th className="p-3 text-start">{t('rahcomSystemIncidentColumn')}</th>}<th className="p-3 text-start">{t('rahcomOutageDaysColumn')}</th><th className="p-3 text-start">{t('rahcomTrafficSolarStatus')}</th><th className="p-3 text-start">{t('solarHistory')}</th>
  </tr></thead><tbody>
    {sites.length === 0 ? <tr><td colSpan={columnCount} className="p-4 text-center text-muted-foreground">{t('solarNoEntries')}</td></tr> : numberedRows.map(({ site, system, trafficRow, axisCode, axisName, rowNumber }) => {
      const trafficIncident = trafficIncidentsByCode.get(site)?.join(' Â· ') ?? '';
      const hasTrafficIncident = isRahcomIncidentValue(trafficIncident);
      const systemIncident = system?.incidentType ? t(system.incidentType === 'WIDENING_RELOCATION' ? 'solarWideningRelocation' : system.incidentType === 'THEFT' ? 'rahcomIncidentTheft' : system.incidentType === 'DAMAGE' ? 'rahcomIncidentDamage' : 'rahcomIncidentBoth') + (system.incidentDetails ? ' Â· ' + system.incidentDetails : '') : system?.incidentDetails || 'â€”';
      const previousSiteStates = previousStatesBySite.get(site);
      const historyChanges = displayedEquipmentCodes.reduce<{ equipment: string; from: 'normal' | 'down' | 'unreachable' | null; to: 'normal' | 'down' | 'unreachable' }[]>((changes, equipment) => {
        const currentState = bySiteEquipment.get(site + ':' + equipment) ?? 'normal';
        const previousState = previousSiteStates?.get(equipment) ?? 'normal';
        if (previousSnapshot && previousState !== currentState) changes.push({ equipment, from: previousState, to: currentState });
        else if (!previousSnapshot && currentState !== 'normal') changes.push({ equipment, from: null, to: currentState });
        return changes;
      }, []);
      return <tr key={site} className="border-t border-border hover:bg-muted/20">
        <td className="p-3 text-center tabular-nums">{rowNumber.toLocaleString(locale)}</td>
        <td className="p-3 font-mono" dir="ltr">{site}</td>
        <td className="p-3">{system?.systemName || (systemNameIndex >= 0 ? trafficRow?.[systemNameIndex] : '') || (stationNameIndex >= 0 ? trafficRow?.[stationNameIndex] : '') || 'â€”'}</td>
        <td className="p-3 font-mono" dir="ltr">{axisCode ? <span className="inline-flex rounded-md border px-2 py-1 font-semibold" style={axisTagStyle(axisCode || axisName)}>{axisCode}</span> : 'â€”'}</td>
        <td className="p-3">{axisName ? <span className="inline-flex rounded-md border px-2 py-1 font-semibold" style={axisTagStyle(axisCode || axisName)}>{axisName}</span> : 'â€”'}</td>
        {equipmentGroups.map((group) => <td key={group.equipment.join('|')} className="whitespace-nowrap p-3 text-center">{group.equipment.filter((equipment) => bySiteEquipment.has(site + ':' + equipment)).length === 0 ? 'â€”' : group.equipment.filter((equipment) => bySiteEquipment.has(site + ':' + equipment)).map((equipment) => { const state = bySiteEquipment.get(site + ':' + equipment)!; return <span key={equipment} className="inline-flex items-center gap-1.5" dir="auto"><bdi dir="ltr">{equipment}</bdi><span title={statusText(state)} aria-label={statusText(state)} data-export-state={state}><span className={state === 'down' ? 'inline-block size-3 rounded-full bg-red-600' : 'inline-block size-3 rounded-full bg-gray-400'} /></span></span>; })}</td>)}
        {showTrafficIncidents && <td className={hasTrafficIncident ? 'max-w-56 whitespace-nowrap p-3 font-semibold text-destructive' : 'max-w-56 whitespace-nowrap p-3 text-muted-foreground'}>{hasTrafficIncident ? trafficIncident : 'â€”'}</td>}
        {showSystemIncidents && <td className="max-w-64 whitespace-nowrap p-3">{systemIncident}</td>}
        <td className="p-3 text-center tabular-nums">{(outageIndex >= 0 ? trafficRow?.[outageIndex]?.trim() : '') || 'â€”'}</td>
        <td className="p-3 whitespace-nowrap">{solarIndex >= 0 ? trafficRow?.[solarIndex]?.trim() || 'â€”' : 'â€”'}</td>
        <td className="max-w-72 p-3 text-xs"><time className="mb-1 block text-[11px] text-muted-foreground">{currentSnapshot ? formatCapturedAt(currentSnapshot.capturedAt, locale) : t('solarHistory')}</time>{historyChanges.length === 0 ? <span className="text-muted-foreground">{previousSnapshot ? t('solarNoChanges') : 'â€”'}</span> : <div className="flex flex-col gap-1">{historyChanges.map(({ equipment, from, to }) => <span key={equipment} dir="auto"><bdi dir="ltr">{equipment}</bdi>: {from ? statusText(from) + ' â†’ ' : ''}{statusText(to)}</span>)}</div>}</td>
      </tr>;
    })}
  </tbody></table></div></div>;
}

function formatCapturedAt(value: string, locale: Parameters<typeof uiMessage>[0]) {
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, {
    dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23', timeZone: 'Asia/Tehran',
  }).format(new Date(value));
}

export function RahcomSolarDaily({ formOpen, onFormOpenChange, selectedProvince, canManage, showIncidents, showTrafficIncidents, showSystemIncidents }: { formOpen: boolean; onFormOpenChange: (open: boolean) => void; selectedProvince: string; canManage: boolean; showIncidents: boolean; showTrafficIncidents: boolean; showSystemIncidents: boolean }) {
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
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [snapshotProvinceState, setSnapshotProvinceState] = useState({
    selection: selectedProvince,
    province: selectedProvince === 'all' ? 'isfahan' : selectedProvince,
  });
  const snapshotProvince = snapshotProvinceState.selection === selectedProvince
    ? snapshotProvinceState.province
    : selectedProvince === 'all' ? 'isfahan' : selectedProvince;
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const entries = useMemo(() => [...parseList(downText, 'down'), ...parseList(unreachableText, 'unreachable')], [downText, unreachableText]);
  const columns = useMemo(() => [...commonEquipment, ...[...customEquipment].sort()].filter((item) => selectedEquipment.includes(item)), [customEquipment, selectedEquipment]);
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);

  useEffect(() => {
    if (formOpen) {
      const current = currentJalaliDateTime();
      setCapturedDate(dateText);
      setCapturedTime(current.time);
    }
  }, [dateText, formOpen, selectedProvince]);
  useEffect(() => {
    let active = true;
    void Promise.all([rahcomApi.solarSnapshots(selectedProvince), rahcomApi.systems(selectedProvince), rahcomApi.trafficSnapshot(selectedProvince)]).then(([solar, systemRows, traffic]) => { if (active) { setSnapshots(solar); setSystems(systemRows); setTrafficSnapshot(traffic); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('solarLoadFailed')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t, selectedProvince]);
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
      const payload = {
        province: snapshotProvince, downText, unreachableText, equipmentColumns: columns,
        capturedAt,
      };
      const snapshot = editingSnapshotId
        ? await rahcomApi.updateSolarSnapshot(editingSnapshotId, payload)
        : await rahcomApi.createSolarSnapshot(payload);
      setSnapshots((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)].sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()));
      setDownText('');
      setUnreachableText('');
      setEditingSnapshotId(null);
      onFormOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('solarSaveFailed'));
    } finally { setSaving(false); }
  }

  function editSnapshot(snapshot: RahcomSolarSnapshot) {
    const timestamp = jalaliDateTimeFromTimestamp(snapshot.capturedAt);
    setDownText(snapshot.downText);
    setUnreachableText(snapshot.unreachableText);
    setCapturedDate(timestamp.date);
    setCapturedTime(timestamp.time);
    setSnapshotProvinceState({ selection: selectedProvince, province: snapshot.province ?? 'isfahan' });
    const selected = snapshot.equipmentColumns.map((column) => /^LTE-[12]$/i.test(column) ? 'LTE' : column);
    setSelectedEquipment([...new Set(selected)]);
    setCustomEquipment((current) => [...new Set([...current, ...selected.filter((item) => !commonEquipment.includes(item))])]);
    setEditingSnapshotId(snapshot.id);
    setEditingColumns(false);
    onFormOpenChange(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteSnapshot(snapshot: RahcomSolarSnapshot) {
    if (!window.confirm(t('solarDeleteSnapshotConfirm'))) return;
    setError('');
    try {
      await rahcomApi.deleteSolarSnapshot(snapshot.id);
      setSnapshots((current) => current.filter((item) => item.id !== snapshot.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('solarSaveFailed'));
    }
  }

  return <section className="space-y-5">
    {formOpen && canManage && <>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 rounded-2xl border border-border bg-card p-4"><span className="block font-semibold">{t('solarDownList')}</span><textarea value={downText} onChange={(e) => setDownText(e.target.value)} placeholder={'DOWN\nRahcom (LTE-1-...) (...) (...)'} className="min-h-48 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" dir="auto" /></label>
      <label className="space-y-2 rounded-2xl border border-border bg-card p-4"><span className="block font-semibold">{t('solarUnreachableList')}</span><textarea value={unreachableText} onChange={(e) => setUnreachableText(e.target.value)} placeholder={'Unreachable\nRahcom (CAM-1-...) (...) (...)'} className="min-h-48 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" dir="auto" /></label>
    </div>

    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{t('solarVisibleColumns')}</h2><button type="button" onClick={() => setEditingColumns((open) => !open)} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground">{t(editingColumns ? 'solarDoneEditingColumns' : 'solarEditColumns')}</button></div>{editingColumns && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{[...commonEquipment, ...[...customEquipment].sort()].map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selectedEquipment.includes(item)} onChange={(event) => setSelectedEquipment((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} />{item}</label>)}</div>}</div>
      <div className="flex flex-wrap items-end gap-3">{canManage ? <label className="grid gap-1 text-xs text-muted-foreground">{t('rahcomProvince')}<select value={snapshotProvince} onChange={(event) => setSnapshotProvinceState({ selection: selectedProvince, province: event.target.value })} className="h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">{iranProvinces.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label> : <span className="self-center text-xs text-muted-foreground">{t('rahcomProvince')}: {iranProvinces.find(([id]) => id === snapshotProvince)?.[1] ?? snapshotProvince}</span>}<span className="self-center text-xs text-muted-foreground">{t('solarCaptureDate')}: {capturedDate}</span><label className="grid gap-1 text-xs text-muted-foreground">{t('solarCaptureTime')}<input type="text" inputMode="numeric" dir="ltr" placeholder="23:59" maxLength={5} value={capturedTime} onChange={(event) => setCapturedTime(event.target.value)} className="h-10 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label><button type="button" disabled={saving} onClick={() => void saveSnapshot()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{t('solarSaveSnapshot')}</button></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>

    {entries.length > 0 && <div className="space-y-2"><h2 className="font-semibold">{t('solarPreview')}</h2><StatusTable entries={entries} columns={columns} locale={locale} selectedProvince={selectedProvince} viewProvince={snapshotProvince} systems={systems} traffic={trafficSnapshot} snapshots={snapshots} showIncidents={showIncidents} showTrafficIncidents={showTrafficIncidents} showSystemIncidents={showSystemIncidents} /></div>}
    </>}

    <div className="space-y-3"><h2 className="text-lg font-bold">{t('solarHistory')}</h2>{loading ? <p role="status" className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : snapshots.length === 0 ? <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('solarNoSnapshots')}</p> : snapshots.map((snapshot) => {
      const columns = snapshot.equipmentColumns.map((column) => /^LTE-[12]$/i.test(column) ? 'LTE' : column).filter((column, columnIndex, all) => all.indexOf(column) === columnIndex);
      const entries = [...parseList(snapshot.downText, 'down'), ...parseList(snapshot.unreachableText, 'unreachable')];
      return <details key={snapshot.id} className="group rounded-2xl border border-border bg-card p-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold"><span className="flex items-center gap-2"><Check size={16} className="text-primary" />{formatCapturedAt(snapshot.capturedAt, locale)}<span className="ms-2 flex items-center gap-1 text-xs font-normal text-muted-foreground">{t('solarExpandSnapshot')}<ChevronDown size={15} className="transition-transform group-open:rotate-180" /></span></span></summary>{canManage && <div className="mt-2 flex items-center gap-1"><button type="button" aria-label={`${t('solarEditSnapshot')} ${formatCapturedAt(snapshot.capturedAt, locale)}`} title={t('solarEditSnapshot')} onClick={() => editSnapshot(snapshot)} className="grid size-8 place-items-center rounded-lg border border-border hover:text-primary"><Pencil size={15} /></button><button type="button" aria-label={`${t('solarDeleteSnapshot')} ${formatCapturedAt(snapshot.capturedAt, locale)}`} title={t('solarDeleteSnapshot')} onClick={() => void deleteSnapshot(snapshot)} className="grid size-8 place-items-center rounded-lg border border-border hover:text-destructive"><Trash2 size={15} /></button></div>}<div className="mt-4 space-y-4"><StatusTable entries={entries} columns={columns} locale={locale} selectedProvince={selectedProvince} viewProvince={snapshot.province ?? 'all'} systems={systems} traffic={trafficSnapshot} snapshots={snapshots} currentSnapshot={snapshot} showIncidents={showIncidents} showTrafficIncidents={showTrafficIncidents} showSystemIncidents={showSystemIncidents} /></div></details>;
    })}</div>
  </section>;
}
