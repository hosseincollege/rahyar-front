/**
 * مسیر فایل:
 * src/app/(workspace)/commerce/inventory/inventory-workspace.tsx
 *
 * هدف:
 * داشبورد جامع مدیریت انبار و موجودی کالا هماهنگ با طراحی مینیمال و یکپارچه:
 * - شروع مستقیم با کارت‌های شاخص عملکرد (KPIs)
 * - تب‌های تعاملی: موجودی لحظه‌ای، لیست کالاها، انبارها و گردش تراکنش‌ها
 * - ادغام دکمه تازه‌سازی داده‌ها با نوار ابزار جستجو و تب‌ها
 */

"use client";

import { getCalendarLocale } from '@/lib/calendar';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Package,
  BarChart3,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  Warehouse,
  ArrowLeftRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  SlidersHorizontal,
} from "lucide-react";

import { inventoryApi } from "@/app/(workspace)/commerce/inventory/inventory-api";
import { DemoJsonToolbar } from "@/app/(workspace)/commerce/components/demo-json-toolbar";
import { usePreferences } from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import type {
  InventoryBalance,
  InventoryMovement,
  InventoryMovementType,
  InventoryProduct,
  InventorySummary,
  InventoryWarehouse,
} from "@/app/(workspace)/commerce/inventory/types";

type InventoryTab = "inventory" | "products" | "warehouses" | "history";

const movementTypeLabels: Record<
  InventoryMovementType,
  { label: string; badgeClass: string }
> = {
  RECEIPT: {
    label: "ورود به انبار (رسید)",
    badgeClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  ISSUE: {
    label: "خروج از انبار (حواله)",
    badgeClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  TRANSFER_IN: {
    label: "ورود انتقالی بین‌انبار",
    badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  TRANSFER_OUT: {
    label: "خروج انتقالی بین‌انبار",
    badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  ADJUSTMENT: {
    label: "تعدیل موجودی (انبارگردانی)",
    badgeClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(getCalendarLocale("fa-IR"), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function InventoryPage() {
  const { locale } = usePreferences();
  const [activeTab, setActiveTab] = useState<InventoryTab>("inventory");
  const [summary, setSummary] = useState<InventorySummary | null>(null);

  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouse[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");

  const loadData = useCallback(async (showRefreshState = false) => {
    try {
      setError(null);
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [summaryRes, balancesRes, productsRes, warehousesRes, movementsRes] =
        await Promise.all([
          inventoryApi.getSummary().catch(() => null),
          inventoryApi.getBalances().catch(() => []),
          inventoryApi.getProducts().catch(() => []),
          inventoryApi.getWarehouses().catch(() => []),
          inventoryApi.getMovements().catch(() => []),
        ]);

      if (summaryRes) setSummary(summaryRes);
      setBalances(balancesRes || []);
      setProducts(productsRes || []);
      setWarehouses(warehousesRes || []);
      setMovements(movementsRes || []);
    } catch (err) {
      console.error("Error loading inventory data:", err);
      setError("دریافت اطلاعات انبارداری با خطا مواجه شد.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredBalances = useMemo(() => {
    if (!searchTerm.trim()) return balances;
    const term = searchTerm.toLowerCase();
    return balances.filter(
      (b) =>
        b.productName.toLowerCase().includes(term) ||
        b.sku.toLowerCase().includes(term) ||
        b.warehouseName.toLowerCase().includes(term),
    );
  }, [balances, searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.description && p.description.toLowerCase().includes(term)),
    );
  }, [products, searchTerm]);

  const filteredWarehouses = useMemo(() => {
    if (!searchTerm.trim()) return warehouses;
    const term = searchTerm.toLowerCase();
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        w.code.toLowerCase().includes(term) ||
        (w.branchName && w.branchName.toLowerCase().includes(term)),
    );
  }, [warehouses, searchTerm]);

  const filteredMovements = useMemo(() => {
    if (!searchTerm.trim()) return movements;
    const term = searchTerm.toLowerCase();
    return movements.filter(
      (m) =>
        m.productName.toLowerCase().includes(term) ||
        m.warehouseName.toLowerCase().includes(term) ||
        (m.reference && m.reference.toLowerCase().includes(term)) ||
        (m.note && m.note.toLowerCase().includes(term)),
    );
  }, [movements, searchTerm]);

  return (
    <div dir="rtl" className="space-y-5">
      <DemoJsonToolbar
        fileName="supply-inventory-sample.json"
        module="supply-inventory"
        data={{ products, warehouses }}
        sampleData={{
          products: [{ sku: 'DEMO-001', name: 'کالای نمونه', unit: 'عدد' }],
          warehouses: [{ code: 'DEMO-WH-01', name: 'انبار نمونه' }],
        }}
        onImport={async (dataset) => {
          const productSkus = new Set(products.map((product) => product.sku));
          const warehouseCodes = new Set(warehouses.map((warehouse) => warehouse.code));
          for (const row of dataset.products) {
            const product = row as Partial<InventoryProduct>;
            if (typeof product.sku !== 'string' || !product.sku.trim() || typeof product.name !== 'string' || !product.name.trim() || typeof product.unit !== 'string' || !product.unit.trim()) {
              throw new Error(uiMessage(locale, 'moduleJsonImportFailed'));
            }
            if (productSkus.has(product.sku)) continue;
            await inventoryApi.createProduct({ sku: product.sku.trim(), name: product.name.trim(), unit: product.unit.trim(), ...(product.description ? { description: product.description } : {}) });
            productSkus.add(product.sku);
          }
          for (const row of dataset.warehouses) {
            const warehouse = row as Partial<InventoryWarehouse>;
            if (typeof warehouse.code !== 'string' || !warehouse.code.trim() || typeof warehouse.name !== 'string' || !warehouse.name.trim()) {
              throw new Error(uiMessage(locale, 'moduleJsonImportFailed'));
            }
            if (warehouseCodes.has(warehouse.code)) continue;
            await inventoryApi.createWarehouse({ code: warehouse.code.trim(), name: warehouse.name.trim(), ...(warehouse.branchId ? { branchId: warehouse.branchId } : {}) });
            warehouseCodes.add(warehouse.code);
          }
          await loadData(true);
        }}
        onImportError={(importError) => {
          void loadData(true).finally(() => setError(importError instanceof Error ? importError.message : uiMessage(locale, 'moduleJsonImportFailed')));
        }}
      />
      {/* هشدار خطا در صورت بروز */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-medium text-rose-600 dark:text-rose-400"
        >
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadData(true)}
            className="rounded-lg border border-rose-500/30 px-3 py-1 font-bold transition-all hover:bg-rose-500/20"
          >
            تلاش مجدد
          </button>
        </div>
      )}

      {/* ۱. کارت‌های شاخص‌های کلیدی انبار (KPIs) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">کالاهای فعال</p>
              <p className="mt-2 text-xl font-bold text-foreground">
                {loading ? "..." : (summary?.activeProducts ?? products.length ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">اقلام تعریف‌شده در انبار</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Package size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-rose-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">هشدار کسری موجودی</p>
              <p className="mt-2 text-xl font-bold text-rose-500">
                {loading ? "..." : (summary?.lowStockCount ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">نیاز به سفارش‌گذاری مجدد</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <BarChart3 size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-emerald-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">ورودی‌های امروز</p>
              <p className="mt-2 text-xl font-bold text-emerald-500">
                {loading ? "..." : (summary?.todayReceipts ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">رسیدهای انبار ثبت‌شده</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <ArrowDownLeft size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-amber-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">خروجی‌های امروز</p>
              <p className="mt-2 text-xl font-bold text-amber-500">
                {loading ? "..." : (summary?.todayIssues ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">حواله‌های خروج صادرشده</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <ArrowUpRight size={20} />
            </div>
          </div>
        </div>
      </section>

      {/* ۲. بخش تب‌ها و جدول‌های داده */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        {/* نوار جابجایی تب‌ها، دکمه تازه‌سازی و جستجو */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("inventory")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "inventory"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <SlidersHorizontal size={14} />
              <span>موجودی لحظه‌ای</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("products")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "products"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Package size={14} />
              <span>لیست کالاها ({products.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("warehouses")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "warehouses"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Warehouse size={14} />
              <span>انبارها ({warehouses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "history"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ArrowLeftRight size={14} />
              <span>تراکنش‌ها ({movements.length})</span>
            </button>
          </div>

          {/* ابزارهای جستجو و به‌روزرسانی */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing || loading}
              title="به‌روزرسانی داده‌ها"
              className="inline-flex h-9.5 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-all hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{refreshing ? "در حال دریافت..." : "به‌روزرسانی"}</span>
            </button>

            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={15} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جست‌وجو در اقلام این بخش..."
                className="h-9.5 w-full rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* تب موجودی لحظه‌ای */}
        {activeTab === "inventory" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">کد کالا (SKU)</th>
                    <th className="px-4 py-3.5">نام کالا</th>
                    <th className="px-4 py-3.5">انبار مستقر</th>
                    <th className="px-4 py-3.5 text-left">موجودی فعلی</th>
                    <th className="px-4 py-3.5 text-center">وضعیت موجودی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-4"><div className="h-4 w-20 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-36 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-28 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-16 rounded bg-muted ml-auto"></div></td>
                        <td className="px-4 py-4 text-center"><div className="mx-auto h-5 w-20 rounded bg-muted"></div></td>
                      </tr>
                    ))
                  ) : filteredBalances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Package size={20} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground">موردی برای نمایش یافت نشد</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          اطلاعات موجودی کالا در انبارها ثبت نشده یا با جستجو همخوانی ندارد.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredBalances.map((balance, idx) => (
                      <tr key={`${balance.productId}-${balance.warehouseId}-${idx}`} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-4 font-mono text-xs font-semibold text-muted-foreground">
                          {balance.sku}
                        </td>
                        <td className="px-4 py-4 font-semibold text-foreground">
                          {balance.productName}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Warehouse size={14} className="text-muted-foreground" />
                            <span>{balance.warehouseName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-left font-bold text-foreground">
                          {balance.quantity.toLocaleString("fa-IR")} <span className="text-xs font-normal text-muted-foreground">{balance.unit}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {balance.quantity <= 5 ? (
                            <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                              نقطه سفارش بحرانی
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              موجودی کافی
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* تب کالاها */}
        {activeTab === "products" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">کد شناسایی (SKU)</th>
                    <th className="px-4 py-3.5">عنوان کالا</th>
                    <th className="px-4 py-3.5">واحد شمارش</th>
                    <th className="px-4 py-3.5">توضیحات و مشخصات</th>
                    <th className="px-4 py-3.5 text-center">وضعیت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-4"><div className="h-4 w-20 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-36 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-12 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-48 rounded bg-muted"></div></td>
                        <td className="px-4 py-4 text-center"><div className="mx-auto h-5 w-16 rounded bg-muted"></div></td>
                      </tr>
                    ))
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Package size={20} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground">کالایی تعریف نشده است</p>
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((product) => (
                      <tr key={product.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-4 font-mono text-xs font-semibold text-muted-foreground">
                          {product.sku}
                        </td>
                        <td className="px-4 py-4 font-semibold text-foreground">
                          {product.name}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {product.unit}
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {product.description || "—"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {product.isActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={12} />
                              <span>فعال</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                              <XCircle size={12} />
                              <span>غیرفعال</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* تب انبارها */}
        {activeTab === "warehouses" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">کد انبار</th>
                    <th className="px-4 py-3.5">نام انبار</th>
                    <th className="px-4 py-3.5">شعبه مربوطه</th>
                    <th className="px-4 py-3.5 text-center">وضعیت عملیاتی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-4"><div className="h-4 w-16 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-32 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-28 rounded bg-muted"></div></td>
                        <td className="px-4 py-4 text-center"><div className="mx-auto h-5 w-16 rounded bg-muted"></div></td>
                      </tr>
                    ))
                  ) : filteredWarehouses.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Warehouse size={20} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground">انباری یافت نشد</p>
                      </td>
                    </tr>
                  ) : (
                    filteredWarehouses.map((warehouse) => (
                      <tr key={warehouse.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-4 font-mono text-xs font-semibold text-muted-foreground">
                          {warehouse.code}
                        </td>
                        <td className="px-4 py-4 font-semibold text-foreground">
                          {warehouse.name}
                        </td>
                        <td className="px-4 py-4 text-muted-foreground">
                          {warehouse.branchName || "شعبه مرکزی"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          {warehouse.isActive ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={12} />
                              <span>فعال</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                              <XCircle size={12} />
                              <span>غیرفعال</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* تب تاریخچه تراکنش‌ها */}
        {activeTab === "history" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">نوع گردش</th>
                    <th className="px-4 py-3.5">کالا</th>
                    <th className="px-4 py-3.5">انبار</th>
                    <th className="px-4 py-3.5 text-left">تعداد / مقدار</th>
                    <th className="px-4 py-3.5">شماره سند / مرجع</th>
                    <th className="px-4 py-3.5">تاریخ ثبت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-4"><div className="h-5 w-24 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-32 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-24 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-16 rounded bg-muted ml-auto"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-20 rounded bg-muted"></div></td>
                        <td className="px-4 py-4"><div className="h-4 w-28 rounded bg-muted"></div></td>
                      </tr>
                    ))
                  ) : filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <ArrowLeftRight size={20} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground">تراکنشی ثبت نشده است</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((movement) => {
                      const typeConfig = movementTypeLabels[movement.type] || {
                        label: movement.type,
                        badgeClass: "bg-muted text-muted-foreground",
                      };

                      return (
                        <tr key={movement.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${typeConfig.badgeClass}`}>
                              {typeConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 font-semibold text-foreground">
                            {movement.productName}
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {movement.warehouseName}
                          </td>
                          <td className="px-4 py-4 text-left font-bold text-foreground">
                            {movement.quantity > 0 ? `+${movement.quantity.toLocaleString("fa-IR")}` : movement.quantity.toLocaleString("fa-IR")}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                              <FileText size={13} />
                              <span>{movement.reference || "—"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {formatDate(movement.createdAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
