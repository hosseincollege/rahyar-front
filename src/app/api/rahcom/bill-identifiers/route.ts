import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { API_BASE_URL } from '@/lib/api-environment';

export const dynamic = 'force-dynamic';

type BillList = { headers: string[]; rows: string[][] };
const province = 'isfahan';
const normalizeHeader = (value: string) => value.trim().normalize('NFKC').toLocaleLowerCase('fa')
  .replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\s\u200c]/g, '').replace(/[\/\\_-]/g, '');
const normalizeDigits = (value: string) => value.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
  const code = digit.charCodeAt(0);
  return String(code >= 0x06f0 && code <= 0x06f9 ? code - 0x06f0 : code - 0x0660);
});
const findColumn = (headers: string[], aliases: string[]) => headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
const billIdAliases = ['\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636', '\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636\u0628\u0631\u0642'];
const systemCodeAliases = ['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', '\u06a9\u062f\u0633\u06cc\u0633\u062a\u0645'];
const rowNumberAlias = normalizeHeader('\u0631\u062f\u06cc\u0641');
const registeredDateAlias = normalizeHeader('\u062a\u0627\u0631\u06cc\u062e \u062b\u0628\u062a');
const statusAlias = normalizeHeader('\u0648\u0636\u0639\u06cc\u062a \u0628\u0631\u0631\u0633\u06cc');

function jsonError(status: number, error: string) { return NextResponse.json({ error }, { status }); }
function authHeader(request: NextRequest) { return request.headers.get('authorization') ?? ''; }
async function readList(authorization: string): Promise<{ response: Response; data: BillList }> {
  const response = await fetch(`${API_BASE_URL}/rahcom/bill-identifiers?province=${province}`, {
    headers: { Authorization: authorization, Accept: 'application/json' }, cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as Partial<BillList>;
  return { response, data: { headers: Array.isArray(payload.headers) ? payload.headers : [], rows: Array.isArray(payload.rows) ? payload.rows : [] } };
}
async function saveList(authorization: string, data: BillList) {
  return fetch(`${API_BASE_URL}/rahcom/bill-identifiers`, {
    method: 'PUT', headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ province, headers: data.headers, rows: data.rows }),
  });
}
function unauthorized(request: NextRequest) { return !authHeader(request).startsWith('Bearer '); }

export async function GET(request: NextRequest) {
  if (unauthorized(request)) return jsonError(401, 'unauthorized');
  if (request.nextUrl.searchParams.get('source') === 'backup') {
    const { response } = await readList(authHeader(request));
    if (!response.ok) return jsonError(response.status, 'database_unavailable');
    try {
      const filePath = path.join(process.cwd(), 'src', 'provinces', 'isfahan', 'bill-identifiers.xlsx');
      const workbookBytes = await readFile(filePath);
      return new NextResponse(new Uint8Array(workbookBytes), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="isfahan-bill-identifiers.xlsx"',
          'Cache-Control': 'private, no-store, max-age=0',
        },
      });
    } catch {
      return jsonError(404, 'backup_unavailable');
    }
  }
  const { response, data } = await readList(authHeader(request));
  return response.ok
    ? NextResponse.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store, max-age=0' } })
    : jsonError(response.status, 'database_unavailable');
}

export async function PUT(request: NextRequest) {
  if (unauthorized(request)) return jsonError(401, 'unauthorized');
  const body = await request.json().catch(() => null) as { headers?: unknown; rows?: unknown; rowIndex?: unknown; systemCodes?: unknown } | null;
  if (!body) return jsonError(400, 'invalid_request');
  if (Array.isArray(body.headers) && Array.isArray(body.rows)) {
    const headers = body.headers;
    const rows = body.rows;
    if (headers.length < 2 || headers.length > 100 || headers.some((v) => typeof v !== 'string') || rows.length > 20000 || rows.some((r) => !Array.isArray(r) || r.some((v) => typeof v !== 'string'))) return jsonError(400, 'invalid_workbook');
    const response = await saveList(authHeader(request), { headers: headers as string[], rows: rows as string[][] });
    return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
  }
  if (!Number.isInteger(body.rowIndex) || (body.rowIndex as number) < 0 || !Array.isArray(body.systemCodes) || body.systemCodes.length > 50 || body.systemCodes.some((v) => typeof v !== 'string')) return jsonError(400, 'invalid_assignment');
  const { response, data } = await readList(authHeader(request));
  if (!response.ok) return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
  const rowIndex = body.rowIndex as number;
  const codeColumn = findColumn(data.headers, systemCodeAliases);
  if (!data.rows[rowIndex]) return jsonError(404, 'record_not_found');
  if (codeColumn < 0) return jsonError(400, 'system_code_column_missing');
  const systemCodes = [...new Set((body.systemCodes as string[]).map((code) => code.trim()).filter(Boolean))];
  const rows = data.rows.map((row, index) => index === rowIndex ? row.map((value, column) => column === codeColumn ? systemCodes.join(';') : value) : row);
  const saved = await saveList(authHeader(request), { ...data, rows });
  return NextResponse.json(saved.ok ? { saved: true, rowIndex, systemCodes } : await saved.json().catch(() => ({})), { status: saved.status });
}

export async function POST(request: NextRequest) {
  if (unauthorized(request)) return jsonError(401, 'unauthorized');
  const body = await request.json().catch(() => null) as { billIdentifier?: unknown; systemCodes?: unknown; fields?: unknown } | null;
  if (!body || typeof body.billIdentifier !== 'string' || !body.billIdentifier.trim()) return jsonError(400, 'invalid_bill_identifier');
  if (body.systemCodes !== undefined && (!Array.isArray(body.systemCodes) || body.systemCodes.length > 50 || body.systemCodes.some((v) => typeof v !== 'string'))) return jsonError(400, 'invalid_assignment');
  if (body.fields !== undefined && (!body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields) || Object.values(body.fields).some((v) => typeof v !== 'string'))) return jsonError(400, 'invalid_fields');
  const { response, data } = await readList(authHeader(request));
  if (!response.ok) return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
  const billColumn = findColumn(data.headers, billIdAliases);
  const codeColumn = findColumn(data.headers, systemCodeAliases);
  const rowColumn = data.headers.findIndex((h) => normalizeHeader(h) === rowNumberAlias);
  const statusColumn = data.headers.findIndex((h) => normalizeHeader(h) === statusAlias);
  let dateColumn = data.headers.findIndex((h) => normalizeHeader(h) === registeredDateAlias);
  if (billColumn < 0) return jsonError(400, 'bill_identifier_column_missing');
  if (dateColumn < 0) { dateColumn = data.headers.length; data.headers.push('\u062a\u0627\u0631\u06cc\u062e \u062b\u0628\u062a'); data.rows = data.rows.map((row) => [...row, '']); }
  const billId = body.billIdentifier.trim();
  if (data.rows.some((row) => normalizeDigits(row[billColumn] ?? '').replace(/\s/g, '') === normalizeDigits(billId).replace(/\s/g, ''))) return jsonError(409, 'duplicate_bill_identifier');
  const fields = (body.fields ?? {}) as Record<string, string>;
  const nextRow = Array(data.headers.length).fill('') as string[];
  nextRow[billColumn] = billId;
  const systemCodes = [...new Set(((body.systemCodes ?? []) as string[]).map((code) => code.trim()).filter(Boolean))];
  if (codeColumn >= 0) nextRow[codeColumn] = systemCodes.join(';');
  else if (systemCodes.length) return jsonError(400, 'system_code_column_missing');
  for (const [header, value] of Object.entries(fields)) {
    const column = data.headers.findIndex((candidate) => normalizeHeader(candidate) === normalizeHeader(header));
    if (column < 0 || [billColumn, codeColumn, rowColumn, dateColumn].includes(column)) return jsonError(400, 'invalid_fields');
    nextRow[column] = value.trim();
  }
  if (rowColumn >= 0) nextRow[rowColumn] = String(data.rows.length + 1);
  if (statusColumn >= 0 && !nextRow[statusColumn]) nextRow[statusColumn] = '\u062f\u0631 \u0627\u0646\u062a\u0638\u0627\u0631 \u0628\u0631\u0631\u0633\u06cc';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  nextRow[dateColumn] = `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`;
  const saved = await saveList(authHeader(request), { ...data, rows: [...data.rows, nextRow] });
  return NextResponse.json(saved.ok ? { saved: true, row: nextRow, systemCodes } : await saved.json().catch(() => ({})), { status: saved.ok ? 201 : saved.status });
}

export async function PATCH(request: NextRequest) {
  if (unauthorized(request)) return jsonError(401, 'unauthorized');
  const body = await request.json().catch(() => null) as { rowIndex?: unknown; fields?: unknown; systemCodes?: unknown } | null;
  if (!body || !Number.isInteger(body.rowIndex) || (body.rowIndex as number) < 0 || !body.fields || typeof body.fields !== 'object' || Array.isArray(body.fields) || Object.values(body.fields).some((v) => typeof v !== 'string') || (body.systemCodes !== undefined && (!Array.isArray(body.systemCodes) || body.systemCodes.length > 50 || body.systemCodes.some((v) => typeof v !== 'string')))) return jsonError(400, 'invalid_record_update');
  const { response, data } = await readList(authHeader(request));
  if (!response.ok) return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
  const rowIndex = body.rowIndex as number;
  const target = data.rows[rowIndex];
  if (!target) return jsonError(404, 'record_not_found');
  const rowColumn = data.headers.findIndex((h) => normalizeHeader(h) === rowNumberAlias);
  const dateColumn = data.headers.findIndex((h) => normalizeHeader(h) === registeredDateAlias);
  const codeColumn = findColumn(data.headers, systemCodeAliases);
  const billColumn = findColumn(data.headers, billIdAliases);
  const updates = new Map<number, string>();
  for (const [header, value] of Object.entries(body.fields as Record<string, string>)) {
    const column = data.headers.findIndex((candidate) => normalizeHeader(candidate) === normalizeHeader(header));
    if (column < 0 || [rowColumn, dateColumn, codeColumn].includes(column)) return jsonError(400, 'invalid_record_field');
    updates.set(column, value.trim());
  }
  const nextId = updates.get(billColumn);
  if (nextId !== undefined && data.rows.some((row, index) => index !== rowIndex && normalizeDigits(row[billColumn] ?? '').replace(/\s/g, '') === normalizeDigits(nextId).replace(/\s/g, ''))) return jsonError(409, 'duplicate_bill_identifier');
  const systemCodes = body.systemCodes === undefined ? null : [...new Set((body.systemCodes as string[]).map((code) => code.trim()).filter(Boolean))];
  if (systemCodes?.length && codeColumn < 0) return jsonError(400, 'system_code_column_missing');
  const updatedRow = target.map((value, column) => updates.get(column) ?? (column === codeColumn && systemCodes ? systemCodes.join(';') : value));
  const rows = data.rows.map((row, index) => index === rowIndex ? updatedRow : row);
  const saved = await saveList(authHeader(request), { ...data, rows });
  return NextResponse.json(saved.ok ? { saved: true, row: updatedRow } : await saved.json().catch(() => ({})), { status: saved.status });
}

export async function DELETE(request: NextRequest) {
  if (unauthorized(request)) return jsonError(401, 'unauthorized');
  const body = await request.json().catch(() => null) as { rowIndex?: unknown } | null;
  if (!body || !Number.isInteger(body.rowIndex) || (body.rowIndex as number) < 0) return jsonError(400, 'invalid_row');
  const { response, data } = await readList(authHeader(request));
  if (!response.ok) return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
  const rowIndex = body.rowIndex as number;
  if (!data.rows[rowIndex]) return jsonError(404, 'record_not_found');
  const rowColumn = data.headers.findIndex((h) => normalizeHeader(h) === rowNumberAlias);
  const rows = data.rows.filter((_, index) => index !== rowIndex).map((row, index) => rowColumn < 0 ? row : row.map((value, column) => column === rowColumn ? String(index + 1) : value));
  const saved = await saveList(authHeader(request), { ...data, rows });
  return NextResponse.json(saved.ok ? { deleted: true, rowIndex } : await saved.json().catch(() => ({})), { status: saved.status });
}
