import type { RahcomSystem } from '@/lib/api/rahcom/rahcom-api';

export function normalizeRahcomSystemSearchText(value: string, locale: string) {
  return value.normalize('NFKC')
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 1632))
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u200c\u200f\u200e]/g, '')
    .trim()
    .toLocaleLowerCase(locale);
}

export function searchRahcomSystems(systems: RahcomSystem[], query: string, locale: string) {
  const normalizedQuery = normalizeRahcomSystemSearchText(query, locale);
  if (!normalizedQuery) return [];
  return systems.filter((system) => normalizeRahcomSystemSearchText(`${system.systemName} ${system.systemCode}`, locale).includes(normalizedQuery));
}
