import { apiClient } from '@/lib/api-client';

export type BusinessTripStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type BusinessTripRequest = {
  id: string;
  destination: string;
  purpose: string;
  startAt: string;
  endAt: string;
  estimatedCost: string | number | null;
  currency: string;
  status: BusinessTripStatus;
  reviewerNote: string | null;
  createdAt: string;
};

export type CreateBusinessTripRequest = {
  destination: string;
  purpose: string;
  startAt: string;
  endAt: string;
  estimatedCost?: number;
};

export const businessTripsApi = {
  listMine: () => apiClient.get<BusinessTripRequest[]>('/business-trips/mine'),
  create: (request: CreateBusinessTripRequest) =>
    apiClient.post<BusinessTripRequest>('/business-trips', request),
};
