import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '@/lib/api-environment';
import { isfahanSystemsWorkbook } from '@/provinces/isfahan';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const fields = [
  'id', 'province', 'systemName', 'systemCode', 'stationName', 'aggregationCode', 'axisCode', 'announcedAxis', 'longOutage', 'longOutageReason', 'longOutageDetails', 'incidentType', 'incidentDetails',
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
    const workbookBytes = await readFile(filePath);
    if (request.nextUrl.searchParams.get('source') === 'backup') {
      return new NextResponse(new Uint8Array(workbookBytes), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="isfahan-systems.xlsx"',
          'Cache-Control': 'private, no-store, max-age=0',
        },
      });
    }

    const persistedSystemsByCode = new Map<string, { longOutage: boolean; reason: string | null; details: string | null; stationName: string | null; aggregationCode: string | null; axisCode: string | null; announcedAxis: string | null }>();
    try {
      const persistedResponse = await fetch(`${API_BASE_URL}/rahcom/systems?province=isfahan`, {
        headers: { Authorization: authorization, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (persistedResponse.ok) {
        const payload = await persistedResponse.json() as { data?: Array<{ systemCode?: string; longOutage?: boolean; longOutageReason?: string | null; longOutageDetails?: string | null; stationName?: string | null; aggregationCode?: string | null; axisCode?: string | null; announcedAxis?: string | null }> } | Array<{ systemCode?: string; longOutage?: boolean; longOutageReason?: string | null; longOutageDetails?: string | null; stationName?: string | null; aggregationCode?: string | null; axisCode?: string | null; announcedAxis?: string | null }>;
        const persistedSystems = Array.isArray(payload) ? payload : payload.data ?? [];
        for (const system of persistedSystems) {
          if (system.systemCode) persistedSystemsByCode.set(system.systemCode.normalize('NFKC').trim().toUpperCase(), { longOutage: Boolean(system.longOutage), reason: system.longOutageReason ?? null, details: system.longOutageDetails ?? null, stationName: system.stationName ?? null, aggregationCode: system.aggregationCode ?? null, axisCode: system.axisCode ?? null, announcedAxis: system.announcedAxis ?? null });
        }
      }
    } catch {
      // The workbook remains the fallback source when the API is temporarily unavailable.
    }

    const workbook = XLSX.read(workbookBytes, { type: 'buffer' });
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
      const persistedSystem = persistedSystemsByCode.get(normalizedCode);
      const incidentType = nullableText('incidentType');
      return [{
        id,
        province: 'isfahan',
        systemName,
        systemCode,
        createdAt: nullableText('createdAt') ?? new Date(0).toISOString(),
        updatedAt: nullableText('updatedAt') ?? new Date(0).toISOString(),
        longOutage: persistedSystem?.longOutage ?? workbookLongOutage,
        longOutageReason: persistedSystem?.reason ?? nullableText('longOutageReason'),
        longOutageDetails: persistedSystem ? persistedSystem.details : nullableText('longOutageDetails'),
        stationName: persistedSystem ? persistedSystem.stationName : nullableText('stationName'),
        aggregationCode: persistedSystem ? persistedSystem.aggregationCode : nullableText('aggregationCode'),
        axisCode: persistedSystem?.axisCode ?? nullableText('axisCode'),
        announcedAxis: persistedSystem?.announcedAxis ?? nullableText('announcedAxis'),
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

export async function PUT(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'local_backup_only' }, { status: 501 });
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

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.includes('spreadsheetml.sheet')) {
      return NextResponse.json({ error: 'invalid_workbook' }, { status: 400 });
    }
    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length || bytes.length > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'invalid_workbook' }, { status: 400 });
    }
    const workbook = XLSX.read(bytes, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return NextResponse.json({ error: 'invalid_workbook' }, { status: 400 });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
    const headers = new Set(Object.keys(rows[0] ?? {}));
    if (rows.length > 10000 || !['id', 'province', 'systemName', 'systemCode', 'latitude', 'longitude'].every((header) => headers.has(header))
      || rows.some((row) => String(row.province ?? '') !== 'isfahan' || !String(row.id ?? '').trim() || !String(row.systemName ?? '').trim() || !String(row.systemCode ?? '').trim() || !Number.isFinite(Number(row.latitude)) || !Number.isFinite(Number(row.longitude)))) {
      return NextResponse.json({ error: 'invalid_workbook' }, { status: 400 });
    }
    const filePath = path.join(process.cwd(), 'src', 'provinces', 'isfahan', isfahanSystemsWorkbook);
    const tempPath = `${filePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(tempPath, bytes, { flag: 'wx' });
      await rename(tempPath, filePath);
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);
      throw error;
    }
    return NextResponse.json({ saved: true, fileName: isfahanSystemsWorkbook });
  } catch {
    return NextResponse.json({ error: 'backup_save_failed' }, { status: 500 });
  }
}
