import { apiClient } from '@/lib/api-client';

export type SystemStatus = {
  checkedAt: string;
  api: { status: 'online' };
  database: { status: 'online' | 'offline'; latencyMs: number | null };
};

export type ActivityItem = {
  id: string; action: string; entity: string; entityId: string | null;
  metadata: Record<string, unknown> | null; createdAt: string;
  user: { id: string; name: string } | null;
};

export const systemApi = {
  getStatus: () => apiClient.get<SystemStatus>('/system/status'),
  getActivity: (limit = 5) => apiClient.get<ActivityItem[]>(`/system/activity?limit=${limit}`),
};
