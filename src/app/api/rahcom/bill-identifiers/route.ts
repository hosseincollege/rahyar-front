import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
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

    const filePath = path.join(process.cwd(), 'متفرقه', workbookName);
    const workbookBytes = await readFile(filePath);
    const workbook = XLSX.read(workbookBytes, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!worksheet) return NextResponse.json({ headers: [], rows: [] });

    const values = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: '', blankrows: false });
    const headers = (values[0] ?? []).map((value) => String(value ?? '').trim());
    const rows = values.slice(1)
      .filter((row) => row.some((value) => String(value ?? '').trim()))
      .map((row) => headers.map((_, index) => String(row[index] ?? '').trim()));

    return NextResponse.json({ headers, rows }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'workbook_unavailable' }, { status: 500 });
  }
}
