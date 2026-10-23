const axisPalette = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#db2777', '#475569'];

export const defaultIsfahanAxes = [
  'محور شهرضا و سمیرم',
  'محور نائین و خور و بیابانک',
  'محور اردستان',
  'محور اصفهان و مرکزی',
  'محور نطنز و کاشان',
  'محور تیران و فریدون‌شهر',
  'محور گلپایگان و داران',
  'محور میمه',
] as const;

const normalize = (value: string) => value.toLocaleLowerCase('fa').replace(/[\u200c\s\-–—_،؛,.]/g, '');
const includesAny = (value: string, parts: string[]) => parts.some((part) => value.includes(normalize(part)));

export function canonicalRahcomAxis(axis: string | null | undefined, _latitude?: number, _longitude?: number, province?: string) {
  const value = (axis ?? '').trim();
  if (!value) return '';
  if (province && province !== 'isfahan') return value;
  if ((defaultIsfahanAxes as readonly string[]).includes(value)) return value;
  const text = normalize(value);

  if (includesAny(text, ['قم-کاشان-نائین', 'اصفهان-قم-دلیجان', 'قم-اصفهان', 'اصفهان-قم', 'دلیجان-اصفهان', 'دلیجان اصفهان', 'نطنز', 'کاشان'])) return defaultIsfahanAxes[4];
  if (includesAny(text, ['شهرضا', 'سمیرم', 'آباده', 'صفاشهر', 'میمند'])) return defaultIsfahanAxes[0];
  if (includesAny(text, ['نائین', 'نایین', 'انارک', 'خور', 'طبس', 'یزد', 'نوگنبد', 'اردستان-نائین', 'نائین-اردستان', 'ترانزیت ۷۱'])) return defaultIsfahanAxes[1];
  if (includesAny(text, ['حبیب‌آباد', 'حبیب آباد', 'کمشه', 'اردستان', 'مهاباد'])) return defaultIsfahanAxes[2];
  if (includesAny(text, ['فرودگاه', 'قهجاورستان', 'نجف‌آباد فولادشهر', 'نجف آباد فولادشهر', 'فولادشهر-شهرکرد', 'تیران-سامان-شهرکرد', 'آزادراه شهید کاظمی'])) return defaultIsfahanAxes[3];
  if (includesAny(text, ['نجف‌آباد-الیگودرز', 'نجف آباد-الیگودرز', 'تیران', 'داران-بویین', 'بویین'])) return defaultIsfahanAxes[5];
  if (includesAny(text, ['دامنه-خوانسار-خمین', 'خوانسار', 'گلپایگان', 'خمین'])) return defaultIsfahanAxes[6];
  if (includesAny(text, ['موته', 'میمه'])) return defaultIsfahanAxes[7];
  return value;
}

export function rahcomAxisColor(axis: string, axes: string[]) {
  const index = axes.indexOf(axis);
  return axisPalette[(index < 0 ? 0 : index) % axisPalette.length];
}
