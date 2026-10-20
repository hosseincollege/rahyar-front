import { apiClient } from '@/lib/api-client';

export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

export type ProjectItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { tickets: number; members?: number };
};

export type SupportProjectItem = ProjectItem & { supportRole: 'MANAGER' | 'MEMBER' | 'VIEWER' | 'ADMIN' };

export type ProjectDraft = Pick<ProjectItem, 'code' | 'name'> &
  Partial<Pick<ProjectItem, 'description' | 'status'>>;

export type ProjectImportRecord = {
  code: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
};

export const projectsApi = {
  getAll: () => apiClient.get<ProjectItem[]>('/projects'),
  getSupportProjects: () => apiClient.get<SupportProjectItem[]>('/projects/support/accessible'),
  create: (project: ProjectDraft) => apiClient.post<ProjectItem>('/projects', project),
  update: (id: string, project: Partial<ProjectDraft>) =>
    apiClient.patch<ProjectItem>(`/projects/${encodeURIComponent(id)}`, project),
  remove: (id: string) => apiClient.delete<ProjectItem>(`/projects/${encodeURIComponent(id)}`),
  importMany: (projects: ProjectImportRecord[]) =>
    apiClient.post<{ imported: number; projects: ProjectItem[] }, { projects: ProjectImportRecord[] }>(
      '/projects/import',
      { projects },
    ),
};
