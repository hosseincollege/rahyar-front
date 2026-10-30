// src/app/(workspace)/settings/accounts/user-form-modal.tsx

'use client';

import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { BranchItem, DepartmentItem, RoleItem } from '@/app/(workspace)/settings/settings-api';

export type UserFormData = {
  name: string;
  username: string;
  password?: string;
  email: string;
  nationalId: string;
  isSystemUser: boolean;
  role: string;
  department: string;
  branchId?: string;
  departmentId?: string;
  isActive: boolean;
};

interface UserFormModalProps {
  isOpen: boolean;
  isSaving: boolean;
  editingUserId: string | null;
  initialData: UserFormData;
  onClose: () => void;
  onSave: (formData: UserFormData) => Promise<void>;
  branches?: BranchItem[];
  departments?: DepartmentItem[];
  roles?: RoleItem[];
}

export function UserFormModal({
  isOpen,
  isSaving,
  editingUserId,
  initialData,
  onClose,
  onSave,
  branches = [],
  departments = [],
  roles = [],
}: UserFormModalProps) {
  const { locale } = usePreferences();
  const [formData, setFormData] = useState<UserFormData>(initialData);
  const [showPassword, setShowPassword] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFormData(initialData);
    setShowPassword(false);
  }, [initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isSaving) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-2xl outline-none"
        dir={getLocaleDirection(locale)}
      >
        <div className="mb-5 flex items-center justify-between border-b pb-4">
          <div>
            <h3 className="text-lg font-semibold">
              {editingUserId ? 'ویرایش کاربر' : 'افزودن کاربر جدید'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              اطلاعات کاربر، رمز عبور و وضعیت دسترسی او را مشخص کنید.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="modal-user-name" className="mb-1.5 block text-sm font-medium">
              نام و نام خانوادگی
            </label>
            <input
              id="modal-user-name"
              value={formData.name}
              onChange={(e) => setFormData((cur) => ({ ...cur, name: e.target.value }))}
              required
              autoFocus
              placeholder="مثلاً: علی رضایی"
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-user-username" className="mb-1.5 block text-sm font-medium">
                نام کاربری
              </label>
              <input
                id="modal-user-username"
                dir="ltr"
                value={formData.username}
                onChange={(e) => setFormData((cur) => ({ ...cur, username: e.target.value }))}
                placeholder="اختیاری (پیش‌فرض: ایمیل)"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label htmlFor="modal-user-email" className="mb-1.5 block text-sm font-medium">
                ایمیل
              </label>
              <input
                id="modal-user-email"
                type="email"
                dir="ltr"
                value={formData.email}
                onChange={(e) => setFormData((cur) => ({ ...cur, email: e.target.value }))}
                required
                placeholder="user@example.com"
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="modal-user-national-id" className="mb-1.5 block text-sm font-medium">
              {uiMessage(locale, 'accountNationalId')}
            </label>
            <input
              id="modal-user-national-id"
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              value={formData.nationalId}
              onChange={(e) => setFormData((cur) => ({ ...cur, nationalId: e.target.value }))}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label htmlFor="modal-user-password" className="mb-1.5 block text-sm font-medium">
              رمز عبور {editingUserId && <span className="text-xs text-muted-foreground font-normal">(در صورت تمایل به تغییر وارد کنید)</span>}
            </label>
            <div className="relative">
              <input
                id="modal-user-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                value={formData.password ?? ''}
                onChange={(e) => setFormData((cur) => ({ ...cur, password: e.target.value }))}
                required={!editingUserId}
                autoComplete="new-password"
                placeholder={uiMessage(locale, editingUserId ? 'accountPasswordChangePlaceholder' : 'accountPasswordCreatePlaceholder')}
                className="w-full rounded-lg border bg-background px-3 py-2.5 pe-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {uiMessage(locale, editingUserId ? 'accountPasswordEditHint' : 'accountPasswordCreateHint')}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-user-role" className="mb-1.5 block text-sm font-medium">
                نقش
              </label>
              <select
                id="modal-user-role"
                value={formData.role}
                onChange={(e) => setFormData((cur) => ({ ...cur, role: e.target.value }))}
                required
                disabled={formData.isSystemUser}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {roles.map((role) => <option key={role.id} value={role.key}>{role.name}</option>)}
                {!roles.length && <option value={formData.role}>{formData.role || 'USER'}</option>}
              </select>
              {formData.isSystemUser && <p className="mt-1 text-xs text-muted-foreground">{uiMessage(locale, 'accountOwnerRoleProtected')}</p>}
            </div>

            <div>
              <label htmlFor="modal-user-department" className="mb-1.5 block text-sm font-medium">
                {uiMessage(locale, 'accountOffice')}
              </label>
              <select
                id="modal-user-department"
                value={formData.branchId ?? ''}
                onChange={(e) => setFormData((cur) => ({ ...cur, branchId: e.target.value, departmentId: '' }))}
                className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">{uiMessage(locale, 'accountNoOffice')}</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{uiMessage(locale, 'organizationProvince')} {branch.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="modal-user-unit" className="mb-1.5 block text-sm font-medium">{uiMessage(locale, 'accountOrgUnit')}</label>
            <select id="modal-user-unit" value={formData.departmentId ?? ''} onChange={(e) => setFormData((cur) => { const unit = departments.find((item) => item.id === e.target.value); return { ...cur, departmentId: e.target.value, department: unit?.name ?? '', branchId: unit?.branchId ?? cur.branchId }; })} className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
              <option value="">{uiMessage(locale, 'accountNoUnit')}</option>
              {departments.filter((item) => !formData.branchId || item.branchId === formData.branchId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData((cur) => ({ ...cur, isActive: e.target.checked }))}
              disabled={formData.isSystemUser}
              className="size-4 rounded border"
            />
            <span>
              <span className="block text-sm font-medium">کاربر فعال باشد</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                کاربران غیرفعال امکان استفاده از حساب را نخواهند داشت.
              </span>
            </span>
          </label>
          {formData.isSystemUser && <p className="-mt-3 text-xs text-muted-foreground">{uiMessage(locale, 'accountOwnerStatusProtected')}</p>}

          <div className="flex justify-end gap-2 border-t pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {editingUserId ? 'ذخیره تغییرات' : 'ایجاد کاربر'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
