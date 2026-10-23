"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, UserPlus, AlertCircle } from "lucide-react";
import {
  CreateEmployeePayload,
  EmployeeStatus,
  EmploymentType,
} from "@/app/(workspace)/human-resources/types";
import { employeeStatusLabels, employmentTypeLabels } from "./hr-utils";
import { usePreferences } from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import type { HrReferenceData } from "@/app/(workspace)/human-resources/types";

interface EmployeeFormModalProps {
  isOpen: boolean;
  isSaving: boolean;
  referenceData: HrReferenceData | null;
  onClose: () => void;
  onSave: (payload: CreateEmployeePayload) => Promise<void>;
}

export interface EmployeeFormData {
  employeeCode: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  phone: string;
  email: string;
  jobTitle: string;
  hiredAt: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  departmentId: string;
  branchId: string;
  managerId: string;
  userId: string;
  birthDate: string;
  address: string;
  emergencyPhone: string;
  notes: string;
}

const initialFormData: EmployeeFormData = {
  employeeCode: "",
  firstName: "",
  lastName: "",
  nationalId: "",
  phone: "",
  email: "",
  jobTitle: "",
  hiredAt: new Date().toISOString().split("T")[0],
  employmentType: "FULL_TIME",
  status: "ACTIVE",
  departmentId: "",
  branchId: "",
  managerId: "",
  userId: "",
  birthDate: "",
  address: "",
  emergencyPhone: "",
  notes: "",
};

export function EmployeeFormModal({
  isOpen,
  isSaving,
  referenceData,
  onClose,
  onSave,
}: EmployeeFormModalProps) {
  const { locale } = usePreferences();
  const [formData, setFormData] = useState<EmployeeFormData>(initialFormData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        ...initialFormData,
        hiredAt: new Date().toISOString().split("T")[0],
      });
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (
      !formData.employeeCode.trim() ||
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.hiredAt
    ) {
      setErrorMessage("لطفاً فیلدهای ستاره‌دار و ضروری را تکمیل کنید.");
      return;
    }

    const payload: CreateEmployeePayload = {
      employeeCode: formData.employeeCode.trim(),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      hiredAt: new Date(formData.hiredAt).toISOString(),
      employmentType: formData.employmentType,
      status: formData.status,
      jobTitle: formData.jobTitle.trim() || undefined,
      nationalId: formData.nationalId.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      email: formData.email.trim() || undefined,
      departmentId: formData.departmentId.trim() || undefined,
      branchId: formData.branchId.trim() || undefined,
      managerId: formData.managerId.trim() || undefined,
      userId: formData.userId.trim() || undefined,
      birthDate: formData.birthDate
        ? new Date(formData.birthDate).toISOString()
        : undefined,
      address: formData.address.trim() || undefined,
      emergencyPhone: formData.emergencyPhone.trim() || undefined,
      notes: formData.notes.trim() || undefined,
    };

    try {
      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "خطا در ثبت اطلاعات کارمند";
      setErrorMessage(message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      dir="rtl"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                افزودن کارمند جدید
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                مشخصات فردی و شغلی پرسنل را وارد نمایید
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors disabled:opacity-50"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* بخش اطلاعات اصلی */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                کد پرسنلی <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="employeeCode"
                value={formData.employeeCode}
                onChange={handleChange}
                required
                placeholder="مثال: EMP-1001"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                نام <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="نام کارمند"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                نام خانوادگی <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="نام خانوادگی"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* بخش شغلی و قرارداد */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                عنوان شغلی
              </label>
              <input
                type="text"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
                placeholder="مثال: کارشناس ارشد مالی"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                نوع همکاری
              </label>
              <select
                name="employmentType"
                value={formData.employmentType}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                {Object.entries(employmentTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                وضعیت اشتغال
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              >
                {Object.entries(employeeStatusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block space-y-1.5 text-xs font-semibold text-foreground">
              <span>{uiMessage(locale, "hrBranch")}</span>
              <select name="branchId" value={formData.branchId} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
                <option value="">{uiMessage(locale, "hrNoBranch")}</option>
                {referenceData?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} · {branch.code}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-foreground">
              <span>{uiMessage(locale, "hrDepartment")}</span>
              <select name="departmentId" value={formData.departmentId} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
                <option value="">{uiMessage(locale, "hrNoDepartment")}</option>
                {referenceData?.departments.filter((department) => !formData.branchId || !department.branchId || department.branchId === formData.branchId).map((department) => <option key={department.id} value={department.id}>{department.name} · {department.code}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-foreground">
              <span>{uiMessage(locale, "hrManager")}</span>
              <select name="managerId" value={formData.managerId} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
                <option value="">{uiMessage(locale, "hrNoManager")}</option>
                {referenceData?.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName} · {manager.employeeCode}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs font-semibold text-foreground">
              <span>{uiMessage(locale, "hrLinkAccount")}</span>
              <select name="userId" value={formData.userId} onChange={handleChange} className="w-full rounded-lg border border-border bg-background px-3 py-2.5">
                <option value="">{uiMessage(locale, "hrNoLinkedAccount")}</option>
                {referenceData?.availableUsers.map((account) => <option key={account.id} value={account.id}>{account.firstName} {account.lastName} · @{account.username}</option>)}
              </select>
            </label>
          </div>

          {/* تماس و مشخصات هویتی */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                کد ملی
              </label>
              <input
                type="text"
                name="nationalId"
                value={formData.nationalId}
                onChange={handleChange}
                placeholder="0012345678"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                شماره تماس
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="09120000000"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                پست الکترونیکی (ایمیل)
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="employee@domain.com"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* تاریخ‌ها */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                تاریخ استخدام <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                name="hiredAt"
                value={formData.hiredAt}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                تاریخ تولد
              </label>
              <input
                type="date"
                name="birthDate"
                value={formData.birthDate}
                onChange={handleChange}
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* آدرس و تماس اضطراری */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                تماس اضطراری
              </label>
              <input
                type="tel"
                name="emergencyPhone"
                value={formData.emergencyPhone}
                onChange={handleChange}
                placeholder="شماره تماس اقوام یا فرد رابط"
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                نشانی محل سکونت
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                placeholder="استان، شهر، خیابان..."
                className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          {/* یادداشت‌ها */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              یادداشت یا توضیحات تکمیلی
            </label>
            <textarea
              name="notes"
              rows={2}
              value={formData.notes}
              onChange={handleChange}
              placeholder="توضیحات مربوط به شرایط همکاری یا سوابق..."
              className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>ثبت کارمند</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
