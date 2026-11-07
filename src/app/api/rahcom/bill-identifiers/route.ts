import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '@/lib/api-environment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const workbookName = 'شناسه_های-قبض-گروه 01 - تکمیل شده.xlsx';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: profileResponse.status === 401 ? 401 : 403 });
    }

    const filePath = path.join(process.cwd(), '\u0645\u062a\u0641\u0631\u0642\u0647', workbookName);
    const workbookBytes = await readFile(filePath);
    const workbook = XLSX.read(workbookBytes, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) return NextResponse.json({ headers: [], rows: [] });

    const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: '', blankrows: false });
    const headers = (values[0] ?? []).map((value) => String(value ?? '').trim());
    const rows = values.slice(1)
      .filter((row) => row.some((value) => String(value ?? '').trim()))
      .map((row) => headers.map((_, index) => String(row[index] ?? '').trim()));

    const registeredDateHeader = '\u062a\u0627\u0631\u06cc\u062e \u062b\u0628\u062a';
    const hasRegisteredDateColumn = headers.some((header) => header.trim().normalize('NFKC') === registeredDateHeader.normalize('NFKC'));
    if (!hasRegisteredDateColumn) {
      headers.push(registeredDateHeader);
      rows.forEach((row) => row.push(''));
    }

    return NextResponse.json({ headers, rows }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'workbook_unavailable' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: profileResponse.status === 401 ? 401 : 403 });
    }

    const body = await request.json() as { rowIndex?: number; systemCode?: string; systemCodes?: unknown };
    const rowIndex = body.rowIndex;
    const systemCodes = Array.isArray(body.systemCodes)
      ? body.systemCodes
      : typeof body.systemCode === 'string' ? [body.systemCode] : null;
    if (typeof rowIndex !== 'number' || !Number.isInteger(rowIndex) || rowIndex < 0 || !systemCodes
      || systemCodes.length > 50 || systemCodes.some((code) => typeof code !== 'string')) {
      return NextResponse.json({ error: 'invalid_assignment' }, { status: 400 });
    }
    const normalizedSystemCodes = [...new Set(systemCodes.map((code) => (code as string).trim()).filter(Boolean))];

    const filePath = path.join(process.cwd(), '\u0645\u062a\u0641\u0631\u0642\u0647', workbookName);
    const workbookBytes = await readFile(filePath);
    const workbook = XLSX.read(workbookBytes, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet || !worksheet['!ref']) return NextResponse.json({ error: 'workbook_unavailable' }, { status: 404 });

    const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: '', blankrows: false });
    const headers = (values[0] ?? []).map((value) => String(value ?? '').trim());
    const normalize = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
      .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c]/g, '').replace(/[\/\\_-]/g, '');
    const codeColumn = headers.findIndex((header) => ['\u06a9\u062f \u0633\u0627\u0645\u0627\u0646\u0647', '\u06a9\u062f \u0633\u06cc\u0633\u062a\u0645'].some((alias) => normalize(alias) === normalize(header)));
    if (codeColumn < 0) return NextResponse.json({ error: 'system_code_column_missing' }, { status: 400 });

    const records = values.slice(1).filter((row) => row.some((value) => String(value ?? '').trim()));
    const target = records[rowIndex];
    if (!target) return NextResponse.json({ error: 'record_not_found' }, { status: 404 });
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    let nonEmptyIndex = -1;
    let targetSheetRow = -1;
    for (let sheetRow = range.s.r + 1; sheetRow <= range.e.r; sheetRow += 1) {
      const rowHasData = Array.from({ length: range.e.c - range.s.c + 1 }, (_, offset) => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: sheetRow, c: range.s.c + offset })];
        return String(cell?.w ?? cell?.v ?? '').trim();
      }).some(Boolean);
      if (rowHasData) nonEmptyIndex += 1;
      if (nonEmptyIndex === rowIndex) { targetSheetRow = sheetRow; break; }
    }
    if (targetSheetRow < 0) return NextResponse.json({ error: 'record_not_found' }, { status: 404 });

    const cellAddress = XLSX.utils.encode_cell({ r: targetSheetRow, c: range.s.c + codeColumn });
    const oldCell = worksheet[cellAddress];
    worksheet[cellAddress] = { ...(oldCell ?? {}), t: 's', v: normalizedSystemCodes.join(';') };
    const updated = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    await writeFile(filePath, updated);

    return NextResponse.json({ saved: true, rowIndex, systemCodes: normalizedSystemCodes });
  } catch (error) {
    console.error('Could not save bill identifier workbook assignment:', error);
    return NextResponse.json({ error: 'workbook_write_failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: profileResponse.status === 401 ? 401 : 403 });
    }

    const body = await request.json() as { billIdentifier?: unknown; systemCodes?: unknown; fields?: unknown };
    if (typeof body.billIdentifier !== 'string' || !body.billIdentifier.trim()) {
      return NextResponse.json({ error: 'invalid_bill_identifier' }, { status: 400 });
    }
    if (body.systemCodes !== undefined && (!Array.isArray(body.systemCodes) || body.systemCodes.length > 50 || body.systemCodes.some((code) => typeof code !== 'string'))) {
      return NextResponse.json({ error: 'invalid_assignment' }, { status: 400 });
    }
    if (body.fields !== undefined && (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)
      || Object.values(body.fields).some((value) => typeof value !== 'string'))) {
      return NextResponse.json({ error: 'invalid_fields' }, { status: 400 });
    }
    const systemCodes = [...new Set(((body.systemCodes ?? []) as string[]).map((code) => code.trim()).filter(Boolean))];
    const billIdentifier = body.billIdentifier.trim();
    const normalizeDigits = (value: string) => value.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 : code - 0x0660);
    });
    const filePath = path.join(process.cwd(), '\u0645\u062a\u0641\u0631\u0642\u0647', workbookName);
    const workbook = XLSX.read(await readFile(filePath), { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet || !worksheet['!ref']) return NextResponse.json({ error: 'workbook_unavailable' }, { status: 404 });

    const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: '', blankrows: false });
    const headers = (values[0] ?? []).map((value) => String(value ?? '').trim());
    const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
      .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c]/g, '').replace(/[\/\\_-]/g, '');
    const billIdentifierColumn = headers.findIndex((header) => ['\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636', '\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636\u0628\u0631\u0642']
      .includes(normalizeHeader(header)));
    const systemCodeColumn = headers.findIndex((header) => ['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', '\u06a9\u062f\u0633\u06cc\u0633\u062a\u0645'].includes(normalizeHeader(header)));
    const rowNumberColumn = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader('\u0631\u062f\u06cc\u0641'));
    const statusColumn = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader('\u0648\u0636\u0639\u06cc\u062a \u0628\u0631\u0631\u0633\u06cc'));
    if (billIdentifierColumn < 0) return NextResponse.json({ error: 'bill_identifier_column_missing' }, { status: 400 });

    const registeredDateHeader = '\u062a\u0627\u0631\u06cc\u062e \u062b\u0628\u062a';
    let registeredDateColumn = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader(registeredDateHeader));
    if (registeredDateColumn < 0) {
      registeredDateColumn = headers.length;
      XLSX.utils.sheet_add_aoa(worksheet, [[registeredDateHeader]], { origin: { r: 0, c: registeredDateColumn } });
      headers.push(registeredDateHeader);
    }

    const suppliedFields = (body.fields ?? {}) as Record<string, string>;
    const rowNumberHeader = normalizeHeader('\u0631\u062f\u06cc\u0641');
    const dateHeader = normalizeHeader(registeredDateHeader);
    for (const header of Object.keys(suppliedFields)) {
      const column = headers.findIndex((candidate) => normalizeHeader(candidate) === normalizeHeader(header));
      if (column < 0 || column === billIdentifierColumn || column === systemCodeColumn
        || normalizeHeader(headers[column]) === rowNumberHeader || normalizeHeader(headers[column]) === dateHeader) {
        return NextResponse.json({ error: 'invalid_fields' }, { status: 400 });
      }
    }

    const records = values.slice(1).filter((row) => row.some((value) => String(value ?? '').trim()));
    const normalizedBillIdentifier = normalizeDigits(billIdentifier).replace(/\s/g, '');
    const duplicate = records.some((row) => normalizeDigits(String(row[billIdentifierColumn] ?? '')).replace(/\s/g, '') === normalizedBillIdentifier);
    if (duplicate) return NextResponse.json({ error: 'duplicate_bill_identifier' }, { status: 409 });

    const nextRow: string[] = Array(headers.length).fill('');
    nextRow[billIdentifierColumn] = billIdentifier;
    if (systemCodeColumn >= 0) nextRow[systemCodeColumn] = systemCodes.join(';');
    else if (systemCodes.length) return NextResponse.json({ error: 'system_code_column_missing' }, { status: 400 });
    for (const [header, value] of Object.entries(suppliedFields)) {
      const column = headers.findIndex((candidate) => normalizeHeader(candidate) === normalizeHeader(header));
      nextRow[column] = value.trim();
    }
    if (rowNumberColumn >= 0) {
      const currentNumbers = records.map((row) => Number(normalizeDigits(String(row[rowNumberColumn] ?? '')))).filter(Number.isFinite);
      nextRow[rowNumberColumn] = String(Math.max(0, ...currentNumbers) + 1);
    }
    if (statusColumn >= 0 && !nextRow[statusColumn]) nextRow[statusColumn] = '\u062f\u0631 \u0627\u0646\u062a\u0638\u0627\u0631 \u0628\u0631\u0631\u0633\u06cc';
    const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const datePart = (type: string) => dateParts.find((part) => part.type === type)?.value ?? '';
    nextRow[registeredDateColumn] = `${datePart('year')}-${datePart('month')}-${datePart('day')}`;

    XLSX.utils.sheet_add_aoa(worksheet, [nextRow], { origin: -1 });
    await writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    return NextResponse.json({ saved: true, row: nextRow, systemCodes }, { status: 201 });
  } catch (error) {
    console.error('Could not add bill identifier workbook record:', error);
    return NextResponse.json({ error: 'workbook_write_failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: profileResponse.status === 401 ? 401 : 403 });
    }

    const body = await request.json() as { rowIndex?: number; fields?: unknown; systemCodes?: unknown };
    if (!Number.isInteger(body.rowIndex) || (body.rowIndex ?? -1) < 0
      || !body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields)
      || Object.values(body.fields).some((value) => typeof value !== 'string')
      || (body.systemCodes !== undefined && (!Array.isArray(body.systemCodes) || body.systemCodes.length > 50 || body.systemCodes.some((code) => typeof code !== 'string')))) {
      return NextResponse.json({ error: 'invalid_record_update' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), '\u0645\u062a\u0641\u0631\u0642\u0647', workbookName);
    const workbook = XLSX.read(await readFile(filePath), { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet || !worksheet['!ref']) return NextResponse.json({ error: 'workbook_unavailable' }, { status: 404 });

    const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: '', blankrows: false });
    const headers = (values[0] ?? []).map((value) => String(value ?? '').trim());
    const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
      .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c]/g, '').replace(/[\/\\_-]/g, '');
    const records = values.slice(1).filter((row) => row.some((value) => String(value ?? '').trim()));
    const target = records[body.rowIndex];
    if (!target) return NextResponse.json({ error: 'record_not_found' }, { status: 404 });

    const normalizeDigits = (value: string) => value.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 : code - 0x0660);
    });
    const rowNumberColumn = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader('\u0631\u062f\u06cc\u0641'));
    const registeredDateColumn = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader('\u062a\u0627\u0631\u06cc\u062e \u062b\u0628\u062a'));
    const systemCodeColumn = headers.findIndex((header) => ['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', '\u06a9\u062f\u0633\u06cc\u0633\u062a\u0645'].includes(normalizeHeader(header)));
    const billIdentifierColumn = headers.findIndex((header) => ['\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636', '\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636\u0628\u0631\u0642'].includes(normalizeHeader(header)));
    const fields = body.fields as Record<string, string>;
    const fieldUpdates = new Map<number, string>();
    for (const [header, value] of Object.entries(fields)) {
      const column = headers.findIndex((candidate) => normalizeHeader(candidate) === normalizeHeader(header));
      if (column < 0 || column === rowNumberColumn || column === registeredDateColumn || column === systemCodeColumn) {
        return NextResponse.json({ error: 'invalid_record_field' }, { status: 400 });
      }
      fieldUpdates.set(column, value.trim());
    }

    const requestedBillId = fieldUpdates.get(billIdentifierColumn);
    if (requestedBillId !== undefined) {
      const normalized = normalizeDigits(requestedBillId).replace(/\s/g, '');
      const duplicate = records.some((row, index) => index !== body.rowIndex
        && normalizeDigits(String(row[billIdentifierColumn] ?? '')).replace(/\s/g, '') === normalized);
      if (duplicate) return NextResponse.json({ error: 'duplicate_bill_identifier' }, { status: 409 });
    }

    let targetSheetRow = -1;
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    let nonEmptyIndex = -1;
    for (let sheetRow = range.s.r + 1; sheetRow <= range.e.r; sheetRow += 1) {
      const rowHasData = Array.from({ length: range.e.c - range.s.c + 1 }, (_, offset) => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: sheetRow, c: range.s.c + offset })];
        return String(cell?.w ?? cell?.v ?? '').trim();
      }).some(Boolean);
      if (rowHasData) nonEmptyIndex += 1;
      if (nonEmptyIndex === body.rowIndex) { targetSheetRow = sheetRow; break; }
    }
    if (targetSheetRow < 0) return NextResponse.json({ error: 'record_not_found' }, { status: 404 });

    for (const [column, value] of fieldUpdates) {
      const address = XLSX.utils.encode_cell({ r: targetSheetRow, c: range.s.c + column });
      worksheet[address] = { ...(worksheet[address] ?? {}), t: 's', v: value };
    }
    const systemCodes = body.systemCodes === undefined ? null : [...new Set((body.systemCodes as string[]).map((code) => code.trim()).filter(Boolean))];
    if (systemCodes && systemCodeColumn >= 0) {
      const address = XLSX.utils.encode_cell({ r: targetSheetRow, c: range.s.c + systemCodeColumn });
      worksheet[address] = { ...(worksheet[address] ?? {}), t: 's', v: systemCodes.join(';') };
    } else if (systemCodes?.length) {
      return NextResponse.json({ error: 'system_code_column_missing' }, { status: 400 });
    }

    const updatedRow = headers.map((_, column) => {
      if (fieldUpdates.has(column)) return fieldUpdates.get(column) ?? '';
      if (column === systemCodeColumn && systemCodes) return systemCodes.join(';');
      return String(target[column] ?? '').trim();
    });
    await writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    return NextResponse.json({ saved: true, row: updatedRow });
  } catch (error) {
    console.error('Could not edit bill identifier workbook record:', error);
    return NextResponse.json({ error: 'workbook_write_failed' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!profileResponse.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: profileResponse.status === 401 ? 401 : 403 });
    }

    const body = await request.json() as { rowIndex?: number };
    if (!Number.isInteger(body.rowIndex) || (body.rowIndex ?? -1) < 0) {
      return NextResponse.json({ error: 'invalid_row' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), '\u0645\u062a\u0641\u0631\u0642\u0647', workbookName);
    const workbook = XLSX.read(await readFile(filePath), { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet || !worksheet['!ref']) return NextResponse.json({ error: 'workbook_unavailable' }, { status: 404 });

    const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: '', blankrows: false });
    const records = values.slice(1).filter((row) => row.some((value) => String(value ?? '').trim()));
    if (!records[body.rowIndex]) return NextResponse.json({ error: 'record_not_found' }, { status: 404 });

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    let nonEmptyIndex = -1;
    let targetSheetRow = -1;
    for (let sheetRow = range.s.r + 1; sheetRow <= range.e.r; sheetRow += 1) {
      const rowHasData = Array.from({ length: range.e.c - range.s.c + 1 }, (_, offset) => {
        const cell = worksheet[XLSX.utils.encode_cell({ r: sheetRow, c: range.s.c + offset })];
        return String(cell?.w ?? cell?.v ?? '').trim();
      }).some(Boolean);
      if (rowHasData) nonEmptyIndex += 1;
      if (nonEmptyIndex === body.rowIndex) { targetSheetRow = sheetRow; break; }
    }
    if (targetSheetRow < 0) return NextResponse.json({ error: 'record_not_found' }, { status: 404 });

    for (let row = targetSheetRow; row < range.e.r; row += 1) {
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const destination = XLSX.utils.encode_cell({ r: row, c: column });
        const source = XLSX.utils.encode_cell({ r: row + 1, c: column });
        if (worksheet[source]) worksheet[destination] = worksheet[source];
        else delete worksheet[destination];
      }
    }
    for (let column = range.s.c; column <= range.e.c; column += 1) delete worksheet[XLSX.utils.encode_cell({ r: range.e.r, c: column })];
    if (worksheet['!rows']) worksheet['!rows'].splice(targetSheetRow, 1);

    const headers = (values[0] ?? []).map((value) => String(value ?? '').trim());
    const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
      .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c]/g, '').replace(/[\/\\_-]/g, '');
    const rowNumberColumn = headers.findIndex((header) => normalizeHeader(header) === normalizeHeader('\u0631\u062f\u06cc\u0641'));
    if (rowNumberColumn >= 0) {
      let dataIndex = 0;
      for (let row = range.s.r + 1; row < range.e.r; row += 1) {
        const hasData = Array.from({ length: range.e.c - range.s.c + 1 }, (_, offset) => {
          const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: range.s.c + offset })];
          return String(cell?.w ?? cell?.v ?? '').trim();
        }).some(Boolean);
        if (!hasData) continue;
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: range.s.c + rowNumberColumn });
        worksheet[cellAddress] = { ...(worksheet[cellAddress] ?? {}), t: 's', v: String(++dataIndex) };
      }
    }
    worksheet['!ref'] = XLSX.utils.encode_range({ ...range, e: { ...range.e, r: range.e.r - 1 } });
    await writeFile(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    return NextResponse.json({ deleted: true, rowIndex: body.rowIndex });
  } catch (error) {
    console.error('Could not delete bill identifier workbook record:', error);
    return NextResponse.json({ error: 'workbook_write_failed' }, { status: 500 });
  }
}
