import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { SERVER_API_BASE_URL } from '@/lib/api-environment';
import { esfInvoicesWorkbook } from '@/province-backup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const response = await fetch(`${SERVER_API_BASE_URL}/rahcom/me`, { headers: { Authorization: authorization, Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const payload = await response.json() as { data?: { isAdmin?: boolean; province?: string | null; provinces?: string[] }; isAdmin?: boolean; province?: string | null; provinces?: string[] };
    const access = payload.data ?? payload;
    if (!access.provinces?.includes('isfahan') || (!access.isAdmin && access.province !== 'isfahan')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    const file = await readFile(path.join(process.cwd(), 'src', 'province-backup', esfInvoicesWorkbook));
    return new NextResponse(new Uint8Array(file), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${esfInvoicesWorkbook}"`, 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'backup_unavailable' }, { status: 404 });
  }
}
