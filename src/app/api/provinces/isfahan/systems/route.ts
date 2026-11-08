import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '@/lib/api-environment';
import { isfahanSystemsWorkbook } from '@/provinces/isfahan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fields = [
  'id', 'province', 'systemName', 'systemCode', 'axisCode', 'announcedAxis', 'incidentType', 'incidentDetails',
  'latitude', 'longitude', 'details', 'electricityBillId', 'simIp', 'radarIp', 'cameraIp', 'pcIp', 'routerIp',
  'laptopIp', 'createdAt', 'updatedAt',
] as const;

const incidentTypes = new Set(['THEFT', 'DAMAGE', 'THEFT_AND_DAMAGE', 'WIDENING_RELOCATION']);

export async function GET(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const accessResponse = await fetch(`${API_BASE_URL}/rahcom/me`, {
      headers: { Authorization: authorization, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!accessResponse.ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: accessResponse.status === 401 ? 401 : 403 });
    }

    const accessPayload = await accessResponse.json() as { data?: { isAdmin?: boolean; province?: string | null }; isAdmin?: boolean; province?: string | null };
    const access = accessPayload.data ?? accessPayload;
    if (!access.isAdmin && access.province !== 'isfahan') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const filePath = path.join(process.cwd(), 'src', 'provinces', 'isfahan', isfahanSystemsWorkbook);
    const workbook = XLSX.read(await readFile(filePath), { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return NextResponse.json([]);

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
    const systems = rows.flatMap((row) => {
      const id = String(row.id ?? '').trim();
      const systemName = String(row.systemName ?? '').trim();
      const systemCode = String(row.systemCode ?? '').trim();
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!id || !systemName || !systemCode || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

      const nullableText = (field: typeof fields[number]) => {
        const value = row[field];
        return value === null || value === undefined || String(value).trim() === '' ? null : String(value).trim();
      };
      const incidentType = nullableText('incidentType');
      return [{
        id,
        province: 'isfahan',
        systemName,
        systemCode,
        axisCode: nullableText('axisCode'),
        announcedAxis: nullableText('announcedAxis'),
        createdAt: nullableText('createdAt') ?? new Date(0).toISOString(),
        updatedAt: nullableText('updatedAt') ?? new Date(0).toISOString(),
        incidentType: incidentType && incidentTypes.has(incidentType) ? incidentType as 'THEFT' | 'DAMAGE' | 'THEFT_AND_DAMAGE' | 'WIDENING_RELOCATION' : null,
        incidentDetails: nullableText('incidentDetails'),
        latitude,
        longitude,
        details: nullableText('details'),
        electricityBillId: nullableText('electricityBillId'),
        simIp: nullableText('simIp'),
        radarIp: nullableText('radarIp'),
        cameraIp: nullableText('cameraIp'),
        pcIp: nullableText('pcIp'),
        routerIp: nullableText('routerIp'),
        laptopIp: nullableText('laptopIp'),
      }];
    });

    return NextResponse.json(systems, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'workbook_unavailable' }, { status: 500 });
  }
}
