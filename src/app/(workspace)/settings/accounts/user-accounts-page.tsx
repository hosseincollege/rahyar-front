// صفحه مدیریت حساب‌های کاربری سازمان.

'use client';

import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getLocaleDirection, usePreferences } from '@/components/preferences-provider';
import { uiMessage } from '@/lib/ui-messages';

import { getCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import { settingsApi, type UserItem } from '@/lib/api/settings/settings-api';

import { UserFormModal, type UserFormData } from './user-form-modal';
import { parseUsersToItems, usersImportSample } from './users-json';

const emptyFormData: UserFormData = {
  name: '',
  username: '',
  password: '',
  email: '',
  role: 'USER',
  department: '',
  branchId: '',
  departmentId: '',
  isActive: true,
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function createUserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getNameParts(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

export function UserAccountsPage() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [teams, setTeams] = useState<Array<{ id: string; name: string; branchId?: string }>>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [formData, setFormData] = useState<UserFormData>(emptyFormData);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // رفرنس برای اینپوت مخفی فایل
  const fileInputRef = useRef<HTMLInputElement>(null);
  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(locale);
    if (!normalizedQuery) return users;
    return users.filter((user) =>
      [user.name, user.username, user.email, user.role, user.roleKey, user.department]
        .some((value) => value?.toLocaleLowerCase(locale).includes(normalizedQuery)),
    );
  }, [locale, query, users]);
  const activeUsersCount = users.filter((user) => user.isActive ?? user.status?.toUpperCase() === 'ACTIVE').length;

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setErrorMessage('شناسه سازمان یافت نشد. لطفاً مجدداً وارد سیستم شوید.');
        setUsers([]);
        return;
      }

      const [response, access, provinceOptions, teamOptions] = await Promise.all([
        settingsApi.getUsers(organizationId),
        settingsApi.getOrganizationAccess(organizationId),
        settingsApi.getBranches(organizationId),
        settingsApi.getDepartments(organizationId),
      ]);
      if (!access.canView) {
        throw new Error('مجوز مشاهده کاربران این سازمان را ندارید.');
      }
      setCanManage(access.canManageUsers ?? access.canEdit);
      setIsAdmin(access.isAdmin ?? access.canEdit);
      setCurrentBranchId(access.branchId ?? null);
      setBranches(provinceOptions.map(({ id, name }) => ({ id, name })));
      setTeams(teamOptions.map(({ id, name, branchId }) => ({ id, name, branchId })));
      setUsers(response ?? []);
      const requestedUserId = window.location.hash.startsWith('#user-')
        ? decodeURIComponent(window.location.hash.slice('#user-'.length))
        : null;
      if (requestedUserId && response.some((user) => (user.id ?? user.username) === requestedUserId)) {
        setExpandedUserId(requestedUserId);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'بارگذاری فهرست کاربران با خطا مواجه شد.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!successMessage) return;
    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [successMessage]);

  // دانلود مستقیم فایل نمونه JSON
  const handleDownloadSampleDirect = () => {
    const blob = new Blob([JSON.stringify(usersImportSample, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'users-import-sample.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const openCreateUserModal = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingUserId(null);
    setFormData({ ...emptyFormData, branchId: isAdmin ? '' : currentBranchId ?? '' });
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: UserItem) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setEditingUserId(user.id ?? null);
    setFormData({
      name: user.name ?? '',
      username: user.username ?? '',
      password: '',
      email: user.email ?? '',
      role: user.roleKey ?? user.role ?? 'USER',
      department: user.department ?? '',
      branchId: user.branchId ?? '',
      departmentId: user.departmentId ?? '',
      isActive: user.isActive ?? user.status === 'ACTIVE',
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (data: UserFormData) => {
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const username = data.username.trim() || email.split('@')[0];
    const role = isAdmin ? data.role.trim() || 'USER' : 'USER';
    const department = data.department.trim();
    const password = data.password?.trim() ? data.password.trim() : undefined;
    const { firstName, lastName } = getNameParts(name);

    if (!name || !email) {
      setErrorMessage('نام و ایمیل کاربر الزامی است.');
      return;
    }

    const emailAlreadyExists = users.some(
      (user) => user.id !== editingUserId && user.email?.trim().toLowerCase() === email,
    );
    if (emailAlreadyExists) {
      setErrorMessage('کاربری با این ایمیل قبلاً ثبت شده است.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setErrorMessage('شناسه سازمان یافت نشد. لطفاً مجدداً وارد شوید.');
        return;
      }

      let updatedUsers: UserItem[];

      if (editingUserId) {
        updatedUsers = users.map((user) => {
          if (user.id !== editingUserId) return user;
          return {
            ...user,
            name,
            username,
            firstName,
            lastName,
            email,
            role,
            roleKey: role,
            department: department || undefined,
            branchId: data.branchId,
            departmentId: data.departmentId || null,
            isActive: data.isActive,
            status: data.isActive ? 'ACTIVE' : 'DISABLED',
            ...(password ? { password } : {}),
          };
        });
      } else {
        const newUser: UserItem = {
          id: createUserId(),
          username,
          password,
          name,
          firstName,
          lastName,
          email,
          phone: null,
          status: data.isActive ? 'ACTIVE' : 'DISABLED',
          isSystemUser: false,
          role,
          roleKey: role,
          roles: [],
          department: department || undefined,
          branchId: data.branchId,
          departmentId: data.departmentId || null,
          isActive: data.isActive,
        };
        updatedUsers = [newUser, ...users];
      }

      const usersToSave = isAdmin ? updatedUsers : updatedUsers.filter((user) => user.branchId === currentBranchId);
      const savedUsers = await settingsApi.saveUsers(usersToSave, organizationId);
      setUsers(savedUsers ?? updatedUsers);
      setSuccessMessage(
        editingUserId ? 'اطلاعات کاربر با موفقیت به‌روزرسانی شد.' : 'کاربر جدید با موفقیت ایجاد شد.',
      );
      setIsUserModalOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'ذخیره اطلاعات کاربر با خطا مواجه شد.'));
    } finally {
      setIsSaving(false);
    }
  };

  // پردازش مستقیم فایل انتخابی
  const handleDirectFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // پاکسازی مقدار اینپوت تا در دفعات بعدی با همان فایل نیز trigger شود
    event.target.value = '';

    if (!file.name.toLowerCase().endsWith('.json')) {
      setErrorMessage('لطفاً فقط یک فایل با فرمت JSON انتخاب کنید.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error('شناسه سازمان یافت نشد. لطفاً مجدداً وارد شوید.');
      }

      const text = await file.text();
      let rawData: unknown;
      try {
        rawData = JSON.parse(text);
      } catch {
        throw new Error('ساختار فایل JSON نامعتبر است.');
      }

      const { users: rawImportedUsers } = parseUsersToItems(rawData);

      if (!rawImportedUsers || rawImportedUsers.length === 0) {
        throw new Error('هیچ کاربر معتبری در فایل انتخاب‌شده پیدا نشد.');
      }

      const sanitizedImportedUsers: UserItem[] = rawImportedUsers.map((item) => {
        const name = item.name?.trim() || 'کاربر جدید';
        const email = item.email?.trim().toLowerCase() || '';
        const { firstName, lastName } = getNameParts(name);
        const role = item.role || item.roleKey || 'USER';
        const isActive = item.isActive ?? true;

        return {
          id: item.id || createUserId(),
          username: item.username || (email ? email.split('@')[0] : `user_${Date.now()}`),
          password: item.password,
          name,
          firstName: item.firstName || firstName,
          lastName: item.lastName || lastName,
          email: email || null,
          phone: item.phone ?? null,
          status: isActive ? 'ACTIVE' : 'DISABLED',
          isSystemUser: Boolean(item.isSystemUser),
          role,
          roleKey: item.roleKey || role,
          roles: Array.isArray(item.roles) ? item.roles : [],
          department: item.department || 'عمومی',
          branchId: item.branchId ?? '',
          departmentId: item.departmentId ?? '',
          isActive,
        };
      });

      const importedIds = new Set(sanitizedImportedUsers.map((u) => u.id));
      const importedEmails = new Set(
        sanitizedImportedUsers.map((u) => u.email?.trim().toLowerCase()).filter(Boolean),
      );

      const remainingUsers = users.filter((u) => {
        const normalized = u.email?.trim().toLowerCase();
        return !importedIds.has(u.id) && (!normalized || !importedEmails.has(normalized));
      });

      const updatedUsers = [...sanitizedImportedUsers, ...remainingUsers];
      const savedUsers = await settingsApi.saveUsers(updatedUsers, organizationId);

      setUsers(savedUsers ?? updatedUsers);
      setSuccessMessage(`${sanitizedImportedUsers.length} کاربر با موفقیت درون‌ریزی و ذخیره شدند.`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'درون‌ریزی فایل کاربران با خطا مواجه شد.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (user.isSystemUser) {
      setErrorMessage('حذف کاربر سیستمی مجاز نیست.');
      return;
    }

    if (!window.confirm(`آیا از حذف کاربر «${user.name || user.username}» مطمئن هستید؟`)) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setErrorMessage('شناسه سازمان یافت نشد. لطفاً مجدداً وارد شوید.');
        return;
      }

      const updatedUsers = users.filter((item) => item.id !== user.id);
      const usersToSave = isAdmin ? updatedUsers : updatedUsers.filter((item) => item.branchId === currentBranchId);
      const savedUsers = await settingsApi.saveUsers(usersToSave, organizationId);
      setUsers(savedUsers ?? updatedUsers);
      setSuccessMessage('کاربر با موفقیت حذف شد.');
    } catch (error) {
      setErrorMessage(getErrorMessage(error, 'حذف کاربر با خطا مواجه شد.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-5" dir={direction}>
      {/* اینپوت مخفی برای انتخاب مستقیم فایل JSON */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleDirectFileChange}
      />

      {/* پیام خطا */}
      {errorMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
          <p className="flex-1 text-sm">{errorMessage}</p>
          <button type="button" onClick={() => setErrorMessage(null)} className="rounded p-1 hover:bg-red-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* پیام موفقیت */}
      {successMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          <p className="flex-1 text-sm">{successMessage}</p>
          <button type="button" onClick={() => setSuccessMessage(null)} className="rounded p-1 hover:bg-emerald-100">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* هدر و دکمه‌های نوار ابزار */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="size-5 text-primary" />
            مدیریت کاربران
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            ایجاد، ویرایش، حذف و مدیریت دسته‌جمعی اطلاعات کاربران سازمان
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={openCreateUserModal}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="size-4" />
              افزودن کاربر
            </button>
          )}

          {isAdmin && <button
            type="button"
            onClick={handleDownloadSampleDirect}
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
            title="دانلود ساختار نمونه JSON"
          >
            <Download className="size-4" />
            دانلود فایل نمونه
          </button>}

          {isAdmin && (
            <button
                type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
              title="انتخاب و درون‌ریزی مستقیم فایل JSON"
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              بارگذاری فایل JSON
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{message('usersTotal')}</p><p className="mt-2 text-2xl font-bold tabular-nums">{new Intl.NumberFormat(locale).format(users.length)}</p></article>
        <article className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{message('usersActive')}</p><p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600">{new Intl.NumberFormat(locale).format(activeUsersCount)}</p></article>
        <article className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{message('usersInactive')}</p><p className="mt-2 text-2xl font-bold tabular-nums">{new Intl.NumberFormat(locale).format(users.length - activeUsersCount)}</p></article>
      </div>

      {/* جدول فهرست کاربران */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="border-b border-border p-3 sm:p-4">
          <label className="relative block max-w-md">
            <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={message('usersSearchPlaceholder')} className="h-10 w-full rounded-xl border border-border bg-background ps-9 pe-3 text-start text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
          </label>
        </div>
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            در حال دریافت فهرست کاربران...
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
            <Users className="mb-3 size-10 text-muted-foreground/50" />
            <h3 className="font-medium">{users.length === 0 ? 'هنوز کاربری ثبت نشده است' : message('usersNoMatch')}</h3>
            {users.length === 0 && <p className="mt-1 text-sm text-muted-foreground">می‌توانید کاربر جدید ایجاد کنید یا از طریق دکمه «بارگذاری فایل JSON» کاربران را وارد نمایید.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 font-medium">کاربر</th>
                  <th className="px-5 py-4 font-medium">ایمیل</th>
                  <th className="px-5 py-4 font-medium">نقش</th>
                  <th className="px-5 py-4 font-medium">بخش</th>
                  <th className="px-5 py-4 font-medium">وضعیت</th>
                  {canManage && <th className="px-5 py-4 text-end font-medium">عملیات</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                  {visibleUsers.map((user) => {
                    const isActive = user.isActive ?? user.status?.toUpperCase() === 'ACTIVE';
                    const isExpanded = expandedUserId === (user.id ?? user.username);
                    return (
                      <React.Fragment key={user.id}>
                      <tr id={`user-${user.id ?? user.username}`} className="transition hover:bg-muted/30">
                        <td className="px-5 py-4">
                          <Link
                            href={`/settings/accounts#user-${encodeURIComponent(user.id ?? user.username)}`}
                            onClick={() => setExpandedUserId(user.id ?? user.username)}
                            className="font-medium underline-offset-4 hover:text-primary hover:underline"
                          >
                            {user.name || user.username}
                          </Link>
                        <div className="mt-1 text-xs text-muted-foreground" dir="ltr">
                          @{user.username}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground" dir="ltr">
                        {user.email || '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {user.role || user.roleKey || 'بدون نقش'}
                        </span>
                      </td>
                      <td className="px-5 py-4">{user.department || '—'}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {isActive ? message('usersActive') : message('usersInactive')}
                        </span>
                      </td>
                      {canManage && <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && (isAdmin || user.branchId === currentBranchId) && <button
                            type="button"
                            onClick={() => openEditUserModal(user)}
                            disabled={isSaving}
                            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title="ویرایش کاربر"
                          >
                            <Pencil className="size-4" />
                          </button>}
                          {canManage && (isAdmin || user.branchId === currentBranchId) && <button
                            type="button"
                            onClick={() => void handleDeleteUser(user)}
                            disabled={isSaving || user.isSystemUser}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            title={user.isSystemUser ? 'حذف کاربر سیستمی مجاز نیست' : 'حذف کاربر'}
                          >
                            <Trash2 className="size-4" />
                          </button>}
                        </div>
                      </td>}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-muted/20">
                        <td colSpan={canManage ? 6 : 5} className="px-5 py-4">
                          <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                            <p><span className="text-muted-foreground">{message('usersDetailName')}: </span>{user.name || user.username}</p>
                            <p dir="ltr" className="text-start"><span className="text-muted-foreground">{message('usersDetailEmail')}: </span>{user.email || '—'}</p>
                            <p dir="ltr" className="text-start"><span className="text-muted-foreground">{message('usersDetailUsername')}: </span>{user.username}</p>
                            <p><span className="text-muted-foreground">{message('usersDetailRole')}: </span>{user.role || user.roleKey || 'بدون نقش'}</p>
                            <p><span className="text-muted-foreground">{message('usersDetailDepartment')}: </span>{user.department || '—'}</p>
                            <p><span className="text-muted-foreground">{message('usersDetailStatus')}: </span>{isActive ? message('usersActive') : message('usersInactive')}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* مودال ایجاد/ویرایش تکی کاربر */}
      <UserFormModal
        isOpen={isUserModalOpen}
        isSaving={isSaving}
        editingUserId={editingUserId}
        initialData={formData}
        branches={branches}
        teams={teams}
        isAdmin={isAdmin}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
      />
    </section>
  );
}
