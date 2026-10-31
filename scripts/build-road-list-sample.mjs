import * as XLSX from 'xlsx';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'docs/templates/لیست-راهداری-نمونه.xlsx');

const headers = ['سامانه', 'استان', 'شهر', 'پیمانکار', 'موقعیت', 'شناسه', 'فعالیت'];
const contract = 'جهاد ارتباطات رهکام ایرانیان (قراردادی ستادی)';
const rows = [
  ['ثبت تخلفات عبور و مرور', 'اصفهان', 'مورچه‌خورت - شاهین‌شهر', contract, 'مجتمع چهار ستون به سمت شاهین‌شهر', '25215113', 'غیرفعال'],
  ['ثبت تخلفات عبور و مرور', 'اصفهان', 'خوراسگان', contract, 'جاده ملک به سمت جوبان', '25214630', 'غیرفعال'],
  ['ثبت تخلفات عبور و مرور', 'اصفهان', 'انارک - نایین', contract, 'خروجی انارک به سمت نایین', '25214629', 'غیرفعال'],
  ['ثبت تخلفات عبور و مرور', 'اصفهان', 'شهرک آبی - شاهین‌شهر (آزادراه شهید کاظمی)', contract, 'باند BTS به سمت شهرک آبی (آزادراه شهید کاظمی)', '25214517', 'غیرفعال'],
  ['ثبت تخلفات عبور و مرور', 'اصفهان', 'کوهپایه - سجزی', contract, 'خروجی کوهپایه به سمت سجزی', '25213179', 'غیرفعال'],
  ['ثبت تخلفات عبور و مرور', 'اصفهان', 'فرودگاه - اصفهان (آزادراه فرودگاه)', contract, 'تقاطع اردستان به سمت اصفهان', '25213175', 'غیرفعال'],
  ['ثبت تخلفات عبور و مرور', 'اصفهان', 'اصفهان - سجزی', contract, 'ایستگاه تقلیل گاز سجزی به سمت کوهپایه', '25213128', 'غیرفعال'],
  ['ثبت تخلفات عبور و مرور', 'اصفهان', 'شاهین‌شهر - مورچه‌خورت (آزادراه شاهین‌شهر - آزادگان)', contract, 'باغ آزادگان به سمت مورچه‌خورت', '25213122', 'غیرفعال'],
];

const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
sheet['!cols'] = [
  { wch: 28 }, { wch: 16 }, { wch: 38 }, { wch: 44 }, { wch: 52 }, { wch: 18 }, { wch: 16 },
];
sheet['!autofilter'] = { ref: `A1:G${rows.length + 1}` };
sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, 'فهرست راهداری');
await mkdir(dirname(output), { recursive: true });
await writeFile(output, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }));
const verified = XLSX.read(await readFile(output), { type: 'buffer' });
const extracted = XLSX.utils.sheet_to_json(verified.Sheets['فهرست راهداری'], { header: 1, defval: '', raw: false });
if (JSON.stringify(extracted) !== JSON.stringify([headers, ...rows])) {
  throw new Error('Workbook verification failed: the extracted table does not match the transcribed source data.');
}
console.log(`${output} (${rows.length} rows, ${headers.length} columns)`);
