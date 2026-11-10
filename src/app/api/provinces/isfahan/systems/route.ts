import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '@/lib/api-environment';
import { isfahanSystemsWorkbook } from '@/provinces/isfahan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fields = [
  'id', 'province', 'systemName', 'systemCode', 'axisCode', 'announcedAxis', 'longOutage', 'longOutageReason', 'longOutageDetails', 'incidentType', 'incidentDetails',
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

    const persistedSystemsByCode = new Map<string, { longOutage: boolean; reason: string | null; details: string | null; axisCode: string | null; announcedAxis: string | null }>();
    try {
      const persistedResponse = await fetch(`${API_BASE_URL}/rahcom/systems?province=isfahan`, {
        headers: { Authorization: authorization, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (persistedResponse.ok) {
        const payload = await persistedResponse.json() as { data?: Array<{ systemCode?: string; longOutage?: boolean; longOutageReason?: string | null; longOutageDetails?: string | null; axisCode?: string | null; announcedAxis?: string | null }> } | Array<{ systemCode?: string; longOutage?: boolean; longOutageReason?: string | null; longOutageDetails?: string | null; axisCode?: string | null; announcedAxis?: string | null }>;
        const persistedSystems = Array.isArray(payload) ? payload : payload.data ?? [];
        for (const system of persistedSystems) {
          if (system.systemCode) persistedSystemsByCode.set(system.systemCode.normalize('NFKC').trim().toUpperCase(), { longOutage: Boolean(system.longOutage), reason: system.longOutageReason ?? null, details: system.longOutageDetails ?? null, axisCode: system.axisCode ?? null, announcedAxis: system.announcedAxis ?? null });
        }
      }
    } catch {
      // The workbook remains the fallback source when the API is temporarily unavailable.
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
      const workbookLongOutage = row.longOutage === true || ['true', '1', 'yes', 'بله', 'آری'].includes(String(row.longOutage ?? '').trim().toLocaleLowerCase());
      const normalizedCode = systemCode.normalize('NFKC').trim().toUpperCase();
      const incidentType = nullableText('incidentType');
      return [{
        id,
        province: 'isfahan',
        systemName,
        systemCode,
        createdAt: nullableText('createdAt') ?? new Date(0).toISOString(),
        updatedAt: nullableText('updatedAt') ?? new Date(0).toISOString(),
        longOutage: persistedSystemsByCode.get(normalizedCode)?.longOutage ?? workbookLongOutage,
        longOutageReason: persistedSystemsByCode.get(normalizedCode)?.reason ?? nullableText('longOutageReason'),
        longOutageDetails: persistedSystemsByCode.get(normalizedCode)?.details ?? nullableText('longOutageDetails'),
        axisCode: persistedSystemsByCode.get(normalizedCode)?.axisCode ?? nullableText('axisCode'),
        announcedAxis: persistedSystemsByCode.get(normalizedCode)?.announcedAxis ?? nullableText('announcedAxis'),
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
