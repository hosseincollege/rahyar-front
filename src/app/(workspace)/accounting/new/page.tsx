/**
 * مسیر فایل:
 * frontend/src/app/(workspace)/accounting/new/page.tsx
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  accountingApi,
  ApiClientError,
} from "@/app/(workspace)/accounting/accounting-api";

import type {
  AccountingLineItem,
  AccountingPriority,
  CreateInvoicePayload,
} from "@/app/(workspace)/accounting/types";
import { getLocaleDirection, usePreferences } from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import { useAccountingAccess } from "../accounting-access-context";

type InvoiceFormItem = {
  localId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
};

type FormValues = {
  title: string;
  vendorName: string;
  description: string;
  branchId: string;
  departmentId: string;
  dueDate: string;
  currency: string;
  priority: AccountingPriority;
};

const INITIAL_FORM: FormValues = {
  title: "",
  vendorName: "",
  description: "",
  branchId: "",
  departmentId: "",
  dueDate: "",
  currency: "IRR",
  priority: "MEDIUM",
};

function createEmptyItem(): InvoiceFormItem {
  return {
    localId: `${Date.now()}-${Math.random()}`,
    description: "",
    quantity: "1",
    unitPrice: "",
    taxRate: "0",
  };
}

function parseNumber(value: string): number {
  const normalizedValue = value.replace(/,/g, "").trim();

  if (!normalizedValue) {
    return 0;
  }

  const parsedValue = Number(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "ثبت فاکتور با خطا مواجه شد.";
}

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function NewAccountingInvoicePage() {
  const { locale } = usePreferences();
  const { canManage } = useAccountingAccess();
  const router = useRouter();

  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [items, setItems] = useState<InvoiceFormItem[]>([createEmptyItem()]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const quantity = parseNumber(item.quantity);
      const unitPrice = parseNumber(item.unitPrice);
      const taxRate = parseNumber(item.taxRate);

      const lineSubtotal = quantity * unitPrice;
      const lineTax = lineSubtotal * (taxRate / 100);

      subtotal += lineSubtotal;
      taxAmount += lineTax;
    }

    return {
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
    };
  }, [items]);

  function updateFormField(field: keyof FormValues, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function updateItem(
    localId: string,
    field: keyof Omit<InvoiceFormItem, "localId">,
    value: string,
  ) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.localId === localId
          ? {
              ...item,
              [field]: value,
            }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((currentItems) => [...currentItems, createEmptyItem()]);
  }

  function removeItem(localId: string) {
    if (items.length === 1) {
      setItems([createEmptyItem()]);
      return;
    }

    setItems((currentItems) =>
      currentItems.filter((item) => item.localId !== localId),
    );
  }

  function validateForm(): string | null {
    if (!form.title.trim()) {
      return "عنوان فاکتور را وارد کنید.";
    }

    if (items.length === 0) {
      return "حداقل یک ردیف برای فاکتور لازم است.";
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const quantity = parseNumber(item.quantity);
      const unitPrice = parseNumber(item.unitPrice);
      const taxRate = parseNumber(item.taxRate);

      if (!item.description.trim()) {
        return `توضیحات ردیف ${index + 1} را وارد کنید.`;
      }

      if (quantity <= 0) {
        return `تعداد ردیف ${index + 1} باید بیشتر از صفر باشد.`;
      }

      if (unitPrice < 0) {
        return `قیمت واحد ردیف ${index + 1} نمی‌تواند منفی باشد.`;
      }

      if (taxRate < 0 || taxRate > 100) {
        return `نرخ مالیات ردیف ${index + 1} باید بین صفر تا صد باشد.`;
      }
    }

    if (totals.total <= 0) {
      return "مبلغ فاکتور باید بیشتر از صفر باشد.";
    }

    return null;
  }

  function buildPayload(): CreateInvoicePayload {
    const lineItems: AccountingLineItem[] = items.map((item) => {
      const quantity = parseNumber(item.quantity);
      const unitPrice = parseNumber(item.unitPrice);
      const taxRate = parseNumber(item.taxRate);

      return {
        description: item.description.trim(),
        quantity,
        unitPrice,
        taxRate,
        total: quantity * unitPrice * (1 + taxRate / 100),
      };
    });

    return {
      title: form.title.trim(),
      vendorName: form.vendorName.trim() || undefined,
      description: form.description.trim() || undefined,
      branchId: form.branchId.trim() || undefined,
      departmentId: form.departmentId.trim() || undefined,
      dueDate: form.dueDate || null,
      currency: form.currency,
      priority: form.priority,
      lineItems,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const createdInvoice = await accountingApi.createInvoice(buildPayload());

      if (createdInvoice?.id) {
        router.push(`/accounting/${createdInvoice.id}`);
      } else {
        router.push("/accounting/invoices");
      }
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNumericChange(
    event: ChangeEvent<HTMLInputElement>,
    localId: string,
    field: "quantity" | "unitPrice" | "taxRate",
  ) {
    const value = event.target.value;

    if (value !== "" && !/^\d*([.]\d*)?$/.test(value)) {
      return;
    }

    updateItem(localId, field, value);
  }

  if (!canManage) {
    return <main dir={getLocaleDirection(locale)} role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">{uiMessage(locale, 'accountingManageDenied')}</main>;
  }

  return (
    <main
      dir={getLocaleDirection(locale)}
      className="w-full min-w-0 space-y-6 bg-background px-0 py-4 text-foreground md:py-6"
    >
      {/* هدر تمام‌عرض */}
      <section className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/accounting/invoices"
              className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
            >
              <ArrowRight size={16} />
              بازگشت به حسابداری
            </Link>

            <h1 className="text-xl font-bold text-foreground">
              ثبت فاکتور خرید
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              اطلاعات فاکتور و اقلام خرید را وارد کنید.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calculator size={24} />
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="w-full space-y-6">
        {/* اطلاعات اصلی */}
        <section className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                اطلاعات اصلی فاکتور
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                مشخصات عمومی فاکتور خرید را وارد کنید.
              </p>
            </div>

            <span className="hidden rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary sm:inline-flex">
              فاکتور خرید
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm font-medium text-foreground">
                عنوان فاکتور
                <span className="text-destructive"> *</span>
              </span>

              <input
                value={form.title}
                onChange={(event) =>
                  updateFormField("title", event.target.value)
                }
                placeholder="مثلاً خرید تجهیزات اداری"
                className={inputClass}
              />
            </label>

            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm font-medium text-foreground">
                نام تأمین‌کننده
              </span>

              <input
                required
                value={form.vendorName}
                onChange={(event) =>
                  updateFormField("vendorName", event.target.value)
                }
                placeholder="نام شخص یا شرکت تأمین‌کننده"
                className={inputClass}
              />
            </label>

            <label className="space-y-2 md:col-span-2 xl:col-span-4">
              <span className="text-sm font-medium text-foreground">
                توضیحات
              </span>

              <textarea
                value={form.description}
                onChange={(event) =>
                  updateFormField("description", event.target.value)
                }
                rows={3}
                placeholder="توضیحات تکمیلی فاکتور"
                className={`${inputClass} h-auto resize-y py-3`}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                شناسه شعبه
              </span>

              <input
                value={form.branchId}
                onChange={(event) =>
                  updateFormField("branchId", event.target.value)
                }
                placeholder="شناسه شعبه"
                className={inputClass}
              />

              <span className="block text-xs text-muted-foreground">
                اختیاری
              </span>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                شناسه دپارتمان
              </span>

              <input
                value={form.departmentId}
                onChange={(event) =>
                  updateFormField("departmentId", event.target.value)
                }
                placeholder="شناسه دپارتمان"
                className={inputClass}
              />

              <span className="block text-xs text-muted-foreground">
                اختیاری
              </span>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                تاریخ سررسید
              </span>

              <input
                type="date"
                value={form.dueDate}
                onChange={(event) =>
                  updateFormField("dueDate", event.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                ارز
              </span>

              <select
                value={form.currency}
                onChange={(event) =>
                  updateFormField("currency", event.target.value)
                }
                className={`${inputClass} cursor-pointer`}
              >
                <option value="IRR">ریال</option>
                <option value="toman">تومان</option>
                <option value="USD">دلار</option>
                <option value="EUR">یورو</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">
                اولویت
              </span>

              <select
                value={form.priority}
                onChange={(event) =>
                  updateFormField("priority", event.target.value)
                }
                className={`${inputClass} cursor-pointer`}
              >
                <option value="LOW">کم</option>
                <option value="MEDIUM">متوسط</option>
                <option value="HIGH">زیاد</option>
                <option value="URGENT">فوری</option>
              </select>
            </label>
          </div>
        </section>

        {/* اقلام فاکتور */}
        <section className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                اقلام فاکتور
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                اقلام خرید، تعداد، قیمت و مالیات را وارد کنید.
              </p>
            </div>

            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/15"
            >
              <Plus size={17} />
              افزودن ردیف
            </button>
          </div>

          <div className="space-y-4 p-5">
            {items.map((item, index) => {
              const quantity = parseNumber(item.quantity);
              const unitPrice = parseNumber(item.unitPrice);
              const taxRate = parseNumber(item.taxRate);

              const lineSubtotal = quantity * unitPrice;
              const lineTax = lineSubtotal * (taxRate / 100);
              const lineTotal = lineSubtotal + lineTax;

              return (
                <div
                  key={item.localId}
                  className="rounded-2xl border border-border bg-muted/30 p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">
                      ردیف {formatAmount(index + 1)}
                    </h3>

                    <button
                      type="button"
                      onClick={() => removeItem(item.localId)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/10"
                    >
                      <Trash2 size={15} />
                      حذف ردیف
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
                    <label className="space-y-2 md:col-span-2 xl:col-span-5">
                      <span className="text-sm font-medium text-foreground">
                        شرح کالا یا خدمت
                        <span className="text-destructive"> *</span>
                      </span>

                      <input
                        value={item.description}
                        onChange={(event) =>
                          updateItem(
                            item.localId,
                            "description",
                            event.target.value,
                          )
                        }
                        placeholder="شرح ردیف فاکتور"
                        className={inputClass}
                      />
                    </label>

                    <label className="space-y-2 xl:col-span-2">
                      <span className="text-sm font-medium text-foreground">
                        تعداد
                        <span className="text-destructive"> *</span>
                      </span>

                      <input
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) =>
                          handleNumericChange(
                            event,
                            item.localId,
                            "quantity",
                          )
                        }
                        placeholder="1"
                        className={inputClass}
                      />
                    </label>

                    <label className="space-y-2 xl:col-span-2">
                      <span className="text-sm font-medium text-foreground">
                        قیمت واحد
                        <span className="text-destructive"> *</span>
                      </span>

                      <input
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(event) =>
                          handleNumericChange(
                            event,
                            item.localId,
                            "unitPrice",
                          )
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </label>

                    <label className="space-y-2 xl:col-span-1">
                      <span className="text-sm font-medium text-foreground">
                        مالیات %
                      </span>

                      <input
                        inputMode="decimal"
                        value={item.taxRate}
                        onChange={(event) =>
                          handleNumericChange(
                            event,
                            item.localId,
                            "taxRate",
                          )
                        }
                        placeholder="0"
                        className={inputClass}
                      />
                    </label>

                    <div className="flex flex-col justify-end gap-2 xl:col-span-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        مبلغ نهایی ردیف
                      </span>

                      <div className="flex h-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 px-3 text-sm font-bold text-primary">
                        {formatAmount(lineTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">
                      مبلغ این ردیف با مالیات:
                    </span>

                    <span className="font-bold text-foreground">
                      {formatAmount(lineTotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* خلاصه مبالغ */}
        <section className="w-full rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[1fr_420px] lg:items-center">
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <p className="text-sm font-medium text-foreground">
                خلاصه فاکتور
              </p>

              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                پس از بررسی اطلاعات، فاکتور را ثبت کنید. مبلغ نهایی بر اساس
                تعداد، قیمت واحد و مالیات هر ردیف محاسبه شده است.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>جمع کالا و خدمات</span>
                <span>{formatAmount(totals.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>مبلغ مالیات</span>
                <span>{formatAmount(totals.taxAmount)}</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-base font-bold text-primary">
                <span>مبلغ نهایی</span>

                <span>
                  {formatAmount(totals.total)}{" "}
                  {form.currency === "IRR" ? "ریال" : form.currency}
                </span>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="w-full rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm leading-6 text-destructive">
            {error}
          </div>
        )}

        {/* دکمه‌های عملیاتی */}
        <div className="flex w-full flex-col-reverse gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:justify-end">
          <Link
            href="/accounting/invoices"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            انصراف
          </Link>

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={17} />
            {isSubmitting ? "در حال ثبت..." : "ثبت فاکتور"}
          </button>
        </div>
      </form>
    </main>
  );
}
