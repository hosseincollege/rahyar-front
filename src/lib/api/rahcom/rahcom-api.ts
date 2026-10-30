import { apiClient } from '@/lib/api-client';

function notifySystemsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rahyar:systems-changed'));
}

async function afterSystemsMutation<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  notifySystemsChanged();
  return result;
}
async function afterAxesMutation<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  notifySystemsChanged();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rahyar:axes-changed'));
  return result;
}
async function afterSolarSnapshotMutation<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rahyar:solar-snapshots-changed'));
  return result;
}
async function afterTrafficSnapshotMutation<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rahyar:traffic-snapshot-changed'));
  return result;
}
async function afterActivityMutation<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rahyar:activities-changed'));
  return result;
}

export type RahcomSystem = {
  id: string; province: string; systemName: string; systemCode: string; axis: string | null; axisCode: string | null;
  incidentType: 'THEFT' | 'DAMAGE' | 'THEFT_AND_DAMAGE' | 'WIDENING_RELOCATION' | null; incidentDetails: string | null;
  latitude: number; longitude: number; details: string | null;
  electricityBillId: string | null; simIp: string | null; radarIp: string | null;
  cameraIp: string | null; pcIp: string | null; routerIp: string | null; laptopIp: string | null;
};
export type RahcomActivity = {
  id: string; createdById: string; activityDate: string; activityType: 'EMAIL_SENT' | 'SYSTEM_VISIT' | 'OTHER';
  quantity: number; description: string | null; createdAt: string; systemId: string | null;
  systemNameSnapshot: string | null; systemCodeSnapshot: string | null; provinceSnapshot: string | null;
  accompaniedBy: string | null; handedOverTo: string | null; performedBy: string | null;
  system?: Pick<RahcomSystem, 'id' | 'systemName' | 'systemCode' | 'province'> | null;
};
export type RahcomAxis = { id: string; province: string; name: string };
export type RahcomSolarSnapshot = {
  id: string; province: string | null; capturedAt: string; createdAt: string; downText: string;
  unreachableText: string; equipmentColumns: string[];
};
export type RahcomSolarSpecialSystem = { id: string; province: string; systemCode: string; category: 'THEFT' | 'DAMAGE' | 'THEFT_AND_DAMAGE' | 'WIDENING_RELOCATION' };
export type RahcomTrafficSnapshot = {
  id: string; fileName: string; sheetName: string; headers: string[];
  rows: string[][]; rowCount: number; createdAt: string;
};
export type RahcomTrafficSystemHistory = Pick<RahcomTrafficSnapshot, 'id' | 'fileName' | 'sheetName' | 'rowCount' | 'createdAt' | 'headers'> & { row: string[] };
export type RahcomImportedTicket = {
  id: string; ticketCode: string; systemCode: string; province: string | null; summary: string; customer: string; equipment: string;
  type: string; status: string; priority: string; supportTeam: string; createdOn: string; sourceFileName: string; importedAt: string;
};
export type RahcomMemberProvince = { id: string; userId: string; username: string; name: string; province: string | null };
export type RahcomAccess = { memberId: string | null; province: string | null; selectedProvince: string | null; isAdmin: boolean; canManageAssignments: boolean; canRecordActivities: boolean };
/** Coordinates copied for search or navigation: latitude first, ASCII comma, longitude. */
export function formatRahcomCoordinates(latitude: number, longitude: number) {
  return `${latitude}, ${longitude}`;
}
export const iranProvinces = [
  ['isfahan', '\u0627\u0635\u0641\u0647\u0627\u0646'], ['tehran', '\u062a\u0647\u0631\u0627\u0646'], ['east-azerbaijan', '\u0622\u0630\u0631\u0628\u0627\u06cc\u062c\u0627\u0646 \u0634\u0631\u0642\u06cc'], ['west-azerbaijan', '\u0622\u0630\u0631\u0628\u0627\u06cc\u062c\u0627\u0646 \u063a\u0631\u0628\u06cc'],
  ['ardabil', '\u0627\u0631\u062f\u0628\u06cc\u0644'], ['alborz', '\u0627\u0644\u0628\u0631\u0632'], ['ilam', '\u0627\u06cc\u0644\u0627\u0645'], ['bushehr', '\u0628\u0648\u0634\u0647\u0631'], ['charmahal-bakhtiari', '\u0686\u0647\u0627\u0631\u0645\u062d\u0627\u0644 \u0648 \u0628\u062e\u062a\u06cc\u0627\u0631\u06cc'],
  ['south-khorasan', '\u062e\u0631\u0627\u0633\u0627\u0646 \u062c\u0646\u0648\u0628\u06cc'], ['razavi-khorasan', '\u062e\u0631\u0627\u0633\u0627\u0646 \u0631\u0636\u0648\u06cc'], ['north-khorasan', '\u062e\u0631\u0627\u0633\u0627\u0646 \u0634\u0645\u0627\u0644\u06cc'], ['khuzestan', '\u062e\u0648\u0632\u0633\u062a\u0627\u0646'],
  ['zanjan', '\u0632\u0646\u062c\u0627\u0646'], ['semnan', '\u0633\u0645\u0646\u0627\u0646'], ['sistan-baluchestan', '\u0633\u06cc\u0633\u062a\u0627\u0646 \u0648 \u0628\u0644\u0648\u0686\u0633\u062a\u0627\u0646'], ['fars', '\u0641\u0627\u0631\u0633'], ['qazvin', '\u0642\u0632\u0648\u06cc\u0646'],
  ['qom', '\u0642\u0645'], ['kurdistan', '\u06a9\u0631\u062f\u0633\u062a\u0627\u0646'], ['kerman', '\u06a9\u0631\u0645\u0627\u0646'], ['kermanshah', '\u06a9\u0631\u0645\u0627\u0646\u0634\u0627\u0647'], ['kohgiluyeh-boyerahmad', '\u06a9\u0647\u06af\u06cc\u0644\u0648\u06cc\u0647 \u0648 \u0628\u0648\u06cc\u0631\u0627\u062d\u0645\u062f'],
  ['golestan', '\u06af\u0644\u0633\u062a\u0627\u0646'], ['gilan', '\u06af\u06cc\u0644\u0627\u0646'], ['lorestan', '\u0644\u0631\u0633\u062a\u0627\u0646'], ['mazandaran', '\u0645\u0627\u0632\u0646\u062f\u0631\u0627\u0646'], ['markazi', '\u0645\u0631\u06a9\u0632\u06cc'],
  ['hormozgan', '\u0647\u0631\u0645\u0632\u06af\u0627\u0646'], ['hamadan', '\u0647\u0645\u062f\u0627\u0646'], ['yazd', '\u06cc\u0632\u062f'],
] as const;
export const rahcomApi = {
  access: () => apiClient.get<RahcomAccess>('/rahcom/me'),
  setSelectedProvince: (province: string) => apiClient.put<{ rahcomSelectedProvince: string }>('/rahcom/me/province', { province }),
  memberProvinces: () => apiClient.get<RahcomMemberProvince[]>('/rahcom/members'),
  setMemberProvince: (id: string, province: string | null) => apiClient.put<{ id: string; rahcomProvince: string | null }>(`/rahcom/members/${encodeURIComponent(id)}/province`, { province }),
  axes: (province: string) => apiClient.get<RahcomAxis[]>(`/rahcom/axes?province=${encodeURIComponent(province)}`),
  createAxis: (province: string, name: string) => afterAxesMutation(apiClient.post<RahcomAxis>('/rahcom/axes', { province, name })),
  updateAxis: (id: string, name: string) => afterAxesMutation(apiClient.put<RahcomAxis>(`/rahcom/axes/${encodeURIComponent(id)}`, { name })),
  deleteAxis: (id: string) => afterAxesMutation(apiClient.delete<{ deleted: boolean }>(`/rahcom/axes/${encodeURIComponent(id)}`)),
  mergeAxes: (sourceId: string, targetAxisId: string) => afterAxesMutation(apiClient.post<{ merged: boolean }>(`/rahcom/axes/${encodeURIComponent(sourceId)}/merge`, { targetAxisId })),
  systems: (province?: string) => apiClient.get<RahcomSystem[]>(province ? `/rahcom/systems?province=${encodeURIComponent(province)}` : '/rahcom/systems'),
  solarSnapshots: (province?: string) => apiClient.get<RahcomSolarSnapshot[]>(province ? `/rahcom/solar-snapshots?province=${encodeURIComponent(province)}` : '/rahcom/solar-snapshots'),
  createSolarSnapshot: (data: { province: string; downText: string; unreachableText: string; equipmentColumns: string[]; capturedAt: string }) => afterSolarSnapshotMutation(apiClient.post<RahcomSolarSnapshot>('/rahcom/solar-snapshots', data)),
  updateSolarSnapshot: (id: string, data: { province: string; downText: string; unreachableText: string; equipmentColumns: string[]; capturedAt: string }) => afterSolarSnapshotMutation(apiClient.put<RahcomSolarSnapshot>(`/rahcom/solar-snapshots/${encodeURIComponent(id)}`, data)),
  deleteSolarSnapshot: (id: string) => afterSolarSnapshotMutation(apiClient.delete<{ deleted: boolean }>(`/rahcom/solar-snapshots/${encodeURIComponent(id)}`)),
  solarSpecialSystems: (province: string) => apiClient.get<RahcomSolarSpecialSystem[]>(`/rahcom/solar-special-systems?province=${encodeURIComponent(province)}`),
  replaceSolarSpecialSystems: (province: string, systems: Array<Pick<RahcomSolarSpecialSystem, 'systemCode' | 'category'>>) => afterSolarSnapshotMutation(apiClient.put<RahcomSolarSpecialSystem[]>('/rahcom/solar-special-systems', { province, systems })),
  trafficSnapshot: (province?: string) => apiClient.get<RahcomTrafficSnapshot | null>(province ? `/rahcom/traffic-snapshot?province=${encodeURIComponent(province)}` : '/rahcom/traffic-snapshot'),
  trafficSystemHistory: (systemCode: string) => apiClient.get<RahcomTrafficSystemHistory[]>(`/rahcom/traffic-snapshot/history?systemCode=${encodeURIComponent(systemCode)}`),
  importedTickets: (province?: string) => apiClient.get<RahcomImportedTicket[]>(province ? `/rahcom/tickets?province=${encodeURIComponent(province)}` : '/rahcom/tickets'),
  importTickets: (sourceFileName: string, tickets: Array<Omit<RahcomImportedTicket, 'id' | 'sourceFileName' | 'importedAt'>>) => apiClient.post<{ imported: number }, { sourceFileName: string; tickets: typeof tickets }>('/rahcom/tickets/import', { sourceFileName, tickets }),
  createTrafficSnapshot: (data: Pick<RahcomTrafficSnapshot, 'fileName' | 'sheetName' | 'headers' | 'rows'>) => afterTrafficSnapshotMutation(apiClient.post<RahcomTrafficSnapshot>('/rahcom/traffic-snapshots', data)),
  applyTrafficAxes: () => afterAxesMutation(apiClient.post<{ updatedSystems: number; unmatchedSystems: number; axisGroups: number }>('/rahcom/traffic-snapshot/apply-axes', {})),
  importSystems: (province: string, systems: Array<Record<string, unknown>>) => afterSystemsMutation(apiClient.post<{ imported: number }>('/rahcom/systems/import', { province, systems })),
  updateSystem: (id: string, data: Partial<RahcomSystem>) => afterSystemsMutation(apiClient.put<RahcomSystem>(`/rahcom/systems/${id}`, data)),
  deleteSystem: (id: string) => afterSystemsMutation(apiClient.delete<{ deleted: boolean }>(`/rahcom/systems/${id}`)),
  deleteSystems: (input: { province?: string; ids?: string[] }) => afterSystemsMutation(apiClient.deleteWithBody<{ deleted: number }, { ids: string[] }>(`/rahcom/systems${input.province ? `?province=${encodeURIComponent(input.province)}` : ''}`, { ids: input.ids ?? [] })),
  activities: (date: string, range?: { from: string; to: string }, province?: string) => apiClient.get<RahcomActivity[]>(`/rahcom/activities?${new URLSearchParams({ ...(range ? { from: range.from, to: range.to } : { date }), ...(province ? { province } : {}) }).toString()}`),
  addActivity: (data: { date: string; activityType: RahcomActivity['activityType']; quantity: number; description: string; systemId?: string; accompaniedBy?: string; handedOverTo?: string; province?: string }) => afterActivityMutation(apiClient.post<RahcomActivity>('/rahcom/activities', data)),
  systemActivities: (systemId: string) => apiClient.get<RahcomActivity[]>(`/rahcom/systems/${encodeURIComponent(systemId)}/activities`),
  addSystemActivity: (systemId: string, data: { date: string; description: string; accompaniedBy: string; handedOverTo: string }) => afterActivityMutation(apiClient.post<RahcomActivity>(`/rahcom/systems/${encodeURIComponent(systemId)}/activities`, data)),
  deleteActivity: (id: string) => afterActivityMutation(apiClient.delete<{ deleted: boolean }>(`/rahcom/activities/${id}`)),
};
