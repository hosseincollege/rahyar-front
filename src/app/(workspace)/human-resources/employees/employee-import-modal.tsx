/**
 * مسیر فایل:
 * src/app/(workspace)/hr/employee-import-modal.tsx
 *
 * مودال دریافت و بارگذاری فایل JSON کارکنان:
 * - دانلود فایل نمونه استاندارد با فرمت صحیح CreateEmployeePayload
 * - انتخاب و پردازش فایل JSON پرسنل
 * - ثبت تک‌به‌تک رکوردها از طریق createEmployee با نمایش پیشرفت زنده
 */

"use client";

import React, { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react";

import { ApiClientError, humanResourcesApi } from "@/app/(workspace)/human-resources/human-resources-api";
import type { CreateEmployeePayload } from "@/app/(workspace)/human-resources/types";

interface EmployeeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

interface ImportSummary {
  total: number;
  success: number;
  failed: number;
  errors: { index: number; name: string; message: string }[];
}

// ساختار نمونه استاندارد JSON
const SAMPLE_EMPLOYEES_DATA: CreateEmployeePayload[] = [
  {
    employeeCode: "EMP-1001",
    firstName: "علی",
    lastName: "محمدی",
    nationalId: "0012345678",
    email: "ali.mohammadi@example.com",
    phone: "09121111111",
    jobTitle: "توسعه‌دهنده فرانت‌اند",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    hiredAt: "2024-01-01",
  },
  {
    employeeCode: "EMP-1002",
    firstName: "سارا",
    lastName: "احمدی",
    nationalId: "0087654321",
    email: "sara.ahmadi@example.com",
    phone: "09122222222",
    jobTitle: "طراح رابط کاربری",
    employmentType: "FULL_TIME",
    status: "ACTIVE",
    hiredAt: "2024-02-15",
  },
];

export function EmployeeImportModal({ isOpen, onClose, onSuccess }: EmployeeImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CreateEmployeePayload[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  if (!isOpen) return null;

  // ۱. تابع دانلود فایل نمونه استاندارد
  const handleDownloadSample = () => {
    const jsonString = JSON.stringify(SAMPLE_EMPLOYEES_DATA, null, 2);
    const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "employees-sample.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ۲. تحلیل و اعتبارسنجی فایل JSON انتخاب‌شده
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);
    setSummary(null);
    setParsedData(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!file.name.endsWith(".json")) {
      setFileError("لطفاً فقط فایل با پسوند .json انتخاب کنید.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // پشتیبانی هم از آرایه مستقیم و هم از آبجکت شامل کلید employees
        const list: unknown[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.employees)
          ? parsed.employees
          : [];

        if (list.length === 0) {
          setFileError("فایل ارسالی خالی است یا ساختار آرایه‌ای ندارد.");
          return;
        }

        // بررسی حداقلی فیلدهای ضروری
        const invalidIndex = list.findIndex(
          (item: any) => !item.employeeCode || !item.firstName || !item.lastName || !item.hiredAt
        );

        if (invalidIndex !== -1) {
          setFileError(
            `ردیف شماره ${invalidIndex + 1} فاقد فیلدهای اجباری (کد پرسنلی، نام، نام خانوادگی یا تاریخ استخدام) است.`
          );
          return;
        }

        setParsedData(list as CreateEmployeePayload[]);
      } catch {
        setFileError("فرمت فایل JSON نامعتبر است. لطفاً فایل را بررسی کنید.");
      }
    };

    reader.readAsText(file);
  };

  // ۳. ارسال و ثبت کارکنان در سیستم
  const handleImport = async () => {
    if (!parsedData || parsedData.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    const errors: ImportSummary["errors"] = [];
    let successCount = 0;

    for (let i = 0; i < parsedData.length; i++) {
      const item = parsedData[i];
      const fullName = `${item.firstName} ${item.lastName}`;

      try {
        await humanResourcesApi.createEmployee(item);
        successCount++;
      } catch (err) {
        const errorMsg =
          err instanceof ApiClientError ? err.message : "خطای غیرمنتظره در ثبت کارمند";
        errors.push({
          index: i + 1,
          name: fullName,
          message: errorMsg,
        });
      }

      setProgress(Math.round(((i + 1) / parsedData.length) * 100));
    }

    setSummary({
      total: parsedData.length,
      success: successCount,
      failed: errors.length,
      errors,
    });

    setIsImporting(false);

    // در صورتی که حداقل یک مورد ثبت موفق داشتیم، لیست را تازه می‌کنیم
    if (successCount > 0) {
      void onSuccess();
    }
  };

  const handleResetModal = () => {
    setSelectedFile(null);
    setParsedData(null);
    setFileError(null);
    setSummary(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div
        dir="rtl"
        className="relative w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        {/* هدر مودال */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileJson size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">بارگذاری و ثبت کارکنان از JSON</h3>
              <p className="text-xs text-muted-foreground">ثبت گروهی پرسنل با فایل JSON</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetModal}
            disabled={isImporting}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* بدنه اصلی */}
        <div className="mt-4 space-y-4 text-xs">
          {/* بخش دانلود فایل نمونه */}
          <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 p-3.5">
            <div>
              <p className="font-bold text-foreground">نیاز به ساختار الگو دارید؟</p>
              <p className="mt-0.5 text-muted-foreground">
                فایل نمونه استاندارد را دریافت و اطلاعات کارکنان را طبق آن تنظیم کنید.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 font-bold text-foreground shadow-xs transition-all hover:bg-muted active:scale-95"
            >
              <Download size={14} />
              <span>دانلود نمونه</span>
            </button>
          </div>

          {/* باکس انتخاب فایل */}
          {!summary && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-6 text-center transition-all hover:border-primary/50 hover:bg-muted/20"
            >
              <Upload size={28} className="text-muted-foreground" />
              <p className="mt-2 font-bold text-foreground">
                {selectedFile ? selectedFile.name : "برای انتخاب فایل JSON کلیک کنید"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {selectedFile
                  ? `${parsedData ? parsedData.length : 0} رکورد آماده بارگذاری`
                  : "فرمت مجاز: .json"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                disabled={isImporting}
                onChange={handleFileChange}
              />
            </div>
          )}

          {/* خطای فایل */}
          {fileError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 font-medium text-rose-500">
              <AlertCircle size={16} />
              <span>{fileError}</span>
            </div>
          )}

          {/* نوار پیشرفت در حین ثبت */}
          {isImporting && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-2 text-foreground">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  در حال ثبت کارکنان در سیستم...
                </span>
                <span className="font-mono text-primary">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* گزارش نهایی عملیات */}
          {summary && (
            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="font-bold text-foreground">نتیجه بارگذاری:</span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-bold text-emerald-500">
                    <CheckCircle2 size={14} />
                    {summary.success} موفق
                  </span>
                  {summary.failed > 0 && (
                    <span className="flex items-center gap-1 font-bold text-rose-500">
                      <XCircle size={14} />
                      {summary.failed} ناموفق
                    </span>
                  )}
                </div>
              </div>

              {summary.errors.length > 0 && (
                <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                  {summary.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between rounded-lg bg-rose-500/10 p-2 text-[11px] text-rose-600 dark:text-rose-400"
                    >
                      <span className="font-semibold">
                        ردیف {err.index} ({err.name}):
                      </span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* دکمه‌های پاورقی */}
        <div className="mt-6 flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={handleResetModal}
            disabled={isImporting}
            className="rounded-xl border border-border px-4 py-2 font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {summary ? "بستن" : "انصراف"}
          </button>

          {!summary && (
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={isImporting || !parsedData || parsedData.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>در حال ثبت...</span>
                </>
              ) : (
                <>
                  <Upload size={14} />
                  <span>ثبت روی سیستم ({parsedData?.length ?? 0})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
