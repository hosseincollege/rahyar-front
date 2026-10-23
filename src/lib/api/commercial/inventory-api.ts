// Path: frontend/src/lib/api/commercial/inventory-api.ts
// Frontend - API client helpers for inventory module

import { apiClient } from '@/lib/api-client';
import type {
  InventoryBalance,
  InventoryMovement,
  InventoryProduct,
  InventorySummary,
  InventoryWarehouse,
} from '@/lib/api/commercial/inventory-types';

export const inventoryApi = {
  createProduct: async (input: { sku: string; name: string; unit: string; description?: string }): Promise<InventoryProduct> => {
    return apiClient.post<InventoryProduct, typeof input>('/inventory/products', input);
  },

  createWarehouse: async (input: { code: string; name: string; branchId?: string }): Promise<InventoryWarehouse> => {
    return apiClient.post<InventoryWarehouse, typeof input>('/inventory/warehouses', input);
  },

  getSummary: async (): Promise<InventorySummary> => {
    return apiClient.get<InventorySummary>(
      '/inventory/summary',
    );
  },

  getProducts: async (): Promise<InventoryProduct[]> => {
    return apiClient.get<InventoryProduct[]>(
      '/inventory/products',
    );
  },

  getWarehouses: async (): Promise<InventoryWarehouse[]> => {
    return apiClient.get<InventoryWarehouse[]>(
      '/inventory/warehouses',
    );
  },

  getBalances: async (): Promise<InventoryBalance[]> => {
    return apiClient.get<InventoryBalance[]>(
      '/inventory/balances',
    );
  },

  getMovements: async (): Promise<InventoryMovement[]> => {
    return apiClient.get<InventoryMovement[]>(
      '/inventory/movements',
    );
  },
};
