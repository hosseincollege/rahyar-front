/**
 * مسیر فایل:
 * src/app/(workspace)/commercial/sales/sales-workspace.tsx
 *
 * هدف:
 * صفحه اصلی ماژول مدیریت فروش و مشتریان (شاخص‌های فروش، سفارش‌ها، مشتریان و پیش‌فاکتورها بدون هدر مقدماتی).
 */

"use client";

import React, { useMemo, useState } from "react";
import { DemoJsonToolbar, useDemoDataset } from "@/app/(workspace)/commerce/components/demo-json-toolbar";
import {
  TrendingUp,
  Users,
  FileSpreadsheet,
  Clock,
  Search,
  Filter,
  Building2,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";

type SalesTab = "orders" | "customers" | "quotes";
type SalesOrderStatus = "DRAFT" | "PENDING_APPROVAL" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

interface SalesOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  contactPerson: string;
  category: string;
  itemsCount: number;
  totalAmount: number;
  currency: string;
  status: SalesOrderStatus;
  issueDate: string;
  dueDate: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
}

interface Customer {
  id: string;
  code: string;
  name: string;
  type: "حقیقی" | "حقوقی";
  contactPerson: string;
  phone: string;
  city: string;
  totalPurchases: number;
  status: "ACTIVE" | "INACTIVE";
}

const statusConfig: Record<
  SalesOrderStatus,
  { label: string; bgClass: string; textClass: string }
> = {
  DRAFT: {
    label: "پیش‌نویس",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
  },
  PENDING_APPROVAL: {
    label: "در انتظار تأیید",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  CONFIRMED: {
    label: "تأییدشده",
    bgClass: "bg-blue-500/10",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  DELIVERED: {
    label: "تحویل‌شده",
    bgClass: "bg-emerald-500/10",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
  CANCELLED: {
    label: "لغو شده",
    bgClass: "bg-rose-500/10",
    textClass: "text-rose-600 dark:text-rose-400",
  },
};

const initialOrders: SalesOrder[] = [
  {
    id: "so-1",
    orderNumber: "SO-1403-1201",
    customerName: "شرکت مهندسی داده‌پردازان سپهر",
    contactPerson: "دکتر حسینی",
    category: "خدمات نرم‌افزاری و لایسنس",
    itemsCount: 4,
    totalAmount: 1450000000,
    currency: "ریال",
    status: "CONFIRMED",
    issueDate: "1403/08/25",
    dueDate: "1403/09/05",
    paymentStatus: "PARTIAL",
  },
  {
    id: "so-2",
    orderNumber: "SO-1403-1198",
    customerName: "گروه صنعتی پیشرو گستر",
    contactPerson: "مهندس سعیدی",
    category: "تجهیزات شبکه و سخت‌افزار",
    itemsCount: 12,
    totalAmount: 3200000000,
    currency: "ریال",
    status: "PENDING_APPROVAL",
    issueDate: "1403/08/27",
    dueDate: "1403/09/15",
    paymentStatus: "UNPAID",
  },
  {
    id: "so-3",
    orderNumber: "SO-1403-1195",
    customerName: "بازرگانی بین‌المللی افق",
    contactPerson: "خانم شایان",
    category: "پشتیبانی و نگهداری سالانه",
    itemsCount: 1,
    totalAmount: 780000000,
    currency: "ریال",
    status: "DELIVERED",
    issueDate: "1403/08/18",
    dueDate: "1403/08/30",
    paymentStatus: "PAID",
  },
  {
    id: "so-4",
    orderNumber: "SO-1403-1190",
    customerName: "فروشگاه مرکزی افرا",
    contactPerson: "رضا کریمی",
    category: "تجهیزات جانبی",
    itemsCount: 2,
    totalAmount: 145000000,
    currency: "ریال",
    status: "CONFIRMED",
    issueDate: "1403/08/12",
    dueDate: "1403/08/20",
    paymentStatus: "PAID",
  },
];

const initialCustomers: Customer[] = [
  {
    id: "c-1",
    code: "CUST-901",
    name: "شرکت مهندسی داده‌پردازان سپهر",
    type: "حقوقی",
    contactPerson: "دکتر حسینی",
    phone: "۰۲۱-۸۸۹۹۲۲۰۱",
    city: "تهران",
    totalPurchases: 4250000000,
    status: "ACTIVE",
  },
  {
    id: "c-2",
    code: "CUST-902",
    name: "گروه صنعتی پیشرو گستر",
    type: "حقوقی",
    contactPerson: "مهندس سعیدی",
    phone: "۰۳۱-۳۳۴۴۵۵۶۶",
    city: "اصفهان",
    totalPurchases: 8900000000,
    status: "ACTIVE",
  },
  {
    id: "c-3",
    code: "CUST-903",
    name: "بازرگانی بین‌المللی افق",
    type: "حقوقی",
    contactPerson: "خانم شایان",
    phone: "۰۲۱-۲۲۶۶۱۱۰۲",
    city: "تهران",
    totalPurchases: 2100000000,
    status: "ACTIVE",
  },
  {
    id: "c-4",
    code: "CUST-904",
    name: "فروشگاه مرکزی افرا",
    type: "حقیقی",
    contactPerson: "رضا کریمی",
    phone: "۰۲۱-۴۴۲۲۳۳۱۱",
    city: "تهران",
    totalPurchases: 650000000,
    status: "ACTIVE",
  },
];

export default function SalesPage() {
  const [activeTab, setActiveTab] = useState<SalesTab>("orders");
  const [dataset, setDataset] = useDemoDataset("commercial-sales", { orders: initialOrders, customers: initialCustomers });
  const orders = dataset.orders as SalesOrder[];
  const customers = dataset.customers as Customer[];

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SalesOrderStatus | "ALL">("ALL");

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [customers, searchQuery]);

  return (
    <div dir="rtl" className="space-y-5">
      <DemoJsonToolbar
        fileName="commercial-sales-sample.json"
        module="commercial-sales"
        data={dataset}
        onImport={(next) => setDataset(next as typeof dataset)}
      />
      {/* ۱. کارت‌های شاخص عملکرد (KPIs) */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">فروش ناخالص ماه جاری</p>
              <p className="mt-2 text-xl font-bold text-foreground">۵,۵۷۵,۰۰۰,۰۰۰</p>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <ArrowUpRight size={13} />
                <span>۱۲.۵٪ رشد نسبت به ماه قبل</span>
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">سفارش‌های در جریان</p>
              <p className="mt-2 text-xl font-bold text-blue-500">{orders.length}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">در مرحله پردازش و تأیید</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <FileSpreadsheet size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">در انتظار تأیید مالی</p>
              <p className="mt-2 text-xl font-bold text-amber-500">۱</p>
              <p className="mt-1 text-[11px] text-muted-foreground">پیش‌پرداخت دریافت نشده</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <Clock size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">مشتریان فعال</p>
              <p className="mt-2 text-xl font-bold text-foreground">{customers.length}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">دارای تراکنش در فصل جاری</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
              <Users size={20} />
            </div>
          </div>
        </div>
      </section>

      {/* ۲. بخش تب‌ها، فیلترها و جداول اطلاعاتی */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
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
              <FileSpreadsheet size={14} />
              <span>سفارش‌های فروش ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("customers")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "customers"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 size={14} />
              <span>مشتریان سازمانی ({customers.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("quotes")}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === "quotes"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock size={14} />
              <span>پیش‌فاکتورها</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            {activeTab === "orders" && (
              <div className="relative w-full sm:w-44">
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SalesOrderStatus | "ALL")}
                  className="h-9.5 w-full appearance-none rounded-xl border border-border bg-background pr-8 pl-3 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                >
                  <option value="ALL">همه وضعیت‌ها</option>
                  <option value="DRAFT">پیش‌نویس</option>
                  <option value="PENDING_APPROVAL">در انتظار تأیید</option>
                  <option value="CONFIRMED">تأییدشده</option>
                  <option value="DELIVERED">تحویل‌شده</option>
                  <option value="CANCELLED">لغو شده</option>
                </select>
              </div>
            )}

            <div className="relative w-full sm:w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جست‌وجو در اقلام این بخش..."
                className="h-9.5 w-full rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* تب ۱: سفارش‌های فروش */}
        {activeTab === "orders" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">شماره سفارش</th>
                    <th className="px-4 py-3.5">مشتری</th>
                    <th className="px-4 py-3.5">دسته‌بندی / موضوع</th>
                    <th className="px-4 py-3.5">تاریخ ثبت / سررسید</th>
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
                            <div>{order.customerName}</div>
                            <div className="text-xs font-normal text-muted-foreground">
                              رابط: {order.contactPerson}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-xs text-muted-foreground">
                            {order.category}
                          </td>
                          <td className="px-4 py-4 text-xs">
                            <div className="text-foreground">{order.issueDate}</div>
                            <div className="text-muted-foreground">سررسید: {order.dueDate}</div>
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
                                واریز پیش‌پرداخت
                              </span>
                            )}
                            {order.paymentStatus === "UNPAID" && (
                              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                عدم تسویه
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

        {/* تب ۲: مشتریان سازمانی */}
        {activeTab === "customers" && (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3.5">کد مشتری</th>
                    <th className="px-4 py-3.5">نام شخص / سازمان</th>
                    <th className="px-4 py-3.5">نوع</th>
                    <th className="px-4 py-3.5">شخص رابط</th>
                    <th className="px-4 py-3.5">تماس و موقعیت</th>
                    <th className="px-4 py-3.5 text-left">مجموع خریدها (ریال)</th>
                    <th className="px-4 py-3.5 text-center">وضعیت حساب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <Users size={20} />
                        </div>
                        <p className="mt-2 text-sm font-bold text-foreground">مشتری‌ای یافت نشد</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-4 font-mono text-xs font-semibold text-muted-foreground">
                          {customer.code}
                        </td>
                        <td className="px-4 py-4 font-semibold text-foreground">
                          {customer.name}
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          <span className="rounded-md bg-muted px-2 py-1">
                            {customer.type}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-foreground">
                          {customer.contactPerson}
                        </td>
                        <td className="px-4 py-4 text-xs text-muted-foreground">
                          <div>{customer.phone}</div>
                          <div>{customer.city}</div>
                        </td>
                        <td className="px-4 py-4 text-left font-bold text-foreground">
                          {customer.totalPurchases.toLocaleString("fa-IR")}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            فعال
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

        {/* تب ۳: پیش‌فاکتورها */}
        {activeTab === "quotes" && (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Clock size={24} />
            </div>
            <h3 className="mt-3 text-sm font-bold text-foreground">
              مدیریت پیش‌فاکتورها و استعلام‌های قیمت
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
              پیش‌فاکتورهای ارسالی پس از تأیید مالی و مشتری، مستقیماً به سفارش قطعی و فاکتور فروش تبدیل می‌شوند.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
