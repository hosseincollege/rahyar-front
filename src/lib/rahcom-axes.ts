const axisPalette = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea', '#d97706', '#0891b2', '#db2777',
  '#475569', '#0d9488', '#c026d3', '#65a30d', '#ea580c', '#4f46e5', '#be123c',
];

export const rahcomAxisCounties: Record<string, string[]> = {
  'محور شهرضا، سمیرم و آباده': ['شهرضا', 'سمیرم', 'دهاقان'],
  'محور نائین، خور و بیابانک و یزد': ['نائین', 'خور و بیابانک', 'ورزنه', 'هرند', 'جرقویه'],
  'ترانزیت ۷۱؛ نائین و اردستان': ['اردستان', 'کوهپایه'],
  'محور اصفهان، فرودگاه و قهجاورستان': ['اصفهان', 'برخوار'],
  'محور حبیب‌آباد، کمشچه، اردستان و کاشان': ['برخوار', 'اردستان', 'نطنز', 'کاشان', 'آران و بیدگل'],
  'آزادراه امیرکبیر': ['اصفهان', 'کاشان', 'آران و بیدگل'],
  'جاده قدیم قم، کاشان و نائین': ['کاشان', 'آران و بیدگل', 'اردستان', 'نائین'],
  'محور شاهین‌شهر، نطنز، کاشان و قم': ['برخوار', 'نطنز', 'کاشان', 'آران و بیدگل'],
  'محور شاهین‌شهر، میمه و گلپایگان': ['شاهین شهر و میمه', 'گلپایگان'],
  'محور شاهین‌شهر، نجف‌آباد و فولادشهر': ['برخوار', 'خمینی شهر', 'نجف آباد', 'لنجان'],
  'محور فولادشهر و شهرکرد': ['لنجان', 'مبارکه'],
  'محور نجف‌آباد، تیران، خوانسار و خمین': ['نجف آباد', 'تیران و کرون', 'خوانسار', 'گلپایگان'],
  'محور داران، بویین‌میاندشت و الیگودرز': ['فریدن', 'بوئین و میاندشت', 'فریدون شهر', 'چادگان'],
};

const axisNames = Object.keys(rahcomAxisCounties);
const normalize = (value: string) => value.toLocaleLowerCase('fa').replace(/[\u200c\s\-–—_]/g, '');
const has = (value: string, ...parts: string[]) => parts.some((part) => value.includes(normalize(part)));

export function canonicalRahcomAxis(axis: string | null | undefined, latitude?: number, longitude?: number, province?: string) {
  const value = (axis ?? '').trim();
  if (!value) return '';
  if (province && province !== 'isfahan') return value;
  if (axisNames.includes(value)) return value;
  const text = normalize(value);

  if (has(text, 'شهرضا-سمیرم', 'شهرضا-آباده', 'اصفهان-صفاشهر', 'صفاشهر')) return axisNames[0];
  if (has(text, 'نائین-اردستان', 'اردستان-نائین')) return axisNames[2];
  if (has(text, 'اصفهان-فرودگاه', 'قهجاورستان')) return axisNames[3];
  if (has(text, 'حبیبآباد-اردستان', 'حبیب آباد-اردستان')) return axisNames[4];
  if (has(text, 'قم-اصفهان', 'اصفهان-قم1', 'آزادراه امیرکبیر')) return axisNames[5];
  if (has(text, 'قم-کاشان-نائین')) return axisNames[6];
  if (has(text, 'اصفهان-نایین', 'اصفهان-نائین', 'نایین-انارک-خور', 'خور-طبس', 'یزد-نوگنبد')) return axisNames[1];
  if (has(text, 'اصفهان-قم-دلیجان', 'دلیجان-اصفهان', 'دلیجان اصفهان')) return axisNames[7];
  if (has(text, 'موته-گلپایگان', 'میمه-موته-گلپایگان', 'آزادراه شهید کاظمی')) return axisNames[8];
  if (has(text, 'نجف آباد فولادشهر', 'نجفآبادفولادشهر')) return axisNames[9];
  if (has(text, 'فولادشهر-شهرکرد', 'تیران-سامان-شهرکرد')) return axisNames[10];
  if (has(text, 'دامنه-خوانسار-خمین')) return axisNames[11];
  if (has(text, 'نجف آباد-الیگودرز', 'نجفآباد-الیگودرز')) {
    if (latitude !== undefined && longitude !== undefined && latitude < 32.75 && longitude > 50.7) return axisNames[11];
    return axisNames[12];
  }
  if (has(text, 'اصفهان-قم', 'قم-اصفهان')) return axisNames[5];
  if (has(text, 'کاشان')) return axisNames[6];
  if (has(text, 'سمیرم')) return axisNames[0];
  if (has(text, 'نائین', 'نایین', 'خور', 'انارک', 'اردستان', 'یزد', 'نوگنبد')) return axisNames[1];
  if (has(text, 'گلپایگان', 'خوانسار', 'خمین', 'الیگودرز', 'داران')) return axisNames[11];
  if (has(text, 'شهرکرد')) return axisNames[10];
  return value;
}

export function rahcomAxisCountiesFor(axis: string) {
  return rahcomAxisCounties[axis] ?? [];
}

export function rahcomAxisColor(axis: string, axes: string[]) {
  const index = axes.indexOf(axis);
  return axisPalette[(index < 0 ? 0 : index) % axisPalette.length];
}
