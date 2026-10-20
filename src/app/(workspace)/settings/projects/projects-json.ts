import type { ProjectImportRecord, ProjectItem, ProjectStatus } from '@/lib/api/shared/projects-api';

export type ProjectsImportData = {
  formatVersion: 1;
  projects: ProjectImportRecord[];
};

export const PROJECTS_IMPORT_SAMPLE: ProjectsImportData = {
  formatVersion: 1,
  projects: [
    {
      code: 'DEMO-OPS-001',
      name: 'سامان‌دهی فرایندهای سازمانی',
      description: 'نمونه‌ای برای بررسی ایجاد و پیگیری یک پروژه عملیاتی.',
      status: 'ACTIVE',
    },
    {
      code: 'DEMO-IT-002',
      name: 'به‌روزرسانی زیرساخت فناوری',
      description: 'نمونه‌ای برای آزمایش وضعیت متوقف و توضیحات پروژه.',
      status: 'ON_HOLD',
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProjectsImportData(value: unknown): ProjectsImportData {
  if (!isRecord(value) || value.formatVersion !== 1 || !Array.isArray(value.projects)) {
    throw new Error('invalid');
  }
  if (value.projects.length === 0) throw new Error('empty');
  if (value.projects.length > 500) throw new Error('tooMany');

  const seenCodes = new Set<string>();
  const projects = value.projects.map((entry): ProjectImportRecord => {
    if (!isRecord(entry)) throw new Error('invalid');
    const code = typeof entry.code === 'string' ? entry.code.trim().toUpperCase() : '';
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!code || !name || code.length > 80 || name.length > 180) throw new Error('invalid');
    if (seenCodes.has(code)) throw new Error('duplicates');
    seenCodes.add(code);

    const description = entry.description === undefined || entry.description === null
      ? undefined
      : typeof entry.description === 'string' && entry.description.length <= 2000
        ? entry.description.trim() || undefined
        : (() => { throw new Error('invalid'); })();
    const validStatuses: ProjectStatus[] = ['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'];
    if (entry.status !== undefined && !validStatuses.includes(entry.status as ProjectStatus)) {
      throw new Error('invalid');
    }
    return {
      code,
      name,
      ...(description ? { description } : {}),
      ...(entry.status ? { status: entry.status as ProjectStatus } : {}),
    };
  });

  return { formatVersion: 1, projects };
}

export function projectsToExportData(projects: ProjectItem[]): ProjectsImportData {
  return {
    formatVersion: 1,
    projects: projects.map(({ code, name, description, status }) => ({
      code,
      name,
      ...(description ? { description } : {}),
      status,
    })),
  };
}
