'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardList, Download, LoaderCircle, Map as MapIcon, MapPinned, Save } from 'lucide-react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import { iranProvinces, rahcomApi, type RahcomSolarSnapshot, type RahcomSystem, type RahcomTrafficSnapshot } from '@/lib/api/rahcom/rahcom-api';
import { filterRahcomLtePairs, parseRahcomSolarList as parseList, rahcomLongOutageReasonLabel, rahcomTrafficLongOutageColumns, rahcomTrafficLongOutageValues, tehranDateKey, type RahcomSolarEntry as Entry } from '@/lib/api/rahcom/solar-status';
import { useRahcomDate } from '@/app/(workspace)/rahcom/_shared/rahcom-date';
import { RahcomInfoHeader, RahcomRowInfo } from '@/app/(workspace)/rahcom/_shared/rahcom-row-info';

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

type SolarCellPresentation = {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  horizontal: 'left' | 'center' | 'right';
  vertical: 'top' | 'center' | 'bottom';
  wrapText: boolean;
};

type SolarTablePresentation = { headers: SolarCellPresentation[]; cells: SolarCellPresentation[] };

function readSolarCellPresentation(cell: HTMLElement | undefined): SolarCellPresentation {
  if (!cell) return { fontFamily: 'Arial', fontSize: 10.5, bold: false, horizontal: 'center', vertical: 'center', wrapText: false };
  const style = window.getComputedStyle(cell);
  const firstFont = style.fontFamily.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') || 'Arial';
  const pixelSize = Number.parseFloat(style.fontSize);
  const horizontal = style.textAlign === 'right' || (style.textAlign === 'end' && style.direction === 'ltr') || (style.textAlign === 'start' && style.direction === 'rtl')
    ? 'right'
    : style.textAlign === 'left' || (style.textAlign === 'start' && style.direction === 'ltr') || (style.textAlign === 'end' && style.direction === 'rtl') ? 'left' : 'center';
  const vertical = style.verticalAlign === 'top' ? 'top' : style.verticalAlign === 'bottom' ? 'bottom' : 'center';
  return {
    fontFamily: firstFont,
    fontSize: Number.isFinite(pixelSize) ? Math.round(pixelSize * 0.75 * 10) / 10 : 10.5,
    bold: Number.parseInt(style.fontWeight, 10) >= 600 || style.fontWeight === 'bold',
    horizontal,
    vertical,
    wrapText: !style.whiteSpace.includes('nowrap'),
  };
}

function captureSolarTablePresentation(table: HTMLTableElement): SolarTablePresentation {
  const visibleCells = (row: HTMLTableRowElement | undefined) => row ? Array.from(row.cells).filter((_cell, index) => index !== 1) : [];
  return {
    headers: visibleCells(table.tHead?.rows[0]).map(readSolarCellPresentation),
    cells: visibleCells(table.tBodies[0]?.rows[0]).map(readSolarCellPresentation),
  };
}

function workbookWithColoredSolarStatuses(workbook: XLSX.WorkBook, presentation: SolarTablePresentation) {
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
  const columnCount = sheetRange ? sheetRange.e.c - sheetRange.s.c + 1 : 0;
  const newFills = [
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF0F4F8"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF29445F"/><bgColor indexed="64"/></patternFill></fill>',
  ].join('');
  stylesXml = stylesXml.replace(/<fills\b([^>]*)>([\s\S]*?)<\/fills>/, (_all, attributes: string, body: string) => {
    const updatedAttributes = attributes.replace(/\s+count="\d+"/, '').trim();
    return `<fills ${updatedAttributes} count="${existingFillCount + 3}">${body}${newFills}</fills>`;
  });
  const xmlEscape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const fontXml = (style: SolarCellPresentation, color: string) => `<font>${style.bold ? '<b/>' : ''}<color rgb="${color}"/><sz val="${style.fontSize}"/><name val="${xmlEscape(style.fontFamily)}"/></font>`;
  const headerFonts = Array.from({ length: columnCount }, (_, index) => fontXml(presentation.headers[index] ?? readSolarCellPresentation(undefined), 'FFFFFFFF')).join('');
  const bodyFonts = Array.from({ length: columnCount }, (_, index) => fontXml(presentation.cells[index] ?? readSolarCellPresentation(undefined), 'FF111827')).join('');
  stylesXml = stylesXml.replace(/<fonts\b([^>]*)>([\s\S]*?)<\/fonts>/, (_all, attributes: string, body: string) => {
    const updatedAttributes = attributes.replace(/\s+count="\d+"/, '').trim();
    return `<fonts ${updatedAttributes} count="${existingFontCount + columnCount * 2}">${body}${headerFonts}${bodyFonts}</fonts>`;
  });
  const alignmentXml = (style: SolarCellPresentation) => `<alignment horizontal="${style.horizontal}" vertical="${style.vertical}"${style.wrapText ? ' wrapText="1"' : ''}/>`;
  const newCellFormats = Array.from({ length: columnCount }, (_, index) => {
    const header = presentation.headers[index] ?? readSolarCellPresentation(undefined);
    const cell = presentation.cells[index] ?? readSolarCellPresentation(undefined);
    const headerXf = `<xf numFmtId="0" fontId="${existingFontCount + index}" fillId="${existingFillCount + 2}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${alignmentXml(header)}</xf>`;
    const evenXf = `<xf numFmtId="0" fontId="${existingFontCount + columnCount + index}" fillId="${existingFillCount}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${alignmentXml(cell)}</xf>`;
    const oddXf = `<xf numFmtId="0" fontId="${existingFontCount + columnCount + index}" fillId="${existingFillCount + 1}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">${alignmentXml(cell)}</xf>`;
    return `${headerXf}${evenXf}${oddXf}`;
  }).join('');
  stylesXml = stylesXml.replace(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/, (_all, attributes: string, body: string) => {
    const updatedAttributes = attributes.replace(/\s+count="\d+"/, '').trim();
    return `<cellXfs ${updatedAttributes} count="${existingXfCount + columnCount * 3}">${body}${newCellFormats}</cellXfs>`;
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
    const columnIndex = XLSX.utils.decode_cell(cellReference).c;
    return styledCellXml.replace(/<c\b([^>]*)>/, (_all, attributes: string) => {
      const updatedAttributes = attributes.replace(/\s+s="[^"]*"/, '').trim();
      const rowStyleId = existingXfCount + columnIndex * 3 + (rowNumber === 1 ? 0 : rowNumber % 2 === 0 ? 1 : 2);
      return `<c ${updatedAttributes} s="${rowStyleId}">`;
    });
  });

  XLSX.CFB.utils.cfb_add(archive, '/xl/styles.xml', new TextEncoder().encode(stylesXml));
  XLSX.CFB.utils.cfb_add(archive, '/xl/worksheets/sheet1.xml', new TextEncoder().encode(worksheetXml));
  return XLSX.CFB.write(archive, { fileType: 'zip', type: 'array' });
}

function sizeSolarWorksheetColumns(workbook: XLSX.WorkBook, showIncidents: boolean, displayedTable?: HTMLTableElement | null) {
  const worksheet = workbook.Sheets.Solar;
  if (!worksheet?.['!ref']) return;
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  const lteColumnIndex = Array.from({ length: range.e.c - range.s.c + 1 }, (_, index) => range.s.c + index)
    .find((columnIndex) => String(worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: columnIndex })]?.v ?? '').trim().toUpperCase() === 'LTE') ?? -1;
  const rowNumberIndex = 0;
  const incidentIndex = showIncidents ? 1 : -1;
  const systemCodeIndex = showIncidents ? 2 : 1;
  const systemNameIndex = systemCodeIndex + 1;
  const crmIndex = systemNameIndex + 1;
  const outageIndex = range.e.c - 4;
  const axisCodeIndex = outageIndex + 1;
  const axisNameIndex = outageIndex + 2;
  const equipmentStartIndex = crmIndex + 1;
  const equipmentEndIndex = outageIndex;
  const solarStatusIndex = range.e.c - 1;
  const historyIndex = range.e.c;
  const columnWidths = Array.from({ length: range.e.c + 1 }, (_, columnIndex) => {
    let longestValue = 0;
    for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (!cell) continue;
      const value = String(cell.w ?? cell.v ?? '').replace(/\[\[RAHCOM_STATUS_(?:DOWN|UNREACHABLE)\]\]/g, '');
      longestValue = Math.max(longestValue, ...value.split(/\r?\n/).map((line) => Array.from(line.trim()).length));
    }
    const width = columnIndex === rowNumberIndex ? [7, 8]
      : columnIndex === incidentIndex ? [12, 16]
        : columnIndex === systemCodeIndex ? [13, 16]
          : columnIndex === systemNameIndex ? [24, 36]
            : columnIndex === axisCodeIndex ? [9, 12]
              : columnIndex === axisNameIndex ? [14, 22]
                : columnIndex >= equipmentStartIndex && columnIndex < equipmentEndIndex
                  ? columnIndex === lteColumnIndex ? [16, 22] : [10, 15]
                  : columnIndex === outageIndex ? [8, 11]
                    : columnIndex === crmIndex ? [14, 18]
                      : columnIndex === solarStatusIndex ? [10, 14]
                      : columnIndex === historyIndex ? [44, 68] : [9, 14];
    const [minimum, maximum] = width;
    const naturalWidth = Math.ceil(longestValue * 1.15 + 2);
    return Math.min(maximum, Math.max(minimum, naturalWidth));
  });
  const displayedColumnWidths = displayedTable
    ? Array.from(displayedTable.querySelectorAll('thead th'), (header, index) => ({ header, index })).filter(({ index }) => index !== 1).map(({ header }) => Math.max(8, Math.ceil((header.getBoundingClientRect().width - 5) / 7)))
    : [];
  worksheet['!cols'] = columnWidths.map((wch, columnIndex) => ({ wch: displayedColumnWidths[columnIndex] ?? wch }));
  const displayedRows = displayedTable ? Array.from(displayedTable.querySelectorAll('tr')) : [];
  worksheet['!rows'] = Array.from({ length: range.e.r + 1 }, (_, rowIndex) => {
    const displayedHeight = displayedRows[rowIndex]?.getBoundingClientRect().height;
    if (displayedHeight) return { hpt: Math.max(18, Math.ceil(displayedHeight * 0.75)) };
    if (rowIndex === 0) return { hpt: 28 };
    let estimatedLines = 1;
    let hasStatusDot = false;
    for (let columnIndex = 0; columnIndex <= range.e.c; columnIndex += 1) {
      if (columnIndex === historyIndex || columnIndex === lteColumnIndex) continue;
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      const value = String(cell?.w ?? cell?.v ?? '');
      hasStatusDot ||= value.includes('[[RAHCOM_STATUS_');
      const columnWidth = Math.max(8, columnWidths[columnIndex] - 2);
      const lines = value.replace(/\[\[RAHCOM_STATUS_(?:DOWN|UNREACHABLE)\]\]/g, '').split(/\r?\n/)
        .map((line) => Math.max(1, Math.ceil(Array.from(line).length / columnWidth)));
      estimatedLines = Math.max(estimatedLines, ...lines);
    }
    return { hpt: Math.min(110, Math.max(hasStatusDot ? 22 : 18, estimatedLines * 14 + 4)) };
  });
}

function StatusTable({ entries, columns, locale, selectedProvince, systems = [], traffic = null, snapshots = [], currentSnapshot, viewProvince, showIncidents = true, onRowCountChange }: { entries: Entry[]; columns: string[]; locale: Parameters<typeof uiMessage>[0]; selectedProvince: string; viewProvince?: string; systems?: RahcomSystem[]; traffic?: RahcomTrafficSnapshot | null; snapshots?: RahcomSolarSnapshot[]; currentSnapshot?: RahcomSolarSnapshot; showIncidents?: boolean; onRowCountChange?: (count: number) => void }) {
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const t = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  useEffect(() => {
    if (!currentSnapshot) return;
    const target = document.getElementById('rahcom-solar-table-controls');
    if (target) setToolbarTarget(target);
    return () => setToolbarTarget(null);
  }, [currentSnapshot]);
  const provinceForTable = viewProvince ?? currentSnapshot?.province ?? selectedProvince;
  const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
    .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c_\-./()]/g, '');
  const headers = traffic?.headers ?? emptyTrafficHeaders;
  const findHeader = (predicate: (normalized: string) => boolean) => headers.findIndex((header) => predicate(normalize(header)));
  const codeIndex = findHeader((header) => header.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647') || header.includes('systemcode'));
  const systemNameIndex = findHeader((header) => header.includes('\u0646\u0627\u0645\u0633\u0627\u0645\u0627\u0646\u0647') || header.includes('systemname'));
  const stationNameIndex = findHeader((header) => header.includes('\u0646\u0627\u0645\u0627\u06cc\u0633\u062a\u06af\u0627\u0647') || header.includes('stationname'));
  const outageIndex = findHeader((header) => header.includes('\u0631\u0648\u0632\u0642\u0637\u0639\u06cc') || header.includes('\u062a\u0639\u062f\u0627\u062f\u0631\u0648\u0632\u0642\u0637\u0639\u06cc') || header.includes('outagedays'));
  const trafficCrmIndex = findHeader((header) => header.includes('crm') && (header.includes(normalize('\u062a\u0631\u062f\u062f')) || header.includes('traffic')) && (header.includes(normalize('\u0644\u062d\u0638\u0647\u200c\u0627\u06cc')) || header.includes('realtime')));
  const solarIndex = findHeader((header) => header.includes('\u0633\u0648\u0644\u0627\u0631') || header.includes('solar'));
  const trafficLongOutageColumns = rahcomTrafficLongOutageColumns(headers);
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
  const validEntries = filterRahcomLtePairs(entries).filter((entry) => {
    const equipment = entry.equipment.toUpperCase();
    const visibleEquipment = selectedColumns.has(equipment) || selectedColumns.has('LTE') && /^LTE-[12]$/i.test(equipment);
    return visibleEquipment && systemsByCode.has(entry.site.trim().toUpperCase());
  });
  const historyEquipmentCodes = new Set([...selectedColumns].flatMap((equipment) => equipment === 'LTE' ? ['LTE-1', 'LTE-2'] : [equipment]));
  const snapshotsForProvince = snapshots.filter((snapshot) => snapshot.province === (currentSnapshot ? currentSnapshot.province : viewProvince ?? selectedProvince));
  const chronologicalSnapshots = [...snapshotsForProvince].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  const currentSnapshotIndex = currentSnapshot ? chronologicalSnapshots.findIndex((snapshot) => snapshot.id === currentSnapshot.id) : chronologicalSnapshots.length;
  const previousSnapshot = currentSnapshotIndex > 0 ? chronologicalSnapshots[currentSnapshotIndex - 1] : null;
  const previousCutSites = new Set(previousSnapshot
    ? [...parseList(previousSnapshot.downText, 'down'), ...parseList(previousSnapshot.unreachableText, 'unreachable')]
      .filter((entry) => historyEquipmentCodes.has(entry.equipment.toUpperCase()))
      .map((entry) => entry.site.trim().toUpperCase())
    : []);
  const solarSites = validEntries.map((entry) => entry.site.toUpperCase());
  const trafficIncidentsByCode = new Map<string, string[]>();
  for (const [code, row] of trafficRowsByCode) {
    if (!systemsByCode.has(code)) continue;
    const incidentValues = rahcomTrafficLongOutageValues(headers, row, trafficLongOutageColumns);
    if (incidentValues.length) trafficIncidentsByCode.set(code, [...new Set(incidentValues)]);
  }
  const trafficIncidentSites = new Set(trafficIncidentsByCode.keys());
  const systemLongOutageSites = new Set(provinceSystems.filter((system) => system.longOutage || system.longOutageReason).map((system) => system.systemCode.trim().toUpperCase()));
  // Keep the Solar report equipment-driven. Incident fields are metadata and
  // must not create a row when none of the selected Solar equipment is present.
  const sites = [...new Set(solarSites)]
    .filter((site) => systemsByCode.has(site))
    .filter((site) => showIncidents || (!trafficIncidentSites.has(site) && !systemLongOutageSites.has(site)))
    .sort();
  useEffect(() => { onRowCountChange?.(sites.length); }, [onRowCountChange, sites.length]);
  const bySiteEquipment = new Map<string, 'down' | 'unreachable'>();
  for (const entry of validEntries) {
    const key = `${entry.site.toUpperCase()}:${entry.equipment.toUpperCase()}`;
    const previous = bySiteEquipment.get(key);
    bySiteEquipment.set(key, previous === 'down' || entry.state === 'down' ? 'down' : 'unreachable');
  }
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
  const systemLongOutageText = (system: RahcomSystem | null) => system && (system.longOutage || system.longOutageReason)
    ? (system.longOutageReason ? rahcomLongOutageReasonLabel(system.longOutageReason, system.longOutageDetails) : 'دلیل مشخص نشده')
    : '';
  const recordRows = sites.map((site) => {
    const system = systemsByCode.get(site) ?? null;
    const trafficRow = trafficRowsByCode.get(site);
    const axisCode = system?.axisCode || '';
    const axisName = system?.announcedAxis?.trim() ?? '';
    const groupKey = axisCode || '__no_axis__';
    return { site, system, trafficRow, axisCode, axisName, groupKey };
  });
  const sortedRows = [...recordRows].sort((left, right) => left.axisCode.localeCompare(right.axisCode, locale, { numeric: true, sensitivity: 'base' }) || left.site.localeCompare(right.site, 'en', { numeric: true, sensitivity: 'base' }));
  const statusText = (state: 'normal' | 'down' | 'unreachable') => t(state === 'down' ? 'solarStatusDown' : state === 'unreachable' ? 'solarStatusUnreachable' : 'solarStatusNormal');
  const historyStatusText = (state: 'normal' | 'cut') => state === 'normal' ? t('solarStatusNormal') : locale === 'fa' ? 'قطع' : t('solarStatusDown');
  const downloadExcel = () => {
    if (!tableRef.current) return;
    const exportTable = tableRef.current.cloneNode(true) as HTMLTableElement;
    exportTable.querySelectorAll('tr').forEach((row) => row.cells.item(1)?.remove());
    exportTable.querySelectorAll<HTMLElement>('[data-export-state]').forEach((status) => {
      status.append(document.createTextNode(`[[RAHCOM_STATUS_${status.dataset.exportState?.toUpperCase()}]]`));
    });
    const presentation = captureSolarTablePresentation(tableRef.current);
    const workbook = XLSX.utils.table_to_book(exportTable, { sheet: 'Solar' });
    sizeSolarWorksheetColumns(workbook, showIncidents, tableRef.current);
    const timestamp = (currentSnapshot?.capturedAt ?? new Date().toISOString()).replace(/[-:T.Z]/g, '').slice(0, 14);
    const fileData = workbookWithColoredSolarStatuses(workbook, presentation);
    const fileBytes = new Uint8Array(fileData as ArrayBuffer);
    const fileUrl = URL.createObjectURL(new Blob([fileBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = fileUrl;
    downloadLink.download = `solar-daily-${timestamp}.xlsx`;
    downloadLink.click();
    window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
  };
  const toolbarControls = currentSnapshot && toolbarTarget ? createPortal(<div className="inline-flex shrink-0 items-center gap-2 text-sm">
    <button type="button" onClick={downloadExcel} aria-label={t('solarDownloadExcel')} title={t('solarDownloadExcel')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground hover:border-primary hover:text-primary"><Download size={16} /></button>
  </div>, toolbarTarget) : null;
  const columnCount = 10 + equipmentGroups.length + Number(showIncidents);
  let nextRowNumber = 0;
  const numberedRows = sortedRows.map((row) => ({ ...row, rowNumber: ++nextRowNumber }));
  return <div className={currentSnapshot ? 'flex min-w-0 flex-col gap-3' : 'space-y-3'}>{toolbarControls}<div className="h-auto max-h-none min-w-0 max-w-full shrink-0 overflow-x-auto rounded-2xl border border-border bg-card"><table ref={tableRef} className="rahcom-sticky-table w-full min-w-max text-sm"><thead className="bg-muted/50"><tr>
    <th className="p-3 text-center align-middle">{t('rahcomRowNumber')}</th><th className="w-9 px-1 py-3 text-center"><RahcomInfoHeader /></th>{showIncidents && <th className="p-3 text-center align-middle">{t('rahcomIncidentFilter')}</th>}<th className="p-3 text-start">{t('rahcomSystemCode')}</th><th className="p-3 text-start">{t('rahcomSystemName')}</th><th className="whitespace-nowrap p-3 text-center align-middle">تردد لحظه‌ای CRM</th>
    {equipmentGroups.map((group) => <th key={group.equipment.join('|')} className={`whitespace-nowrap p-3 text-center ${group.label === 'LTE' ? 'min-w-[11rem]' : ''}`} dir="ltr">{group.label}</th>)}
    <th className="p-3 text-start">{t('rahcomOutageDaysColumn')}</th><th className="p-3 text-start">{t('rahcomAxisCode')}</th><th className="p-3 text-start">{t('rahcomAxisName')}</th><th className="w-32 max-w-32 whitespace-nowrap p-3 text-center align-middle">{t('rahcomTrafficSolarStatus')}</th><th className="p-3 text-start">{t('solarHistory')}</th>
  </tr></thead><tbody>
    {sites.length === 0 ? <tr><td colSpan={columnCount} className="p-4 text-center text-muted-foreground">{t('solarNoEntries')}</td></tr> : numberedRows.map(({ site, system, trafficRow, axisCode, axisName, rowNumber }) => {
      const trafficIncident = trafficIncidentsByCode.get(site)?.join(' · ') ?? '';
      const longOutageText = systemLongOutageText(system);
      const currentState: 'normal' | 'cut' = displayedEquipmentCodes.some((equipment) => bySiteEquipment.has(site + ':' + equipment)) ? 'cut' : 'normal';
      const previousState: 'normal' | 'cut' = previousCutSites.has(site) ? 'cut' : 'normal';
      const historyChange = previousSnapshot
        ? previousState !== currentState ? { from: previousState, to: currentState } : null
        : currentState === 'cut' ? { from: null, to: currentState } : null;
      return <tr key={site} className="border-t border-border">
        <td className="p-2 text-center tabular-nums">{rowNumber.toLocaleString(locale)}</td>
        <td className="w-9 px-1 py-1 text-center"><RahcomRowInfo title={system?.systemName || site} systemCode={site} system={system} fields={[{ label: t('rahcomSystemCode'), value: site }, { label: t('rahcomSystemName'), value: system?.systemName ?? '' }, { label: t('rahcomIncidentFilter'), value: longOutageText }, { label: 'سرقت و تخریب تردد', value: trafficIncident }, { label: t('rahcomDailyTraffic'), value: trafficCrmIndex >= 0 ? trafficRow?.[trafficCrmIndex]?.trim() ?? '' : '' }, ...displayedEquipmentCodes.map((equipment) => ({ label: equipment, value: bySiteEquipment.has(`${site}:${equipment}`) ? statusText(bySiteEquipment.get(`${site}:${equipment}`)!) : '' })), { label: t('rahcomOutageDaysColumn'), value: outageIndex >= 0 ? trafficRow?.[outageIndex]?.trim() ?? '' : '' }, { label: t('rahcomAxisCode'), value: axisCode }, { label: t('rahcomAxisName'), value: axisName }]} /></td>
        {showIncidents && <td title={longOutageText} className="max-w-64 whitespace-nowrap p-2 text-center align-middle">{longOutageText || '\u2014'}</td>}
        <td className="p-2 font-mono" dir="ltr">{site}</td>
        <td className="p-2">{system?.systemName || (systemNameIndex >= 0 ? trafficRow?.[systemNameIndex] : '') || (stationNameIndex >= 0 ? trafficRow?.[stationNameIndex] : '') || '—'}</td>
        <td className="whitespace-nowrap p-2 text-center align-middle">{trafficCrmIndex >= 0 ? trafficRow?.[trafficCrmIndex]?.trim() || '—' : '—'}</td>


        {equipmentGroups.map((group) => <td key={group.equipment.join('|')} className={`whitespace-nowrap p-2 text-center ${group.label === 'LTE' ? 'min-w-[11rem]' : ''}`}>{group.equipment.filter((equipment) => bySiteEquipment.has(site + ':' + equipment)).length === 0 ? '—' : group.equipment.filter((equipment) => bySiteEquipment.has(site + ':' + equipment)).map((equipment, equipmentIndex, visibleEquipment) => { const state = bySiteEquipment.get(site + ':' + equipment)!; return <span key={equipment} className={`inline-flex items-center gap-1.5 ${equipmentIndex < visibleEquipment.length - 1 ? 'mx-1.5' : ''}`} dir="auto"><bdi dir="ltr">{equipment}</bdi><span title={statusText(state)} aria-label={statusText(state)} data-export-state={state}><span className={state === 'down' ? 'inline-block size-3 rounded-full bg-red-600' : 'inline-block size-3 rounded-full bg-gray-400'} /></span></span>; })}</td>)}
        <td className="p-2 text-center tabular-nums">{(outageIndex >= 0 ? trafficRow?.[outageIndex]?.trim() : '') || '—'}</td>
        <td className="p-2 font-mono" dir="ltr">{axisCode || '—'}</td>
        <td className="p-2">{axisName || '—'}</td>

        <td className="w-32 max-w-32 whitespace-nowrap p-2 text-center align-middle">{solarIndex >= 0 ? trafficRow?.[solarIndex]?.trim() || '—' : '—'}</td>
        <td className="whitespace-nowrap p-2 text-xs"><time className="me-2 inline text-[11px] text-muted-foreground">{currentSnapshot ? formatCapturedAt(currentSnapshot.capturedAt, locale) : t('solarHistory')}</time>{!historyChange ? <span className="text-muted-foreground">{previousSnapshot ? t('solarNoChanges') : '—'}</span> : <span>{historyChange.from ? `${historyStatusText(historyChange.from)} → ` : ''}{historyStatusText(historyChange.to)}</span>}</td>
      </tr>;
    })}
  </tbody></table></div></div>;
}

function formatCapturedAt(value: string, locale: Parameters<typeof uiMessage>[0]) {
  return new Intl.DateTimeFormat(locale === 'fa' ? 'fa-IR-u-ca-persian' : locale, {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Tehran',
  }).format(new Date(value));
}

export function RahcomSolarDaily({ formOpen, onFormOpenChange, selectedProvince, canManage, showIncidents = true, selectedSnapshotId, onSnapshotSelect, onSolarSnapshotsChange, onSystemCountChange, snapshotRevision = 0 }: { formOpen: boolean; onFormOpenChange: (open: boolean) => void; selectedProvince: string; canManage: boolean; showIncidents?: boolean; selectedSnapshotId: string; onSnapshotSelect: (id: string) => void; onSolarSnapshotsChange: (snapshots: RahcomSolarSnapshot[]) => void; onSystemCountChange: (count: number) => void; snapshotRevision?: number }) {
  const { locale } = usePreferences();
  const { dateText, date } = useRahcomDate();
  const [downText, setDownText] = useState('');
  const [unreachableText, setUnreachableText] = useState('');
  const [capturedDate, setCapturedDate] = useState('');
  const [capturedTime, setCapturedTime] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>(defaultEquipment);
  const [editingColumns, setEditingColumns] = useState(false);
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<RahcomSolarSnapshot[]>([]);
  const [editingSnapshotId, setEditingSnapshotId] = useState<string | null>(null);
  const [editingSnapshotProvince, setEditingSnapshotProvince] = useState<string | null>(null);
  const snapshotProvince = editingSnapshotId
    ? editingSnapshotProvince ?? (selectedProvince === 'all' ? '' : selectedProvince)
    : selectedProvince === 'all' ? '' : selectedProvince;
  const [systems, setSystems] = useState<RahcomSystem[]>([]);
  const [trafficSnapshot, setTrafficSnapshot] = useState<RahcomTrafficSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const entries = useMemo(() => [...parseList(downText, 'down'), ...parseList(unreachableText, 'unreachable')], [downText, unreachableText]);
  const columns = useMemo(() => [...commonEquipment, ...[...customEquipment].sort()].filter((item) => selectedEquipment.includes(item)), [customEquipment, selectedEquipment]);
  const t = useCallback((key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key), [locale]);
  const snapshotsForDate = snapshots.filter((snapshot) => tehranDateKey(snapshot.capturedAt) === (date ?? tehranDateKey()));
  const selectedSnapshot = snapshotsForDate.find((snapshot) => snapshot.id === selectedSnapshotId) ?? snapshotsForDate[0] ?? null;
  const selectedSnapshotColumns = selectedSnapshot?.equipmentColumns.map((column) => /^LTE-[12]$/i.test(column) ? 'LTE' : column).filter((column, index, all) => all.indexOf(column) === index) ?? [];
  const selectedSnapshotEntries = selectedSnapshot ? [...parseList(selectedSnapshot.downText, 'down'), ...parseList(selectedSnapshot.unreachableText, 'unreachable')] : [];
  useEffect(() => { if (!selectedSnapshot) onSystemCountChange(0); }, [onSystemCountChange, selectedSnapshot]);

  useEffect(() => {
    if (formOpen) {
      const current = currentJalaliDateTime();
      setCapturedDate(dateText);
      setCapturedTime(current.time);
    }
  }, [dateText, formOpen, selectedProvince]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([rahcomApi.solarSnapshots(selectedProvince, date ?? undefined), rahcomApi.systems(selectedProvince), rahcomApi.trafficSnapshot(selectedProvince, date ?? undefined)]).then(([solar, systemRows, traffic]) => { if (active) { setSnapshots([...solar].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime())); setSystems(systemRows); setTrafficSnapshot(traffic); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t('solarLoadFailed')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t, selectedProvince, date, snapshotRevision]);
  useEffect(() => {
    if (!loading) onSolarSnapshotsChange(snapshots);
  }, [loading, onSolarSnapshotsChange, snapshots]);
  useEffect(() => {
    const found = [...new Set(entries.map((entry) => entry.equipment))]
      .filter((item) => !/^LTE-[12]$/i.test(item) && !commonEquipment.includes(item) && !customEquipment.includes(item));
    if (found.length) {
      setCustomEquipment((current) => [...current, ...found]);
      setSelectedEquipment((current) => [...new Set([...current, ...found])]);
    }
  }, [customEquipment, entries]);

  async function saveSnapshot() {
    if (!snapshotProvince) { setError(t('solarChooseProvinceFromHeader')); return; }
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
      setSnapshots((current) => [snapshot, ...current.filter((item) => item.id !== snapshot.id)].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime() || new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime()));
      onSnapshotSelect(snapshot.id);
      setDownText('');
      setUnreachableText('');
      setEditingSnapshotId(null);
      setEditingSnapshotProvince(null);
      onFormOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('solarSaveFailed'));
    } finally { setSaving(false); }
  }

  function fillDemoData() {
    if (!snapshotProvince) { setError(t('solarChooseProvinceFromHeader')); return; }
    const codes = [...new Set(systems
      .filter((system) => system.province === snapshotProvince)
      .map((system) => system.systemCode.trim().toUpperCase())
      .filter(Boolean))].slice(0, 8);
    if (!codes.length) { setError(t('solarDemoNeedsSystems')); return; }
    const downCodes = codes.slice(0, Math.max(1, Math.ceil(codes.length / 2)));
    const unreachableCodes = codes.slice(downCodes.length);
    const makeLines = (items: string[], equipment: string) => items.map((code) => `Rahcom (${equipment}-${code})(DEMO)(DEMO)`).join('\n');
    setDownText(`DownDown\n${makeLines(downCodes, 'CAM-1')}${downCodes.length ? `\n${makeLines(downCodes, 'RTR-1')}` : ''}`);
    setUnreachableText(`UnreachableUnreachable\n${makeLines(unreachableCodes.length ? unreachableCodes : downCodes.slice(0, 1), 'RAD-1')}`);
    setSelectedEquipment((current) => [...new Set([...current, 'CAM-1', 'RTR-1', 'RAD-1'])]);
    setEditingColumns(false);
    setError('');
  }

  return <section className="flex min-h-full shrink-0 flex-col gap-5">
    {formOpen && canManage && <>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t(editingSnapshotId ? 'solarEditSnapshot' : 'solarAddSnapshot')}</h2><button type="button" onClick={() => void fillDemoData()} disabled={saving || loading || !canManage} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"><ClipboardList size={16} />{t('solarFillDemoData')}</button></div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 rounded-2xl border border-border bg-card p-4"><span className="block font-semibold">{t('solarDownList')}</span><textarea value={downText} onChange={(e) => setDownText(e.target.value)} placeholder={'DOWN\nRahcom (LTE-1-...) (...) (...)'} className="min-h-48 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" dir="auto" /></label>
      <label className="space-y-2 rounded-2xl border border-border bg-card p-4"><span className="block font-semibold">{t('solarUnreachableList')}</span><textarea value={unreachableText} onChange={(e) => setUnreachableText(e.target.value)} placeholder={'Unreachable\nRahcom (CAM-1-...) (...) (...)'} className="min-h-48 w-full rounded-xl border border-border bg-background p-3 font-mono text-sm" dir="auto" /></label>
    </div>

    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t('solarVisibleColumns')}</h2><button type="button" onClick={() => setEditingColumns((open) => !open)} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground">{t(editingColumns ? 'solarDoneEditingColumns' : 'solarEditColumns')}</button></div>{editingColumns && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">{[...commonEquipment, ...[...customEquipment].sort()].map((item) => <label key={item} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={selectedEquipment.includes(item)} onChange={(event) => setSelectedEquipment((current) => event.target.checked ? [...current, item] : current.filter((value) => value !== item))} />{item}</label>)}</div>}</div>
      <div className="flex flex-wrap items-end gap-3 border-t border-border bg-card py-2"><span className="self-center text-xs text-muted-foreground">{t('solarCaptureDate')}: {capturedDate}</span><label className="grid gap-1 text-xs text-muted-foreground">{t('solarCaptureTime')}<input type="text" inputMode="numeric" dir="ltr" placeholder="23:59" maxLength={5} value={capturedTime} onChange={(event) => setCapturedTime(event.target.value)} className="h-10 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground" /></label><button type="button" disabled={saving || !snapshotProvince} onClick={() => void saveSnapshot()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}{t('solarSaveSnapshot')}</button></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!snapshotProvince && <p role="status" className="text-xs text-muted-foreground">{t('solarChooseProvinceFromHeader')}</p>}
    </div>

    {entries.length > 0 && <div className="space-y-2"><h2 className="font-semibold">{t('solarPreview')}</h2><StatusTable entries={entries} columns={columns} locale={locale} selectedProvince={selectedProvince} viewProvince={snapshotProvince} systems={systems} traffic={trafficSnapshot} snapshots={snapshots} showIncidents={showIncidents} /></div>}
    </>}

    <div className="flex min-w-0 flex-col gap-3">{loading ? <p role="status" className="shrink-0 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('rahcomSystemsLoading')}</p> : !selectedSnapshot ? <p className="shrink-0 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">{t('solarNoSnapshots')}</p> : <>
      <StatusTable entries={selectedSnapshotEntries} columns={selectedSnapshotColumns} locale={locale} selectedProvince={selectedProvince} viewProvince={selectedSnapshot.province ?? selectedProvince} systems={systems} traffic={trafficSnapshot} snapshots={snapshotsForDate} currentSnapshot={selectedSnapshot} showIncidents={showIncidents} onRowCountChange={onSystemCountChange} />
    </>}</div>
  </section>;
}
