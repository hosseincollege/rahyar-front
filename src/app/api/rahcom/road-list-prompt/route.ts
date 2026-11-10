import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { API_BASE_URL } from '@/lib/api-environment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const promptFilePath = () => path.join(process.cwd(), 'rahcom-road-list-prompt.txt');

async function checkAccess(request: NextRequest, manage: boolean) {
  const authorization = request.headers.get('authorization');
  const organizationId = request.nextUrl.searchParams.get('organizationId')?.trim();
  if (!authorization?.startsWith('Bearer ') || !organizationId) return { response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };

  try {
    const accessResponse = await fetch(`${API_BASE_URL}/settings/organization/${encodeURIComponent(organizationId)}/access`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!accessResponse.ok) return { response: NextResponse.json({ error: 'forbidden' }, { status: accessResponse.status === 401 ? 401 : 403 }) };
    const payload = await accessResponse.json() as { data?: { canViewRahcom?: boolean; canManageRahcom?: boolean }; canViewRahcom?: boolean; canManageRahcom?: boolean };
    const access = payload.data ?? payload;
    if (manage ? !access.canManageRahcom : !access.canViewRahcom && !access.canManageRahcom) {
      return { response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
    }
    return { response: null };
  } catch {
    return { response: NextResponse.json({ error: 'access_check_failed' }, { status: 502 }) };
  }
}

export async function GET(request: NextRequest) {
  const access = await checkAccess(request, false);
  if (access.response) return access.response;

  try {
    const prompt = await readFile(promptFilePath(), 'utf8');
    return NextResponse.json({ prompt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ prompt: null }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: 'prompt_read_failed' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const access = await checkAccess(request, true);
  if (access.response) return access.response;

  try {
    const body = await request.json() as { prompt?: unknown };
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 30_000) {
      return NextResponse.json({ error: 'invalid_prompt' }, { status: 400 });
    }
    await writeFile(promptFilePath(), body.prompt, 'utf8');
    return NextResponse.json({ saved: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'prompt_write_failed' }, { status: 500 });
  }
}
