// صفحه مدیریت نقش‌ها و دسترسی‌ها.
// مدیریت نقش‌ها، دسترسی‌ها و بارگذاری JSON سازمان جاری

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  CheckSquare,
  FileSpreadsheet,
  Key,
  Plus,
  ShieldCheck,
  Square,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

import { getCurrentOrganizationId } from "@/lib/api/shared/auth-api";
import {
  getRoles,
  saveRoles,
  type RoleItem,
} from "@/app/(workspace)/settings/settings-api";
import {
  usePreferences,
  getLocaleDirection,
} from "@/components/preferences-provider";
import { uiMessage } from "@/lib/ui-messages";
import type { UiMessage } from "@/languages/types";
import {
  parseRolesImportData,
  rolesImportDataToItems,
  rolesImportSample,
} from "./roles-json";

type EditableRole = {
  id?: string;
  localId?: string;
  key?: string;
  name: string;
  description: string;
  permissions: string[];
  userCount?: number;
  isSystemRole?: boolean;
};

type LocalizedNotice = {
  key: UiMessage;
  values?: Record<string, string>;
};

type RolePayload = {
  id?: string;
  key?: string;
  name: string;
  description?: string;
  permissions: string[];
};

function toRolePayload(role: EditableRole): RolePayload {
  return {
    ...(role.id ? { id: role.id } : {}),
    ...(role.key ? { key: role.key } : {}),
    name: role.name,
    ...(role.description ? { description: role.description } : {}),
    permissions: [...role.permissions],
  };
}

function serializeRoles(roles: EditableRole[]) {
  return JSON.stringify(roles.map(toRolePayload));
}

const PERMISSION_OPTIONS: { key: string; label: UiMessage }[] = [
  { key: "dashboard.view", label: "permissionView" },
  { key: "users.read", label: "permissionView" },
  { key: "users.write", label: "permissionManage" },
  { key: "roles.read", label: "permissionView" },
  { key: "roles.write", label: "permissionManage" },
  { key: "settings.read", label: "permissionView" },
  { key: "settings.write", label: "permissionManage" },
  { key: "accounting.read", label: "permissionView" },
  { key: "accounting.write", label: "permissionManage" },
  { key: "hr.read", label: "permissionView" },
  { key: "hr.write", label: "permissionManage" },
  { key: "hr.employees.read", label: "permissionView" },
  { key: "hr.employees.write", label: "permissionManage" },
  { key: "hr.leaves.read", label: "permissionView" },
  { key: "hr.leaves.write", label: "permissionManage" },
  { key: "hr.leaves.approve", label: "permissionManage" },
  { key: "hr.attendance.read", label: "permissionView" },
  { key: "hr.attendance.write", label: "permissionManage" },
  { key: "hr.payroll.read", label: "permissionView" },
  { key: "hr.payroll.write", label: "permissionManage" },
  { key: "inventory.read", label: "permissionView" },
  { key: "inventory.write", label: "permissionManage" },
  { key: "reports.sales.read", label: "permissionView" },
  { key: "announcements.write", label: "permissionManage" },
];

const PERMISSION_GROUPS: { label: UiMessage; permissionKeys: string[] }[] = [
  { label: "permissionGroupDashboard", permissionKeys: ["dashboard.view"] },
  {
    label: "permissionGroupUsers",
    permissionKeys: ["users.read", "users.write"],
  },
  {
    label: "permissionGroupRoles",
    permissionKeys: ["roles.read", "roles.write"],
  },
  {
    label: "permissionGroupOrganization",
    permissionKeys: ["settings.read", "settings.write"],
  },
  {
    label: "permissionGroupFinance",
    permissionKeys: ["accounting.read", "accounting.write"],
  },
  {
    label: "permissionGroupHr",
    permissionKeys: [
      "hr.read",
      "hr.write",
      "hr.employees.read",
      "hr.employees.write",
      "hr.leaves.read",
      "hr.leaves.write",
      "hr.leaves.approve",
      "hr.attendance.read",
      "hr.attendance.write",
      "hr.payroll.read",
      "hr.payroll.write",
    ],
  },
  {
    label: "permissionGroupInventory",
    permissionKeys: ["inventory.read", "inventory.write"],
  },
  {
    label: "permissionGroupSalesReports",
    permissionKeys: ["reports.sales.read"],
  },
  {
    label: "permissionGroupAnnouncements",
    permissionKeys: ["announcements.write"],
  },
];

function createNewRole(name: string): EditableRole {
  return {
    localId: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name,
    description: "",
    permissions: ["dashboard.view"],
  };
}

function normalizeRole(role: RoleItem): EditableRole {
  const value = role as RoleItem & {
    id?: string;
    key?: string;
    name?: string;
    description?: string;
    permissions?: string[];
    userCount?: number;
  };

  return {
    id: value.id,
    key: value.key,
    name: value.name ?? "",
    description: value.description ?? "",
    permissions: Array.isArray(value.permissions) ? value.permissions : [],
    userCount: value.userCount,
    isSystemRole: Boolean((value as { isSystemRole?: boolean }).isSystemRole),
  };
}

export function RolesManagementPage() {
  const { locale } = usePreferences();
  const direction = getLocaleDirection(locale);
  const message = (key: UiMessage) => uiMessage(locale, key);
  const [roles, setRoles] = useState<EditableRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedRoles, setHasLoadedRoles] = useState(false);
  const [savedRolesSnapshot, setSavedRolesSnapshot] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<UiMessage | null>(null);
  const [successMessage, setSuccessMessage] = useState<LocalizedNotice | null>(
    null,
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const organizationId = getCurrentOrganizationId();
  const hasUnsavedChanges =
    hasLoadedRoles && serializeRoles(roles) !== savedRolesSnapshot;
  const formatCount = (count: number) =>
    new Intl.NumberFormat(locale).format(count);
  const formatNotice = (notice: LocalizedNotice) =>
    Object.entries(notice.values ?? {}).reduce(
      (text, [key, value]) => text.replace(`{${key}}`, value),
      message(notice.key),
    );

  const loadRoles = useCallback(async () => {
    if (!organizationId) {
      setRoles([]);
      setHasLoadedRoles(false);
      setErrorMessage("rolesMissingOrganization");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await getRoles(organizationId);
      const receivedRoles = Array.isArray(response) ? response : [];

      const normalizedRoles = receivedRoles.map(normalizeRole);
      setRoles(normalizedRoles);
      setSavedRolesSnapshot(serializeRoles(normalizedRoles));
      setHasLoadedRoles(true);
    } catch (error) {
      console.error("Failed to load roles:", error);
      setRoles([]);
      setHasLoadedRoles(false);
      setErrorMessage("rolesLoadFailed");
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const kickoff = window.setTimeout(() => void loadRoles(), 0);
    return () => window.clearTimeout(kickoff);
  }, [loadRoles]);

  function handleAddRole() {
    setRoles((currentRoles) => [
      ...currentRoles,
      createNewRole(message("newRoleName")),
    ]);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleRoleFieldChange(
    roleIndex: number,
    field: "name" | "description",
    value: string,
  ) {
    setRoles((currentRoles) =>
      currentRoles.map((role, index) => {
        if (index !== roleIndex || role.isSystemRole) return role;
        return {
          ...role,
          [field]: value,
        };
      }),
    );

    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handlePermissionToggle(roleIndex: number, permissionKey: string) {
    setRoles((currentRoles) =>
      currentRoles.map((role, index) => {
        if (index !== roleIndex || role.isSystemRole) return role;

        const hasPermission = role.permissions.includes(permissionKey);

        return {
          ...role,
          permissions: hasPermission
            ? role.permissions.filter((p) => p !== permissionKey)
            : [...role.permissions, permissionKey],
        };
      }),
    );

    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleDeleteRole(roleIndex: number) {
    const role = roles[roleIndex];
    if (!role || role.isSystemRole) return;
    if ((role.userCount ?? 0) > 0) {
      setErrorMessage("roleHasUsers");
      return;
    }

    setRoles((currentRoles) =>
      currentRoles.filter((_, index) => index !== roleIndex),
    );

    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSave() {
    if (!organizationId) {
      setErrorMessage("rolesMissingOrganization");
      return;
    }

    const hasEmptyRoleName = roles.some(
      (role) => role.name.trim().length === 0,
    );

    if (hasEmptyRoleName) {
      setErrorMessage("roleNameRequired");
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const payload = roles
        .filter((role) => !role.isSystemRole)
        .map(toRolePayload);
      const saved = await saveRoles(
        payload as unknown as RoleItem[],
        organizationId,
      );
      const normalizedRoles = (Array.isArray(saved) ? saved : []).map(
        normalizeRole,
      );
      setRoles(normalizedRoles);
      setSavedRolesSnapshot(serializeRoles(normalizedRoles));
      setHasLoadedRoles(true);
      setSuccessMessage({ key: "rolesSaved" });
    } catch (error) {
      console.error("Failed to save roles:", error);
      setErrorMessage("rolesSaveFailed");
    } finally {
      setIsSaving(false);
    }
  }

  function togglePermissionGroup(roleIndex: number, permissionKeys: string[]) {
    setRoles((currentRoles) =>
      currentRoles.map((role, index) => {
        if (index !== roleIndex || role.isSystemRole) return role;
        const allSelected = permissionKeys.every((key) =>
          role.permissions.includes(key),
        );
        const retained = role.permissions.filter(
          (key) => !permissionKeys.includes(key),
        );
        return {
          ...role,
          permissions: allSelected
            ? retained
            : [...retained, ...permissionKeys],
        };
      }),
    );
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleDownloadSample() {
    const localizedSample = {
      ...rolesImportSample,
      roles: rolesImportSample.roles.map((role) => ({
        ...role,
        name: message("roleNamePlaceholder"),
        description: message("roleDescriptionPlaceholder"),
      })),
    };
    const jsonString = JSON.stringify(localizedSample, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "roles-sample.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!organizationId) {
      setErrorMessage("rolesMissingOrganization");
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const fileText = await file.text();
      const parsedRaw = JSON.parse(fileText);
      const validatedData = parseRolesImportData(parsedRaw);
      const itemsToSave = rolesImportDataToItems(validatedData);

      // ذخیره مستقیم در بک‌اند
      await saveRoles(itemsToSave as unknown as RoleItem[], organizationId);

      // بارگذاری مجدد از بک‌اند برای همگام‌سازی کامل
      await loadRoles();
      setSuccessMessage({
        key: "rolesImported",
        values: { count: formatCount(itemsToSave.length) },
      });
    } catch (error) {
      console.error("Import roles failed:", error);
      setErrorMessage("rolesImportFailed");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  if (isLoading) {
    return (
      <section dir={direction} className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">
            {message("rolesTitle")}
          </h2>
        </div>

        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          {message("rolesLoading")}
        </div>
      </section>
    );
  }

  return (
    <section dir={direction} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-foreground">
              {message("rolesTitle")}
            </h2>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">
            {message("rolesDescription")}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {message("rolesCount").replace(
                "{count}",
                formatCount(roles.length),
              )}
            </span>
            {hasUnsavedChanges && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-primary">
                {message("rolesUnsaved")}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => void handleFileUpload(e)}
          />

          <button
            type="button"
            onClick={handleDownloadSample}
            disabled={!organizationId || isSaving || isImporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            {message("rolesDownloadSample")}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              !organizationId ||
              !hasLoadedRoles ||
              hasUnsavedChanges ||
              isSaving ||
              isImporting
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {isImporting
              ? message("rolesUploading")
              : message("rolesUploadJson")}
          </button>

          <button
            type="button"
            onClick={handleAddRole}
            disabled={
              !organizationId || !hasLoadedRoles || isSaving || isImporting
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            {message("rolesAdd")}
          </button>

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={
              !organizationId ||
              !hasLoadedRoles ||
              !hasUnsavedChanges ||
              isSaving ||
              isImporting
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Key className="h-4 w-4" aria-hidden="true" />
            {isSaving ? message("rolesSaving") : message("rolesSave")}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {message(errorMessage)}
          {!hasLoadedRoles && organizationId && (
            <button
              type="button"
              onClick={() => void loadRoles()}
              className="font-semibold underline underline-offset-2"
            >
              {message("rolesRetry")}
            </button>
          )}
        </div>
      )}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"
        >
          {formatNotice(successMessage)}
        </div>
      )}

      {!organizationId ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {message("rolesMissingOrganization")}
        </div>
      ) : roles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <ShieldCheck
            className="mx-auto h-8 w-8 text-muted-foreground"
            aria-hidden="true"
          />

          <p className="mt-3 text-sm text-muted-foreground">
            {message("rolesEmpty")}
          </p>

          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSample}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <FileSpreadsheet
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              {message("rolesDownloadSample")}
            </button>

            <button
              type="button"
              onClick={handleAddRole}
              disabled={!hasLoadedRoles || isSaving || isImporting}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {message("rolesCreateFirst")}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {roles.map((role, roleIndex) => {
            const roleKey = role.id ?? role.localId ?? `role-${roleIndex}`;

            return (
              <article
                key={roleKey}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  {role.isSystemRole ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      {message("systemRole")}
                    </span>
                  ) : (
                    <span />
                  )}
                  {role.isSystemRole && (
                    <span className="text-xs text-muted-foreground">
                      {message("systemRoleReadonly")}
                    </span>
                  )}
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">
                      {message("roleName")}
                    </span>

                    <input
                      type="text"
                      dir={direction}
                      value={role.name}
                      onChange={(event) =>
                        handleRoleFieldChange(
                          roleIndex,
                          "name",
                          event.target.value,
                        )
                      }
                      disabled={isSaving || role.isSystemRole}
                      placeholder={message("roleNamePlaceholder")}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-start text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-medium text-foreground">
                      {message("roleDescription")}
                    </span>

                    <input
                      type="text"
                      dir={direction}
                      value={role.description}
                      onChange={(event) =>
                        handleRoleFieldChange(
                          roleIndex,
                          "description",
                          event.target.value,
                        )
                      }
                      disabled={isSaving || role.isSystemRole}
                      placeholder={message("roleDescriptionPlaceholder")}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-start text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(roleIndex)}
                      disabled={
                        isSaving ||
                        role.isSystemRole ||
                        (role.userCount ?? 0) > 0
                      }
                      aria-label={message("roleDelete")}
                      title={
                        role.isSystemRole
                          ? message("systemRoleReadonly")
                          : (role.userCount ?? 0) > 0
                            ? message("roleHasUsers")
                            : message("roleDelete")
                      }
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 border-t border-border pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users
                        className="h-4 w-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <h3 className="text-sm font-medium text-foreground">
                        {message("rolePermissions")}
                      </h3>
                    </div>

                    {typeof role.userCount === "number" && (
                      <span className="text-xs text-muted-foreground">
                        {message("activeUsersWithRole").replace(
                          "{count}",
                          formatCount(role.userCount),
                        )}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {PERMISSION_GROUPS.map((group) => {
                      const groupPermissions = PERMISSION_OPTIONS.filter(
                        (perm) => group.permissionKeys.includes(perm.key),
                      );
                      const allSelected = group.permissionKeys.every((key) =>
                        role.permissions.includes(key),
                      );
                      return (
                        <details
                          key={group.label}
                          className="group rounded-xl border border-border/80 bg-background open:border-primary/25 open:bg-primary/[0.02]"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-3 py-3 text-start outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/30 [&::-webkit-details-marker]:hidden">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${groupPermissions.some(({ key }) => role.permissions.includes(key)) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
                              >
                                <Key
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </span>
                              <span className="truncate text-xs font-bold text-foreground">
                                {message(group.label)}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                                {
                                  groupPermissions.filter(({ key }) =>
                                    role.permissions.includes(key),
                                  ).length
                                }
                                /{groupPermissions.length}
                              </span>
                              <ChevronDown
                                className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
                                aria-hidden="true"
                              />
                            </span>
                          </summary>
                          <div className="border-t border-border/70 px-3 pb-3 pt-2">
                            <div className="mb-2 flex items-center justify-end gap-2">
                              {!role.isSystemRole && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    togglePermissionGroup(
                                      roleIndex,
                                      group.permissionKeys,
                                    )
                                  }
                                  disabled={isSaving}
                                  className="text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
                                >
                                  {allSelected
                                    ? message("clearGroupPermissions")
                                    : message("selectGroupPermissions")}
                                </button>
                              )}
                            </div>
                            <div className="space-y-1.5">
                              {groupPermissions.map((perm) => {
                                const isSelected = role.permissions.includes(
                                  perm.key,
                                );
                                return (
                                  <button
                                    key={perm.key}
                                    type="button"
                                    onClick={() =>
                                      handlePermissionToggle(
                                        roleIndex,
                                        perm.key,
                                      )
                                    }
                                    disabled={isSaving || role.isSystemRole}
                                    aria-pressed={isSelected}
                                    className={`flex min-h-9 w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-start text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? "border-primary/40 bg-primary/10 font-medium text-primary" : "border-border bg-background text-foreground hover:bg-accent"}`}
                                  >
                                    {isSelected ? (
                                      <CheckSquare
                                        className="h-4 w-4 shrink-0 text-primary"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <Square
                                        className="h-4 w-4 shrink-0 text-muted-foreground"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span>{message(perm.label)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
