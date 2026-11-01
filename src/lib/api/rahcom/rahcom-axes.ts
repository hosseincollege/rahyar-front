import { isfahanAxes } from '@/provinces/isfahan';
import { isfahanZones } from '@/provinces/isfahan-zones';

const axisPalette = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#db2777', '#475569', '#0f766e', '#be123c', '#7c3aed'];

export const defaultIsfahanAxes = isfahanAxes.map(({ name }) => name);

type AxisPoint = readonly [latitude: number, longitude: number];
const operationalIsfahanAxes = isfahanAxes;

function distanceToOperationalRouteKm(point: AxisPoint, route: readonly AxisPoint[]) {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    closest = Math.min(closest, distanceToAxisSegmentKm(point, route[index - 1], route[index]));
  }
  return closest;
}

export function rahcomOperationalAxis(latitude?: number, longitude?: number, province?: string) {
  if (province !== 'isfahan' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  const point: AxisPoint = [latitude as number, longitude as number];
  // Avoid assigning systems inside central Isfahan to every route leaving town.
  if (distanceToAxisSegmentKm(point, [32.6546, 51.668], [32.6546, 51.668]) < 6) return '';
  let closestAxis: (typeof operationalIsfahanAxes)[number] | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const axis of operationalIsfahanAxes) {
    const distance = distanceToOperationalRouteKm(point, axis.route);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestAxis = axis;
    }
  }
  return closestDistance <= 18 ? closestAxis?.name ?? '' : '';
}

const zoneNormalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('fa').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\s\-_.\u060c,/]/g, '');

export function rahcomOperationalZone(system: { systemName?: string | null; axis?: string | null; announcedAxis?: string | null; latitude?: number; longitude?: number; province?: string }) {
  if (system.province !== 'isfahan') return '';
  const descriptiveText = [system.systemName, system.axis, system.announcedAxis].filter(Boolean).join(' ');
  const normalizedText = zoneNormalize(descriptiveText);
  const namedZone = isfahanZones.slice(0, -1).find((zone) => zone.aliases.some((alias) => normalizedText.includes(zoneNormalize(alias))));
  if (namedZone) return namedZone.name;
  if (!Number.isFinite(system.latitude) || !Number.isFinite(system.longitude)) return '';
  const point: AxisPoint = [system.latitude as number, system.longitude as number];
  if (distanceToAxisSegmentKm(point, [32.6546, 51.668], [32.6546, 51.668]) < 6) return isfahanZones[10].name;
  let closestZone: (typeof isfahanZones)[number] | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const zone of isfahanZones) {
    const distance = distanceToOperationalRouteKm(point, zone.route);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestZone = zone;
    }
  }
  return closestZone?.name ?? isfahanZones[10].name;
}

function distanceToAxisSegmentKm(point: readonly [number, number], start: readonly [number, number], end: readonly [number, number]) {
  const referenceLatitude = ((point[0] + start[0] + end[0]) / 3) * Math.PI / 180;
  const xScale = 111.32 * Math.cos(referenceLatitude);
  const project = ([latitude, longitude]: readonly [number, number]): [number, number] => [longitude * xScale, latitude * 111.32];
  const p = project(point);
  const a = project(start);
  const b = project(end);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const position = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(p[0] - (a[0] + position * dx), p[1] - (a[1] + position * dy));
}

// Approximate eastbound corridor; used only when a system has no axis name of its own.
function isNearIsfahanQahjavarestanSegziAxis(latitude?: number, longitude?: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const point: [number, number] = [latitude as number, longitude as number];
  const isfahanCenter: [number, number] = [32.65, 51.6833];
  const qahjavarestan: [number, number] = [32.70444, 51.83361];
  const segzi: [number, number] = [32.69056, 52.12556];
  const distanceFromCenter = distanceToAxisSegmentKm(point, isfahanCenter, isfahanCenter);
  return distanceFromCenter >= 3 && Math.min(
    distanceToAxisSegmentKm(point, isfahanCenter, qahjavarestan),
    distanceToAxisSegmentKm(point, qahjavarestan, segzi),
  ) <= 3.5;
}

const normalize = (value: string) => value.toLocaleLowerCase('fa').replace(/[\u200c\s\-–—_،؛,.]/g, '');
const includesAny = (value: string, parts: string[]) => parts.some((part) => value.includes(normalize(part)));

export function canonicalRahcomAxis(axis: string | null | undefined, latitude?: number, longitude?: number, province?: string) {
  const value = (axis ?? '').trim();
  if (province && province !== 'isfahan') return value;
  if (!value) return isNearIsfahanQahjavarestanSegziAxis(latitude, longitude) ? defaultIsfahanAxes[3] : '';
  if ((defaultIsfahanAxes as readonly string[]).includes(value)) return value;
  const text = normalize(value);

  if (includesAny(text, ['قم-کاشان-نائین', 'اصفهان-قم-دلیجان', 'قم-اصفهان', 'اصفهان-قم', 'دلیجان-اصفهان', 'دلیجان اصفهان', 'نطنز', 'کاشان'])) return defaultIsfahanAxes[4];
  if (includesAny(text, ['شهرضا', 'سمیرم', 'آباده', 'صفاشهر', 'میمند'])) return defaultIsfahanAxes[0];
  if (includesAny(text, ['نائین', 'نایین', 'انارک', 'خور', 'طبس', 'یزد', 'نوگنبد', 'اردستان-نائین', 'نائین-اردستان', 'ترانزیت ۷۱'])) return defaultIsfahanAxes[1];
  if (includesAny(text, ['حبیب‌آباد', 'حبیب آباد', 'کمشه', 'اردستان', 'مهاباد'])) return defaultIsfahanAxes[2];
  if (includesAny(text, ['\u0633\u06af\u0632\u06cc', '\u0633\u062c\u0632\u06cc', 'segzi', 'sejzi', 'sagzi'])) return defaultIsfahanAxes[3];
  if (includesAny(text, ['فرودگاه', 'قهجاورستان', 'نجف‌آباد فولادشهر', 'نجف آباد فولادشهر', 'فولادشهر-شهرکرد', 'تیران-سامان-شهرکرد', 'آزادراه شهید کاظمی'])) return defaultIsfahanAxes[3];
  if (includesAny(text, ['نجف‌آباد-الیگودرز', 'نجف آباد-الیگودرز', 'تیران', 'داران-بویین', 'بویین'])) return defaultIsfahanAxes[5];
  if (includesAny(text, ['دامنه-خوانسار-خمین', 'خوانسار', 'گلپایگان', 'خمین'])) return defaultIsfahanAxes[6];
  if (includesAny(text, ['موته', 'میمه'])) return defaultIsfahanAxes[7];
  return value;
}

export function rahcomAxisColor(axis: string, axes: string[]) {
  const zone = isfahanZones.find((item) => item.name === axis);
  if (zone) return zone.color;
  const index = axes.indexOf(axis);
  return axisPalette[(index < 0 ? 0 : index) % axisPalette.length];
}
