// Path: frontend/src/types/inventory.ts
// Frontend - shared inventory types for products, warehouses, balances, and movements

export type InventoryProduct = {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unit: string;
  isActive: boolean;
};

export type InventoryWarehouse = {
  id: string;
  code: string;
  name: string;
  branchId?: string | null;
  branchName?: string | null;
  isActive: boolean;
};

export type InventoryBalance = {
  productId: string;
  productName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  unit: string;
};

export type InventoryMovementType =
  | "RECEIPT"
  | "ISSUE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT";

export type InventoryMovement = {
  id: string;
  type: InventoryMovementType;
  quantity: number;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  reference?: string | null;
  note?: string | null;
  createdAt: string;
};

export type InventorySummary = {
  activeProducts: number;
  lowStockCount: number;
  todayReceipts: number;
  todayIssues: number;
};
