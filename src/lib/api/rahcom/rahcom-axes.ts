import { isfahanZones } from '@/provinces/isfahan';

const axisPalette = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#db2777', '#475569', '#0f766e', '#be123c', '#7c3aed'];

type AxisPoint = readonly [latitude: number, longitude: number];

function distanceToRouteKm(point: AxisPoint, route: readonly AxisPoint[]) {
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < route.length; index += 1) {
    closest = Math.min(closest, distanceToAxisSegmentKm(point, route[index - 1], route[index]));
  }
  return closest;
}
const zoneNormalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase('fa').replace(/[\u064a\u0649]/g, '\u06cc').replace(/\u0643/g, '\u06a9').replace(/[\u200c\s\-_.\u060c,/]/g, '');

export function rahcomZoneForSystem(system: { systemName?: string | null; announcedAxis?: string | null; latitude?: number; longitude?: number; province?: string }) {
  if (system.province !== 'isfahan') return '';
  const descriptiveText = [system.systemName, system.announcedAxis].filter(Boolean).join(' ');
  const normalizedText = zoneNormalize(descriptiveText);
  const namedZone = isfahanZones.slice(0, -1).find((zone) => zone.aliases.some((alias) => normalizedText.includes(zoneNormalize(alias))));
  if (namedZone) return namedZone.name;
  if (!Number.isFinite(system.latitude) || !Number.isFinite(system.longitude)) return '';
  const point: AxisPoint = [system.latitude as number, system.longitude as number];
  if (distanceToAxisSegmentKm(point, [32.6546, 51.668], [32.6546, 51.668]) < 6) return isfahanZones[10].name;
  let closestZone: (typeof isfahanZones)[number] | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const zone of isfahanZones) {
    const distance = distanceToRouteKm(point, zone.route);
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

export function rahcomAxisColor(axis: string, axes: string[]) {
  const zone = isfahanZones.find((item) => item.name === axis);
  if (zone) return zone.color;
  const index = axes.indexOf(axis);
  return axisPalette[(index < 0 ? 0 : index) % axisPalette.length];
}
