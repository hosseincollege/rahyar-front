import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '@/lib/api-environment';
import { esfSitesWorkbook } from '@/province-backup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const expectedHeaders = ['نام سایت', 'کد سایت اولیه', 'کد سایت نهایی', 'استان', 'مالکیت سایت'];
const workbookPath = () => path.join(process.cwd(), 'src', 'province-backup', esfSitesWorkbook);

async function authorized(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const response = await fetch(`${API_BASE_URL}/rahcom/me`, {
    headers: { Authorization: authorization, Accept: 'application/json' },
    cache: 'no-store',
  }).catch(() => null);
  if (!response?.ok) return false;
  const payload = await response.json() as { data?: { isAdmin?: boolean; province?: string | null }; isAdmin?: boolean; province?: string | null };
  const access = payload.data ?? payload;
  return Boolean(access.isAdmin || access.province === 'isfahan');
}

function validWorkbook(bytes: Buffer) {
  const workbook = XLSX.read(bytes, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return false;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
  const headers = (rows[0] ?? []).map((value) => String(value).trim());
  return (headers.length === expectedHeaders.length || (headers.length === expectedHeaders.length + 1 && headers[expectedHeaders.length] === 'نوع سایت'))
    && expectedHeaders.every((header, index) => headers[index] === header)
    && rows.length <= 10002
    && rows.slice(1).every((row) => row.length <= headers.length && String(row[3] ?? '').trim() === 'اصفهان');
}

export async function GET(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (request.nextUrl.searchParams.get('source') !== 'backup') return NextResponse.json({ error: 'invalid_source' }, { status: 400 });
  try {
    const bytes = await readFile(workbookPath());
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${esfSitesWorkbook}"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    });
  } catch {
    return NextResponse.json({ error: 'backup_unavailable' }, { status: 404 });
  }
}

export async function PUT(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (process.env.NODE_ENV !== 'development') return NextResponse.json({ error: 'local_backup_only' }, { status: 501 });
  if (!(request.headers.get('content-type') ?? '').includes('spreadsheetml.sheet')) {
    return NextResponse.json({ error: 'invalid_workbook' }, { status: 400 });
  }
  try {
    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 10 * 1024 * 1024 || !validWorkbook(bytes)) {
      return NextResponse.json({ error: 'invalid_workbook' }, { status: 400 });
    }
    const filePath = workbookPath();
    const tempPath = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(tempPath, bytes, { flag: 'wx' });
      await rename(tempPath, filePath);
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ saved: true, fileName: esfSitesWorkbook });
  } catch {
    return NextResponse.json({ error: 'backup_save_failed' }, { status: 500 });
  }
}
