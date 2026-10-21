import { apiClient } from '@/lib/api-client';

function notifySystemsChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rahyar:systems-changed'));
}

async function afterSystemsMutation<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  notifySystemsChanged();
  return result;
}
async function afterActivityMutation<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rahyar:activities-changed'));
  return result;
}

export type RahcomSystem = {
  id: string; province: string; systemName: string; systemCode: string;
  latitude: number; longitude: number; details: string | null;
  electricityBillId: string | null; simIp: string | null; radarIp: string | null;
  cameraIp: string | null; pcIp: string | null; routerIp: string | null; laptopIp: string | null;
};
export type RahcomActivity = {
  id: string; activityDate: string; activityType: 'EMAIL_SENT' | 'SYSTEM_VISIT' | 'OTHER';
  quantity: number; description: string | null; createdAt: string; systemId: string | null;
  systemNameSnapshot: string | null; systemCodeSnapshot: string | null; provinceSnapshot: string | null;
  accompaniedBy: string | null; handedOverTo: string | null; performedBy: string | null;
  system?: Pick<RahcomSystem, 'id' | 'systemName' | 'systemCode' | 'province'> | null;
};
/** Coordinates copied for search or navigation: latitude first, ASCII comma, longitude. */
export function formatRahcomCoordinates(latitude: number, longitude: number) {
  return `${latitude}, ${longitude}`;
}
export const iranProvinces = [
  ['isfahan', 'اصفهان'], ['tehran', 'تهران'], ['east-azerbaijan', 'آذربایجان شرقی'], ['west-azerbaijan', 'آذربایجان غربی'],
  ['ardabil', 'اردبیل'], ['alborz', 'البرز'], ['ilam', 'ایلام'], ['bushehr', 'بوشهر'], ['charmahal-bakhtiari', 'چهارمحال و بختیاری'],
  ['south-khorasan', 'خراسان جنوبی'], ['razavi-khorasan', 'خراسان رضوی'], ['north-khorasan', 'خراسان شمالی'], ['khuzestan', 'خوزستان'],
  ['zanjan', 'زنجان'], ['semnan', 'سمنان'], ['sistan-baluchestan', 'سیستان و بلوچستان'], ['fars', 'فارس'], ['qazvin', 'قزوین'],
  ['qom', 'قم'], ['kurdistan', 'کردستان'], ['kerman', 'کرمان'], ['kermanshah', 'کرمانشاه'], ['kohgiluyeh-boyerahmad', 'کهگیلویه و بویراحمد'],
  ['golestan', 'گلستان'], ['gilan', 'گیلان'], ['lorestan', 'لرستان'], ['mazandaran', 'مازندران'], ['markazi', 'مرکزی'],
  ['hormozgan', 'هرمزگان'], ['hamadan', 'همدان'], ['yazd', 'یزد'],
] as const;
export const rahcomApi = {
  systems: (province?: string) => apiClient.get<RahcomSystem[]>(province ? `/rahcom/systems?province=${encodeURIComponent(province)}` : '/rahcom/systems'),
  importSystems: (province: string, systems: Array<Record<string, unknown>>) => afterSystemsMutation(apiClient.post<{ imported: number }>('/rahcom/systems/import', { province, systems })),
  updateSystem: (id: string, data: Partial<RahcomSystem>) => afterSystemsMutation(apiClient.put<RahcomSystem>(`/rahcom/systems/${id}`, data)),
  deleteSystem: (id: string) => afterSystemsMutation(apiClient.delete<{ deleted: boolean }>(`/rahcom/systems/${id}`)),
  deleteSystems: (input: { province?: string; ids?: string[] }) => afterSystemsMutation(apiClient.deleteWithBody<{ deleted: number }, { ids: string[] }>(`/rahcom/systems${input.province ? `?province=${encodeURIComponent(input.province)}` : ''}`, { ids: input.ids ?? [] })),
  activities: (date: string) => apiClient.get<RahcomActivity[]>(`/rahcom/activities?date=${encodeURIComponent(date)}`),
  addActivity: (data: { date: string; activityType: RahcomActivity['activityType']; quantity: number; description: string; systemId?: string; accompaniedBy?: string; handedOverTo?: string }) => afterActivityMutation(apiClient.post<RahcomActivity>('/rahcom/activities', data)),
  systemActivities: (systemId: string) => apiClient.get<RahcomActivity[]>(`/rahcom/systems/${encodeURIComponent(systemId)}/activities`),
  addSystemActivity: (systemId: string, data: { date: string; description: string; accompaniedBy: string; handedOverTo: string }) => afterActivityMutation(apiClient.post<RahcomActivity>(`/rahcom/systems/${encodeURIComponent(systemId)}/activities`, data)),
  deleteActivity: (id: string) => afterActivityMutation(apiClient.delete<{ deleted: boolean }>(`/rahcom/activities/${id}`)),
};
