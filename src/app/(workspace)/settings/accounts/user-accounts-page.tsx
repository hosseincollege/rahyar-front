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
import { settingsApi, type UserItem, type BranchItem, type DepartmentItem, type RoleItem } from '@/lib/api/settings/settings-api';

import { UserFormModal, type UserFormData } from './user-form-modal';
import { parseUsersToItems, usersImportSample } from './users-json';
import { SettingsPageToolbar } from '../components/settings-page-toolbar';

const emptyFormData: UserFormData = {
  name: '',
  username: '',
  password: '',
  email: '',
  nationalId: '',
  isSystemUser: false,
  role: 'USER',
  roleKeys: ['USER'],
  department: '',
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

function hasAdministratorRole(user: UserItem) {
  const assignedRoles = (user.roles ?? []).map((role) => typeof role === 'string' ? role : role.key);
  return [user.roleKey, user.role, ...assignedRoles].some((role) => ['ADMIN', 'SUPER_ADMIN'].includes((role ?? '').trim().toUpperCase()));
}

function getAssignedRoleKeys(user: UserItem) {
  const keys = (user.roles ?? [])
    .map((role) => typeof role === 'string' ? role : role.key)
    .map((role) => role?.trim() ?? '')
    .filter(Boolean);
  if (keys.length) return [...new Set(keys)];
  const fallback = user.roleKey?.trim() || user.role?.trim();
  return fallback ? [fallback] : ['USER'];
}

function getAssignedRoleLabels(user: UserItem, roleOptions: RoleItem[]) {
  const namesByKey = new Map(roleOptions.map((role) => [role.key, role.name]));
  return getAssignedRoleKeys(user).map((key) => {
    const roleObject = (user.roles ?? []).find((role) => typeof role !== 'string' && role.key === key);
    const objectName = roleObject && typeof roleObject !== 'string' ? roleObject.name : undefined;
    return namesByKey.get(key) || objectName || (key === user.roleKey ? user.role : undefined) || key;
  });
}

export function UserAccountsPage() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const message = (key: Parameters<typeof uiMessage>[1]) => uiMessage(locale, key);
  const formatRoleLabels = (labels: string[]) =>
    new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' }).format(labels);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [canManagePrivilegedRoles, setCanManagePrivilegedRoles] = useState(false);
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
      [user.name, user.username, user.email, user.role, user.roleKey, user.department, ...getAssignedRoleLabels(user, roles)]
        .some((value) => value?.toLocaleLowerCase(locale).includes(normalizedQuery)),
    );
  }, [locale, query, roles, users]);
  const activeUsersCount = users.filter((user) => user.isActive ?? user.status?.toUpperCase() === 'ACTIVE').length;

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setErrorMessage(uiMessage(locale, 'accountOrganizationMissing'));
        setUsers([]);
        return;
      }

      const [response, access] = await Promise.all([
        settingsApi.getUsers(organizationId),
        settingsApi.getOrganizationAccess(organizationId),
      ]);
      if (!access.canViewUsers) {
        throw new Error(uiMessage(locale, 'accountUsersViewDenied'));
      }
      const [branchOptions, departmentOptions, roleOptions] = access.canManageUsers
        ? await Promise.all([
            settingsApi.getBranches(organizationId),
            settingsApi.getDepartments(organizationId),
            settingsApi.getRoles(organizationId),
          ])
        : [[], [], []];
      setCanManage(access.canManageUsers ?? false);
      setCanManagePrivilegedRoles(access.canManageRahcom);
      setUsers(response ?? []);
      setBranches(branchOptions ?? []);
      setDepartments(departmentOptions ?? []);
      setRoles(roleOptions ?? []);
      const requestedUserId = window.location.hash.startsWith('#user-')
        ? decodeURIComponent(window.location.hash.slice('#user-'.length))
        : null;
      if (requestedUserId && response.some((user) => (user.id ?? user.username) === requestedUserId)) {
        setExpandedUserId(requestedUserId);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error, uiMessage(locale, 'accountUsersLoadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(loadTimer);
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
    setFormData(emptyFormData);
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
      nationalId: user.nationalId ?? '',
      isSystemUser: Boolean(user.isSystemUser),
      // Keep the legacy single-role fields for API compatibility while editing every membership.
      role: user.roleKey ?? user.role ?? 'USER',
      roleKeys: getAssignedRoleKeys(user),
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
    const roleKeys = [...new Set(data.roleKeys.map((key) => key.trim()).filter(Boolean))];
    const role = roleKeys[0] || data.role.trim() || 'USER';
    const department = data.department.trim();
    const password = data.password && data.password.length > 0 ? data.password : undefined;
    const { firstName, lastName } = getNameParts(name);

    if (!editingUserId && !password) {
      setErrorMessage(uiMessage(locale, 'accountPasswordCreateHint'));
      return;
    }

    if (!name || !email) {
      setErrorMessage(message('accountNameEmailRequired'));
      return;
    }

    if (roleKeys.length === 0) {
      setErrorMessage(message('accountRolesRequired'));
      return;
    }

    const emailAlreadyExists = users.some(
      (user) => user.id !== editingUserId && user.email?.trim().toLowerCase() === email,
    );
    if (emailAlreadyExists) {
      setErrorMessage(message('accountEmailAlreadyExists'));
      return;
    }

    const usernameAlreadyExists = users.some(
      (user) => user.id !== editingUserId && user.username?.trim() === username,
    );
    if (usernameAlreadyExists) {
      setErrorMessage(message('accountUsernameAlreadyExists'));
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setErrorMessage(uiMessage(locale, 'accountOrganizationMissing'));
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
            nationalId: data.nationalId.trim() || null,
            role,
            roleKey: role,
            roles: roleKeys,
            department: department || undefined,
            branchId: data.branchId || null,
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
          nationalId: data.nationalId.trim() || null,
          phone: null,
          status: data.isActive ? 'ACTIVE' : 'DISABLED',
          isSystemUser: false,
          role,
          roleKey: role,
          roles: roleKeys,
          department: department || undefined,
          branchId: data.branchId || null,
          departmentId: data.departmentId || null,
          isActive: data.isActive,
        };
        updatedUsers = [newUser, ...users];
      }

      const userToSave = editingUserId
        ? updatedUsers.find((user) => user.id === editingUserId)
        : updatedUsers[0];
      if (!userToSave) {
        throw new Error(message('accountUserSaveMissing'));
      }

      // Send only the changed account. The backend returns the current full list;
      // sending the entire page snapshot could overwrite another concurrent edit.
      const savedUsers = await settingsApi.saveUsers([userToSave], organizationId);
      setUsers(savedUsers ?? updatedUsers);
      setSuccessMessage(
        editingUserId ? message('accountUserUpdated') : message('accountUserCreated'),
      );
      setIsUserModalOpen(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, message('accountUserSaveFailed')));
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
      setErrorMessage(message('accountJsonOnly'));
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error(uiMessage(locale, 'accountOrganizationMissing'));
      }

      const text = await file.text();
      let rawData: unknown;
      try {
        rawData = JSON.parse(text);
      } catch {
        throw new Error(message('accountJsonInvalid'));
      }

      const { users: rawImportedUsers } = parseUsersToItems(rawData);

      if (!rawImportedUsers || rawImportedUsers.length === 0) {
        throw new Error(message('accountJsonNoUsers'));
      }

      const sanitizedImportedUsers: UserItem[] = rawImportedUsers.map((item) => {
        const name = item.name?.trim() || message('accountImportDefaultName');
        const email = item.email?.trim().toLowerCase() || '';
        const { firstName, lastName } = getNameParts(name);
        const role = item.role || item.roleKey || 'USER';
        const isActive = item.isActive ?? true;

        return {
          id: item.id || createUserId(),
          username: item.username?.trim() || '',
          password: item.password,
          name,
          firstName: item.firstName || firstName,
          lastName: item.lastName || lastName,
          email: email || null,
          phone: item.phone ?? null,
          nationalId: item.nationalId,
          status: isActive ? 'ACTIVE' : 'DISABLED',
          isSystemUser: Boolean(item.isSystemUser),
          role,
          roleKey: item.roleKey || role,
          roles: getAssignedRoleKeys(item),
          department: item.department || message('accountImportDefaultDepartment'),
          isActive,
        };
      });

      // Send only imported accounts. The server returns the canonical full list;
      // resending the page snapshot could overwrite concurrent edits to others.
      const savedUsers = await settingsApi.saveUsers(
        sanitizedImportedUsers,
        organizationId,
      );
      setUsers(
        Array.isArray(savedUsers)
          ? savedUsers
          : await settingsApi.getUsers(organizationId),
      );
      setSuccessMessage(message('accountImportSuccess').replace('{count}', new Intl.NumberFormat(locale).format(sanitizedImportedUsers.length)));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, message('accountImportFailed')));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    if (user.isSystemUser) {
      setErrorMessage(message('accountSystemUserDeleteDenied'));
      return;
    }

    if (!window.confirm(message('accountUserDeleteConfirm').replace('{name}', user.name || user.username))) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const organizationId = getCurrentOrganizationId();
      if (!organizationId) {
        setErrorMessage(uiMessage(locale, 'accountOrganizationMissing'));
        return;
      }

      if (!user.id) return;
      const savedUsers = await settingsApi.removeUser(organizationId, user.id);
      setUsers(savedUsers);
      setSuccessMessage(message('accountUserDeleted'));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, message('accountUserDeleteFailed')));
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

      <SettingsPageToolbar>
        {canManage && <button type="button" onClick={openCreateUserModal} disabled={isSaving} aria-label={message('accountAddUser')} title={message('accountAddUser')} className="grid size-9 shrink-0 place-items-center rounded-full border border-primary bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"><Plus className="size-4" aria-hidden="true" /></button>}
        <button type="button" onClick={handleDownloadSampleDirect} disabled={isSaving} aria-label={message('accountDownloadSample')} title={message('accountDownloadSample')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-4" aria-hidden="true" /></button>
        {canManage && <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSaving} aria-label={message('accountUploadJson')} title={message('accountUploadJson')} className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}</button>}
        <label className="rahcom-search-capsule relative block w-56 max-w-[15rem] shrink-0 rounded-full">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={message('usersSearchPlaceholder')} aria-label={message('usersSearchPlaceholder')} className="h-9 w-full rounded-full border border-border bg-background ps-9 pe-3 text-start text-sm outline-none focus:border-primary" />
        </label>
      </SettingsPageToolbar>

      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Users className="size-5 text-primary" aria-hidden="true" />
          {message('accountListTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {message('accountListDescription')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{message('usersTotal')}</p><p className="mt-2 text-2xl font-bold tabular-nums">{new Intl.NumberFormat(locale).format(users.length)}</p></article>
        <article className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{message('usersActive')}</p><p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600">{new Intl.NumberFormat(locale).format(activeUsersCount)}</p></article>
        <article className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{message('usersInactive')}</p><p className="mt-2 text-2xl font-bold tabular-nums">{new Intl.NumberFormat(locale).format(users.length - activeUsersCount)}</p></article>
      </div>

      {/* جدول فهرست کاربران */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            {message('accountLoadingUsers')}
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
            <Users className="mb-3 size-10 text-muted-foreground/50" />
            <h3 className="font-medium">{users.length === 0 ? message('accountNoUsers') : message('usersNoMatch')}</h3>
            {users.length === 0 && <p className="mt-1 text-sm text-muted-foreground">{message(canManage ? 'accountNoUsersHint' : 'accountNoUsersReadOnlyHint')}</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-start text-sm">
              <thead className="border-b bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 font-medium">{message('accountFullName')}</th>
                  <th className="px-5 py-4 font-medium">{message('accountEmailLabel')}</th>
                  <th className="px-5 py-4 font-medium">{message('usersDetailRole')}</th>
                  <th className="px-5 py-4 font-medium">{message('usersDetailDepartment')}</th>
                  <th className="px-5 py-4 font-medium">{message('usersDetailStatus')}</th>
                  {canManage && <th className="px-5 py-4 text-end font-medium">{message('accountActionsColumn')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                  {visibleUsers.map((user) => {
                    const isActive = user.isActive ?? user.status?.toUpperCase() === 'ACTIVE';
                    const isExpanded = expandedUserId === (user.id ?? user.username);
                    const assignedRoleLabels = getAssignedRoleLabels(user, roles);
                    return (
                      <React.Fragment key={user.id}>
                      <tr id={`user-${user.id ?? user.username}`}>
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
                          {assignedRoleLabels[0] || user.role || user.roleKey || message('accountNoRole')}
                        </span>
                        {assignedRoleLabels.length > 1 && <span title={formatRoleLabels(assignedRoleLabels.slice(1))} className="ms-1 inline-flex rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">+{assignedRoleLabels.length - 1}</span>}
                      </td>
                      <td className="px-5 py-4"><div>{user.department || '—'}</div>{user.branchName && <div className="mt-1 text-xs text-muted-foreground">{message('accountOffice')}: {message('organizationProvince')} {user.branchName}</div>}</td>
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
                          {canManage && (canManagePrivilegedRoles || !hasAdministratorRole(user)) && <button
                            type="button"
                            onClick={() => openEditUserModal(user)}
                            disabled={isSaving}
                            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                            title={message('accountEditUser')}
                          >
                            <Pencil className="size-4" />
                          </button>}
                          {canManage && (canManagePrivilegedRoles || !hasAdministratorRole(user)) && <button
                            type="button"
                            onClick={() => void handleDeleteUser(user)}
                            disabled={isSaving || user.isSystemUser}
                            className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                            title={user.isSystemUser ? message('accountDeleteSystemUser') : message('accountDeleteUser')}
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
                            <p><span className="text-muted-foreground">{message('usersDetailRole')}: </span>{formatRoleLabels(assignedRoleLabels) || user.role || user.roleKey || message('accountNoRole')}</p>
                            <p><span className="text-muted-foreground">{message('accountOffice')}: </span>{user.branchName ? `${message('organizationProvince')} ${user.branchName}` : '—'}</p>
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
        key={`${isUserModalOpen ? 'open' : 'closed'}:${editingUserId ?? 'new'}`}
        isOpen={isUserModalOpen}
        isSaving={isSaving}
        editingUserId={editingUserId}
        initialData={formData}
        errorMessage={errorMessage}
        onClearError={() => setErrorMessage(null)}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        branches={branches}
        departments={departments}
        roles={roles}
        canAssignAdministratorRoles={canManagePrivilegedRoles}
      />
    </section>
  );
}
