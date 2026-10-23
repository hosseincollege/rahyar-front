/**
 * مسیر فایل:
 * src/app/(workspace)/commerce/purchasing/purchasing-workspace.tsx
 *
 * هدف:
 * داشبورد بهینه‌شده مدیریت تدارکات و زنجیره تأمین بدون هدر سنگین مقدماتی:
 * - شروع مستقیم با کارت‌های شاخص عملکرد (KPIs)
 * - تب‌های سفارش‌های خرید، تأمین‌کنندگان و فاکتورها با جدول‌های بهینه
 * - فیلتر وضعیت و جستجوی بلادرنگ
 */

"use client";

import React, { useMemo, useState } from "react";
import { DemoJsonToolbar, useDemoDataset } from "@/app/(workspace)/commerce/components/demo-json-toolbar";
import {
  ShoppingCart,
  Truck,
  Clock,
  CheckCircle2,
  Search,
  Filter,
  Building2,
  FileCheck,
  AlertCircle,
} from "lucide-react";

type PurchaseTab = "orders" | "vendors" | "bills";
type OrderStatus = "PENDING_APPROVAL" | "ORDERED" | "RECEIVED" | "CANCELLED";

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  vendorName: string;
  category: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  orderDate: string;
  deliveryDate: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
}

interface Vendor {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  category: string;
  rating: number;
  status: "ACTIVE" | "INACTIVE";
}

const statusConfig: Record<
  OrderStatus,
  { label: string; bgClass: string; textClass: string }
> = {
  PENDING_APPROVAL: {
    label: "در انتظار تأیید",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  ORDERED: {
    label: "سفارش‌گذاری‌شده",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  RECEIVED: {
    label: "تحویل انبار شده",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
  CANCELLED: {
    label: "لغو شده",
    bgClass: "bg-rose-500/10",
    textClass: "text-rose-600 dark:text-rose-400",
  },
};

const initialOrders: PurchaseOrder[] = [
  {
    id: "po-1",
    orderNumber: "PO-1403-0891",
    vendorName: "صنایع فولاد کاوه",
    category: "مواد اولیه",
    totalAmount: 1850000000,
    currency: "ریال",
    status: "ORDERED",
    orderDate: "1403/08/20",
    deliveryDate: "1403/08/29",
    paymentStatus: "PARTIAL",
  },
  {
    id: "po-2",
    orderNumber: "PO-1403-0892",
    vendorName: "پتروشیمی جم",
    category: "پلیمر و مواد شیمیایی",
    totalAmount: 940000000,
    currency: "ریال",
    status: "PENDING_APPROVAL",
    orderDate: "1403/08/24",
    deliveryDate: "1403/09/02",
    paymentStatus: "UNPAID",
  },
  {
    id: "po-3",
    orderNumber: "PO-1403-0885",
    vendorName: "تجهیزات بسته‌بندی پویا",
    category: "ملزومات بسته‌بندی",
    totalAmount: 320000000,
    currency: "ریال",
    status: "RECEIVED",
    orderDate: "1403/08/15",
    deliveryDate: "1403/08/25",
    paymentStatus: "PAID",
  },
  {
    id: "po-4",
    orderNumber: "PO-1403-0880",
    vendorName: "شرکت بازرگانی پارس قطعه",
    category: "قطعات یدکی ماشین‌آلات",
    totalAmount: 680000000,
    currency: "ریال",
    status: "RECEIVED",
    orderDate: "1403/08/10",
    deliveryDate: "1403/08/22",
    paymentStatus: "PAID",
  },
];

const initialVendors: Vendor[] = [
  {
    id: "v-1",
    code: "VND-101",
    name: "صنایع فولاد کاوه",
    contactPerson: "مهندس علوی",
    phone: "۰۲۱-۸۸۴۳۲۱۰۰",
    email: "sales@kaveh-steel.ir",
    category: "مواد اولیه فلزی",
    rating: 4.8,
    status: "ACTIVE",
  },
  {
    id: "v-2",
    code: "VND-102",
    name: "پتروشیمی جم",
    contactPerson: "خانم دکتر شمس",
    phone: "۰۲۱-۲۲۰۵۴۳۹۰",
    email: "b2b@jam-petro.com",
    category: "پلیمر و پتروشیمی",
    rating: 4.6,
    status: "ACTIVE",
  },
  {
    id: "v-3",
    code: "VND-103",
    name: "تجهیزات بسته‌بندی پویا",
    contactPerson: "آقای رضایی",
    phone: "۰۲۱-۴۴۹۸۷۶۵۴",
    email: "info@pouya-pack.ir",
    category: "بسته‌بندی و کارتن",
    rating: 4.2,
    status: "ACTIVE",
  },
  {
    id: "v-4",
    code: "VND-104",
    name: "شرکت بازرگانی پارس قطعه",
    contactPerson: "مهندس مرادی",
    phone: "۰۲۱-۶۶۵۴۳۲۱۰",
    email: "support@parsparts.com",
    category: "قطعات مکانیکی و برقی",
    rating: 3.9,
    status: "ACTIVE",
  },
];

export default function PurchasesPage() {
  const [activeTab, setActiveTab] = useState<PurchaseTab>("orders");
  const [dataset, setDataset] = useDemoDataset("supply-purchasing", { orders: initialOrders, vendors: initialVendors });
  const orders = dataset.orders as PurchaseOrder[];
  const vendors = dataset.vendors as Vendor[];

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      return (
        vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor.contactPerson.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [vendors, searchQuery]);

  return (
    <div dir="rtl" className="space-y-5">
      <DemoJsonToolbar
        fileName="supply-purchasing-sample.json"
        module="supply-purchasing"
        data={dataset}
        onImport={(next) => setDataset(next as typeof dataset)}
      />
      {/* ۱. کارت‌های شاخص عملکرد (KPIs) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">سفارش‌های باز خرید</p>
              <p className="mt-2 text-xl font-bold text-foreground">۲</p>
              <p className="mt-1 text-[11px] text-muted-foreground">در جریان پیگیری تدارکات</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <ShoppingCart size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">تأمین‌کنندگان فعال</p>
              <p className="mt-2 text-xl font-bold text-foreground">{vendors.length}</p>
              <p className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400">تماماً دارای قرارداد معتبر</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Truck size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">در انتظار تأیید مدیریت</p>
              <p className="mt-2 text-xl font-bold text-amber-500">۱</p>
              <p className="mt-1 text-[11px] text-muted-foreground">پیش‌فاکتورهای نیازمند بررسی</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Clock size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">تحویل امروز انبار</p>
              <p className="mt-2 text-xl font-bold text-purple-500">۲</p>
              <p className="mt-1 text-[11px] text-muted-foreground">محموله در مرحله رسید</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <CheckCircle2 size={20} />
            </div>
          </div>
        </div>
      </section>

      {/* ۲. بخش تب‌ها و جداول عملیاتی */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        {/* نوار تب‌ها و ابزار جستجو */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/60 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "orders"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingCart size={14} />
              <span>سفارش‌های خرید ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("vendors")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "vendors"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 size={14} />
              <span>تأمین‌کنندگان ({vendors.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("bills")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "bills"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileCheck size={14} />
              <span>فاکتورها و اسناد تدارکات</span>
            </button>
          </div>

          {/* فیلترها و جستجو */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {activeTab === "orders" && (
              <div className="relative w-full sm:w-44">
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={14} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "ALL")}
                  className="h-9.5 w-full appearance-none rounded-xl border border-border bg-background pr-8 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">همه وضعیت‌ها</option>
                  <option value="PENDING_APPROVAL">در انتظار تأیید</option>
                  <option value="ORDERED">سفارش‌گذاری‌شده</option>
                  <option value="RECEIVED">تحویل انبار شده</option>
                  <option value="CANCELLED">لغو شده</option>
                </select>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" size={15} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجو در اقلام این بخش..."
                className="h-9.5 w-full rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ۱. تب سفارش‌های خرید */}
        {activeTab === "orders" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">شماره سفارش</th>
                    <th className="px-4 py-3.5">تأمین‌کننده</th>
                    <th className="px-4 py-3.5">دسته‌بندی</th>
                    <th className="px-4 py-3.5">تاریخ سفارش / تحویل</th>
                    <th className="px-4 py-3.5 text-left">مبلغ سفارش (ریال)</th>
                    <th className="px-4 py-3.5 text-center">وضعیت سفارش</th>
                    <th className="px-4 py-3.5 text-center">وضعیت تسویه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <AlertCircle size={20} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground">سفارشی یافت نشد</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          با تغییر عبارت جستجو یا وضعیت فیلتر مجدداً امتحان کنید.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const statusInfo = statusConfig[order.status];
                      return (
                        <tr key={order.id} className="transition-colors hover:bg-muted/30">
                          <td className="px-4 py-4 font-mono text-xs font-semibold text-foreground">
                            {order.orderNumber}
                          </td>
                          <td className="px-4 py-4 font-semibold text-foreground">
                            {order.vendorName}
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {order.category}
                          </td>
                          <td className="px-4 py-4 text-xs">
                            <div className="text-foreground">{order.orderDate}</div>
                            <div className="text-muted-foreground">تحویل: {order.deliveryDate}</div>
                          </td>
                          <td className="px-4 py-4 text-left font-bold text-foreground">
                            {order.totalAmount.toLocaleString("fa-IR")}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusInfo.bgClass} ${statusInfo.textClass}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {order.paymentStatus === "PAID" && (
                              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                تسویه کامل
                              </span>
                            )}
                            {order.paymentStatus === "PARTIAL" && (
                              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                                پرداخت اقساطی
                              </span>
                            )}
                            {order.paymentStatus === "UNPAID" && (
                              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                پرداخت‌نشده
                              </span>
                            )}
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

        {/* ۲. تب تأمین‌کنندگان */}
        {activeTab === "vendors" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">کد تأمین‌کننده</th>
                    <th className="px-4 py-3.5">نام شرکت / فروشنده</th>
                    <th className="px-4 py-3.5">مسئول رابط</th>
                    <th className="px-4 py-3.5">زمینه تخصص</th>
                    <th className="px-4 py-3.5">راه‌های ارتباطی</th>
                    <th className="px-4 py-3.5 text-center">امتیاز عملکرد</th>
                    <th className="px-4 py-3.5 text-center">وضعیت همکاری</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredVendors.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Truck size={20} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground">تأمین‌کننده‌ای یافت نشد</p>
                      </td>
                    </tr>
                  ) : (
                    filteredVendors.map((vendor) => (
                      <tr key={vendor.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-4 font-mono text-xs font-semibold text-muted-foreground">
                          {vendor.code}
                        </td>
                        <td className="px-4 py-4 font-semibold text-foreground">
                          {vendor.name}
                        </td>
                        <td className="px-4 py-4 text-foreground/80">
                          {vendor.contactPerson}
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          {vendor.category}
                        </td>
                        <td className="px-4 py-4 text-xs">
                          <div className="font-mono text-foreground">{vendor.phone}</div>
                          <div className="text-muted-foreground">{vendor.email}</div>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-amber-500">
                          ★ {vendor.rating.toLocaleString("fa-IR")}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={12} />
                            <span>فعال</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ۳. تب فاکتورها و اسناد تدارکات */}
        {activeTab === "bills" && (
          <div className="rounded-xl border border-border p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <FileCheck size={24} />
            </div>
            <h3 className="mt-3 text-sm font-bold text-foreground">
              مدیریت فاکتورها و اسناد مالی خرید
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              اسناد خرید پس از نهایی‌سازی سفارش‌ها، جهت ثبت سند و پرداخت به‌صورت خودکار با ماژول حسابداری همگام‌سازی می‌شوند.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
