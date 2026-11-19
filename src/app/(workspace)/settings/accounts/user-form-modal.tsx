// src/app/(workspace)/settings/accounts/user-form-modal.tsx

'use client';

import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';
import type { BranchItem, DepartmentItem, RoleItem } from '@/lib/api/settings/settings-api';

export type UserFormData = {
  name: string;
  username: string;
  password?: string;
  email: string;
  nationalId: string;
  isSystemUser: boolean;
  role: string;
  roleKeys: string[];
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
  errorMessage?: string | null;
  onClearError?: () => void;
  onClose: () => void;
  onSave: (formData: UserFormData) => Promise<void>;
  branches?: BranchItem[];
  departments?: DepartmentItem[];
  roles?: RoleItem[];
  canAssignAdministratorRoles?: boolean;
}

export function UserFormModal({
  isOpen,
  isSaving,
  editingUserId,
  initialData,
  errorMessage = null,
  onClearError,
  onClose,
  onSave,
  branches = [],
  departments = [],
  roles = [],
  canAssignAdministratorRoles = false,
}: UserFormModalProps) {
  const { locale } = usePreferences();
  const [formData, setFormData] = useState<UserFormData>(initialData);
  const [showPassword, setShowPassword] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const updateFormData = (update: (current: UserFormData) => UserFormData) => {
    setFormData(update);
    onClearError?.();
  };

  const assignableRoles = roles.filter(
    (role) => canAssignAdministratorRoles || role.canAssignToUsers === true,
  );

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      modalRef.current?.querySelector<HTMLElement>('[autofocus]')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex min-h-dvh items-start justify-center overflow-y-auto bg-transparent p-3 sm:items-center sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !isSaving) onClose();
        if (e.key !== 'Tab') return;
        const focusable = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ) ?? [],
        ).filter((element) => !element.matches(':disabled') && element.getClientRects().length > 0);
        if (!focusable.length) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-form-title"
        aria-describedby={errorMessage ? 'user-form-description user-form-error' : 'user-form-description'}
        tabIndex={-1}
        className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xl outline-none sm:max-h-[calc(100dvh-2.5rem)] sm:p-6"
        style={{
          backgroundColor: 'var(--surface-elevated)',
          color: 'var(--foreground)',
          borderColor: 'var(--border)',
        }}
        dir={getLocaleDirection(locale)}
      >
        <div className="mb-5 flex items-center justify-between border-b pb-4">
          <div>
            <h3 id="user-form-title" className="text-lg font-semibold">
              {uiMessage(locale, editingUserId ? 'accountFormEditTitle' : 'accountFormCreateTitle')}
            </h3>
            <p id="user-form-description" className="mt-1 text-sm text-muted-foreground">
              {uiMessage(locale, 'accountFormDescription')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label={uiMessage(locale, 'accountFormClose')}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {errorMessage && (
            <div
              id="user-form-error"
              role="alert"
              aria-live="assertive"
              className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          )}
          <div>
            <label htmlFor="modal-user-name" className="mb-1.5 block text-sm font-medium">
              {uiMessage(locale, 'accountFullName')}
            </label>
            <input
              id="modal-user-name"
              value={formData.name}
              onChange={(e) => updateFormData((cur) => ({ ...cur, name: e.target.value }))}
              required
              autoFocus
              placeholder={uiMessage(locale, 'accountFullNamePlaceholder')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-user-username" className="mb-1.5 block text-sm font-medium">
                {uiMessage(locale, 'accountUsernameLabel')}
              </label>
              <input
                id="modal-user-username"
                dir="ltr"
                value={formData.username}
                onChange={(e) => updateFormData((cur) => ({ ...cur, username: e.target.value }))}
                placeholder={uiMessage(locale, 'accountUsernamePlaceholder')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label htmlFor="modal-user-email" className="mb-1.5 block text-sm font-medium">
                {uiMessage(locale, 'accountEmailLabel')}
              </label>
              <input
                id="modal-user-email"
                type="email"
                dir="ltr"
                value={formData.email}
                onChange={(e) => updateFormData((cur) => ({ ...cur, email: e.target.value }))}
                required
                placeholder="user@example.com"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
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
              onChange={(e) => updateFormData((cur) => ({ ...cur, nationalId: e.target.value }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label htmlFor="modal-user-password" className="mb-1.5 block text-sm font-medium">
              {uiMessage(locale, 'accountPassword')} {editingUserId && <span className="text-xs font-normal text-muted-foreground">({uiMessage(locale, 'accountPasswordOptional')})</span>}
            </label>
            <div className="relative">
              <input
                id="modal-user-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                value={formData.password ?? ''}
                onChange={(e) => updateFormData((cur) => ({ ...cur, password: e.target.value }))}
                required={!editingUserId}
                minLength={8}
                autoComplete="new-password"
                placeholder={uiMessage(locale, editingUserId ? 'accountPasswordChangePlaceholder' : 'accountPasswordCreatePlaceholder')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pe-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={uiMessage(locale, showPassword ? 'accountHidePassword' : 'accountShowPassword')}
                aria-pressed={showPassword}
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
              <label htmlFor="modal-user-department" className="mb-1.5 block text-sm font-medium">
                {uiMessage(locale, 'accountOffice')}
              </label>
              <select
                id="modal-user-department"
                value={formData.branchId ?? ''}
                onChange={(e) => updateFormData((cur) => ({ ...cur, branchId: e.target.value, departmentId: '', department: '' }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="">{uiMessage(locale, 'accountNoOffice')}</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{uiMessage(locale, 'organizationProvince')} {branch.name}</option>)}
              </select>
            </div>
          </div>

          <fieldset disabled={formData.isSystemUser} className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">{uiMessage(locale, 'accountAssignedRoles')}</legend>
            <p className="text-xs text-muted-foreground">{uiMessage(locale, 'accountRolesHint')}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {assignableRoles.map((role) => (
                  <label key={role.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={formData.roleKeys.includes(role.key)}
                      onChange={(event) => updateFormData((current) => {
                        const roleKeys = event.target.checked
                          ? [...new Set([...current.roleKeys, role.key])]
                          : current.roleKeys.filter((key) => key !== role.key);
                        return { ...current, roleKeys, role: roleKeys[0] ?? '' };
                      })}
                      className="size-4 shrink-0 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              {formData.roleKeys
                .filter((key) => !assignableRoles.some((role) => role.key === key))
                .map((key) => (
                  <label key={key} title={roles.find((role) => role.key === key)?.name ?? key} className="flex min-h-10 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked disabled className="size-4 shrink-0 rounded border-border" />
                    <span>{roles.find((role) => role.key === key)?.name ?? key}</span>
                  </label>
                ))}
            </div>
            {formData.isSystemUser && <p className="text-xs text-muted-foreground">{uiMessage(locale, 'accountOwnerRoleProtected')}</p>}
          </fieldset>
          <div>
            <label htmlFor="modal-user-unit" className="mb-1.5 block text-sm font-medium">{uiMessage(locale, 'accountOrgUnit')}</label>
            <select id="modal-user-unit" value={formData.departmentId ?? ''} onChange={(e) => updateFormData((cur) => { const unit = departments.find((item) => item.id === e.target.value); return { ...cur, departmentId: e.target.value, department: unit?.name ?? '', branchId: unit?.branchId ?? cur.branchId }; })} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
              <option value="">{uiMessage(locale, 'accountNoUnit')}</option>
              {departments.filter((item) => !formData.branchId || item.branchId === formData.branchId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3">
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => updateFormData((cur) => ({ ...cur, isActive: e.target.checked }))}
              disabled={formData.isSystemUser}
              className="size-4 rounded border"
            />
            <span>
              <span className="block text-sm font-medium">{uiMessage(locale, 'accountActiveLabel')}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {uiMessage(locale, 'accountInactiveHint')}
              </span>
            </span>
          </label>
          {formData.isSystemUser && <p className="-mt-3 text-xs text-muted-foreground">{uiMessage(locale, 'accountOwnerStatusProtected')}</p>}

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              {uiMessage(locale, 'accountCancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {uiMessage(locale, editingUserId ? 'accountSaveButton' : 'accountCreateButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
