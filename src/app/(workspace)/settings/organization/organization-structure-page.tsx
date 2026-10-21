// صفحه مدیریت ساختار سازمانی.
// Frontend - Next.js
// مدیریت یکپارچه ساختار سازمانی: شعب، واحدها، خروجی و درون‌ریزی JSON.

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import {
  Building,
  Building2,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileJson,
  Layers,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

import {
  settingsApi,
  type BranchItem,
  type DepartmentItem,
} from '@/lib/api/settings/settings-api';
import { getCurrentOrganizationId, refreshCurrentOrganizationId } from '@/lib/api/shared/auth-api';
import {
  organizationStructureImportSample,
  organizationStructureToApiPayload,
  organizationStructureToExportData,
  parseOrganizationStructureImportData,
} from './organization-json';

interface BranchFormState {
  name: string;
  code: string;
  phone: string;
  address: string;
  isActive: boolean;
  isHeadquarters: boolean;
}

interface DepartmentFormState {
  name: string;
  code: string;
  branchId: string;
}

type DepartmentWithDisplayFields = DepartmentItem & {
  branchCode?: string;
};

const INITIAL_BRANCH_FORM: BranchFormState = {
  name: '',
  code: '',
  phone: '',
  address: '',
  isActive: true,
  isHeadquarters: false,
};

const INITIAL_DEPARTMENT_FORM: DepartmentFormState = {
  name: '',
  code: '',
  branchId: '',
};

export function OrganizationStructurePage() {
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [departments, setDepartments] = useState<
    DepartmentWithDisplayFields[]
  >([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const canEditStructure = isEditing && canManage;

  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [isDepartmentModalOpen, setIsDepartmentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [branchForm, setBranchForm] = useState<BranchFormState>(
    INITIAL_BRANCH_FORM,
  );
  const [departmentForm, setDepartmentForm] =
    useState<DepartmentFormState>(INITIAL_DEPARTMENT_FORM);

  const [branchFormError, setBranchFormError] = useState('');
  const [departmentFormErrors, setDepartmentFormErrors] = useState<
    Partial<Record<keyof DepartmentFormState, string>>
  >({});

  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [isSavingDepartment, setIsSavingDepartment] = useState(false);
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null);
  const [deletingDepartmentId, setDeletingDepartmentId] = useState<
    string | null
  >(null);

  const [toast, setToast] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({ type, text });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const loadOrganizationStructure = useCallback(async () => {
    setIsLoading(true);
    let organizationId: string | null;
    try {
      organizationId = await refreshCurrentOrganizationId();
    } catch (error) {
      setIsLoading(false);
      showToast('error', error instanceof Error ? error.message : 'دریافت اطلاعات سازمان ناموفق بود.');
      return;
    }

    if (!organizationId) {
      setBranches([]);
      setDepartments([]);
      setIsLoading(false);

      showToast(
        'error',
        'این حساب به سازمان فعالی متصل نیست. عضویت سازمانی کاربر را بررسی کنید.',
      );

      return;
    }

    setIsLoading(true);

    try {
      const [branchesResult, departmentsResult, access] = await Promise.all([
        settingsApi.getBranches(organizationId),
        settingsApi.getDepartments(organizationId),
        settingsApi.getOrganizationAccess(organizationId),
      ]);

      if (!access.canView) {
        throw new Error('مجوز مشاهده ساختار سازمانی را ندارید.');
      }
      setCanManage(access.canEdit);
      if (!access.canEdit) setIsEditing(false);

      setBranches(Array.isArray(branchesResult) ? branchesResult : []);

      setDepartments(
        Array.isArray(departmentsResult)
          ? (departmentsResult as DepartmentWithDisplayFields[])
          : [],
      );

      if (window.location.hash.startsWith('#branch-')) {
        const branchId = decodeURIComponent(window.location.hash.slice('#branch-'.length));
        if (branchesResult.some((branch) => branch.id === branchId)) {
          setSelectedBranchId(branchId);
        }
      }
    } catch (error) {
      console.error('Failed to load Organization structure:', error);

      showToast(
        'error',
        error instanceof Error
          ? error.message
          : 'دریافت ساختار سازمانی با خطا مواجه شد.',
      );
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadOrganizationStructure();
  }, [loadOrganizationStructure]);

  const downloadJsonFile = (data: unknown, fileName: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const handleExportOrganization = () => {
    if (branches.length === 0 && departments.length === 0) {
      showToast('error', 'اطلاعاتی برای خروجی گرفتن وجود ندارد.');
      return;
    }

    const exportData = organizationStructureToExportData(branches, departments);
    downloadJsonFile(exportData, 'Organization-structure.json');
    showToast('success', 'فایل ساختار سازمانی با موفقیت دانلود شد.');
  };

  const handleDownloadImportSample = () => {
    downloadJsonFile(
      organizationStructureImportSample,
      'Organization-structure-sample.json',
    );
    showToast('success', 'فایل نمونه ساختار سازمانی دانلود شد.');
  };

  const openBranchModal = () => {
    setBranchForm({ ...INITIAL_BRANCH_FORM });
    setBranchFormError('');
    setIsBranchModalOpen(true);
  };

  const closeBranchModal = () => {
    if (isSavingBranch) {
      return;
    }

    setIsBranchModalOpen(false);
    setBranchForm({ ...INITIAL_BRANCH_FORM });
    setBranchFormError('');
  };

  const openDepartmentModal = () => {
    setDepartmentForm({
      ...INITIAL_DEPARTMENT_FORM,
      branchId: selectedBranchId || '',
    });
    setDepartmentFormErrors({});
    setIsDepartmentModalOpen(true);
  };

  const closeDepartmentModal = () => {
    if (isSavingDepartment) {
      return;
    }

    setIsDepartmentModalOpen(false);
    setDepartmentForm({ ...INITIAL_DEPARTMENT_FORM });
    setDepartmentFormErrors({});
  };

  const openImportModal = () => {
    setImportErrors([]);
    setImportFileName('');
    setIsImportModalOpen(true);
  };

  const closeImportModal = () => {
    if (isImporting) {
      return;
    }

    setIsImportModalOpen(false);
    setImportErrors([]);
    setImportFileName('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const organizationId = getCurrentOrganizationId();
    const name = branchForm.name.trim();
    const code = branchForm.code.trim();

    if (!name || !code || isSavingBranch) {
      return;
    }

    if (!organizationId) {
      setBranchFormError('شناسه سازمان در نشست کاربر یافت نشد.');
      return;
    }

    setIsSavingBranch(true);
    setBranchFormError('');

    try {
      const createdBranch = await settingsApi.createBranch({
        organizationId,
        name,
        code,
        phone: branchForm.phone.trim(),
        address: branchForm.address.trim(),
        isActive: branchForm.isActive,
        isHeadquarters: branchForm.isHeadquarters,
      });

      setBranches((current) => [...current, createdBranch]);

      setIsBranchModalOpen(false);
      setBranchForm({ ...INITIAL_BRANCH_FORM });
      setBranchFormError('');

      showToast('success', 'استان جدید با موفقیت افزوده شد.');
    } catch (error) {
      console.error('Failed to create branch:', error);

      setBranchFormError(
        error instanceof Error
          ? error.message
          : 'ذخیره استان با خطا مواجه شد.',
      );
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleDeleteBranch = async (branch: BranchItem) => {
    if (deletingBranchId || isSavingBranch) {
      return;
    }

    const confirmed = window.confirm(
      `آیا از حذف استان «${branch.name}» اطمینان دارید؟`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingBranchId(branch.id);

    try {
      await settingsApi.deleteBranch(branch.id);

      setBranches((current) => current.filter((item) => item.id !== branch.id));
      setSelectedBranchId((current) => current === branch.id ? null : current);

      showToast('success', 'استان با موفقیت حذف شد.');

      await loadOrganizationStructure();
    } catch (error) {
      console.error('Failed to delete branch:', error);

      showToast(
        'error',
        error instanceof Error
          ? error.message
          : 'حذف استان با خطا مواجه شد.',
      );
    } finally {
      setDeletingBranchId(null);
    }
  };

  const validateDepartmentForm = () => {
    const errors: Partial<Record<keyof DepartmentFormState, string>> = {};

    if (!departmentForm.name.trim()) {
      errors.name = 'نام واحد الزامی است.';
    }

    if (!departmentForm.code.trim()) {
      errors.code = 'کد واحد الزامی است.';
    }

    if (!departmentForm.branchId) {
      errors.branchId = 'استان واحد را انتخاب کنید.';
    }

    setDepartmentFormErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleCreateDepartment = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!validateDepartmentForm() || isSavingDepartment) {
      return;
    }

    const organizationId = getCurrentOrganizationId();

    if (!organizationId) {
      showToast(
        'error',
        'سازمانی برای شما یافت نشد. ابتدا سازمان را ثبت کنید.',
      );

      return;
    }

    setIsSavingDepartment(true);

    try {
      await settingsApi.createDepartment({
        organizationId,
        name: departmentForm.name.trim(),
        code: departmentForm.code.trim(),
        branchId: departmentForm.branchId || undefined,
      });

      setIsDepartmentModalOpen(false);
      setDepartmentForm({ ...INITIAL_DEPARTMENT_FORM });
      setDepartmentFormErrors({});

      showToast('success', 'واحد جدید با موفقیت افزوده شد.');

      await loadOrganizationStructure();
    } catch (error) {
      console.error('Failed to create department:', error);

      showToast(
        'error',
        error instanceof Error
          ? error.message
          : 'ثبت واحد با خطا مواجه شد. کد واحد نباید تکراری باشد.',
      );
    } finally {
      setIsSavingDepartment(false);
    }
  };

  const handleDeleteDepartment = async (department: DepartmentItem) => {
    if (deletingDepartmentId || isSavingDepartment) {
      return;
    }

    const confirmed = window.confirm(
      `آیا از حذف واحد «${department.name}» اطمینان دارید؟`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingDepartmentId(department.id);

    try {
      await settingsApi.deleteDepartment(department.id);
      setDepartments((current) =>
        current.filter((item) => item.id !== department.id),
      );

      showToast('success', 'واحد با موفقیت حذف شد.');
    } catch (error) {
      console.error('Failed to delete department:', error);

      showToast(
        'error',
        error instanceof Error
          ? error.message
          : 'حذف واحد با خطا مواجه شد.',
      );
    } finally {
      setDeletingDepartmentId(null);
    }
  };

  const executeImport = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      throw new Error('فقط فایل با پسوند JSON قابل انتخاب است.');
    }

    const organizationId = getCurrentOrganizationId();

    if (!organizationId) {
      throw new Error(
        'شناسه سازمان در نشست کاربر یافت نشد. لطفاً مجدداً وارد شوید.',
      );
    }

    const jsonText = await file.text();
    let rawData: unknown;

    try {
      rawData = JSON.parse(jsonText);
    } catch {
      throw new Error('فایل انتخاب‌شده یک JSON معتبر نیست.');
    }

    const importedData = parseOrganizationStructureImportData(rawData);
    const payload = organizationStructureToApiPayload(importedData);

    await settingsApi.importOrganization(organizationId, {
      branches: payload.branches,
      departments: payload.departments,
    });

    await loadOrganizationStructure();
  };

  const handleImportFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file || isImporting) {
      return;
    }

    setImportErrors([]);
    setImportFileName(file.name);
    setIsImporting(true);

    try {
      await executeImport(file);

      setIsImportModalOpen(false);
      setImportErrors([]);
      setImportFileName('');

      showToast('success', 'ساختار سازمانی با موفقیت درون‌ریزی شد.');
    } catch (error) {
      console.error('Failed to import Organization structure:', error);

      setImportErrors([
        error instanceof Error
          ? error.message
          : 'درون‌ریزی ساختار سازمانی با خطا مواجه شد.',
      ]);
    } finally {
      setIsImporting(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleQuickImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || isImporting) return;

    setIsImporting(true);

    try {
      await executeImport(file);
      showToast('success', 'ساختار سازمانی با موفقیت درون‌ریزی شد.');
    } catch (error) {
      console.error('Quick import failed:', error);
      showToast(
        'error',
        error instanceof Error
          ? error.message
          : 'پردازش فایل JSON با خطا مواجه شد.',
      );
    } finally {
      setIsImporting(false);
    }
  };

  const selectedBranch = branches.find(
    (branch) => branch.id === selectedBranchId,
  );
  const visibleDepartments = selectedBranchId
    ? departments.filter((department) => department.branchId === selectedBranchId)
    : departments;

  return (
    <section className="space-y-6">
      {toast && (
        <div
          role="status"
          className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-xs font-medium ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
          }`}
        >
          <span>{toast.text}</span>

          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="بستن پیام"
            className="text-current opacity-60 transition hover:opacity-100"
          >
            &times;
          </button>
        </div>
      )}

      {/* Header Toolbar & State Control */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--foreground)]">
              ساختار سازمانی
            </h2>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                canEditStructure
                  ? 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {!canManage ? (
                <>
                  <Eye size={12} />
                  فقط خواندنی
                </>
              ) : isEditing ? (
                <>
                  <Edit3 size={12} />
                  حالت ویرایش
                </>
              ) : (
                <>
                  <CheckCircle2 size={12} />
                  فقط خواندنی
                </>
              )}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            مدیریت استان‌ها و واحدهای هر استان
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadImportSample}
            disabled={isImporting}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            <Download size={14} />
            دانلود نمونه JSON
          </button>

          <button
            type="button"
            onClick={() => quickFileInputRef.current?.click()}
            disabled={!canManage || isImporting}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            {isImporting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            بارگذاری JSON
          </button>

          <button
            type="button"
            onClick={handleExportOrganization}
            disabled={
              isImporting ||
              (branches.length === 0 && departments.length === 0)
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-slate-800"
          >
            <Download size={14} />
            خروجی JSON
          </button>

          <input
            ref={quickFileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={(event) => void handleQuickImport(event)}
            className="hidden"
          />

          <div className="mx-1 hidden h-5 w-px bg-[var(--border)] sm:block" />

          {canManage && (!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-700"
            >
              <Edit3 size={14} />
              ویرایش ساختار
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Eye size={14} />
              پایان ویرایش
            </button>
          ))}
        </div>
      </div>

      {/* Branches Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-[var(--foreground)]">
              استان‌ها
            </h3>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {branches.length}
            </span>
          </div>

          {canEditStructure && (
            <button
              type="button"
              onClick={openBranchModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={14} />
              افزودن استان
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-[var(--border)] p-8 text-center text-sm text-muted-foreground">
            در حال بارگذاری ساختار سازمانی...
          </div>
        ) : branches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-muted-foreground">
            هنوز استانی ثبت نشده است.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {branches.map((branch) => {
              const isDeleting = deletingBranchId === branch.id;

              return (
                <article
                  key={branch.id}
                  id={`branch-${branch.id}`}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Building size={16} className="text-blue-600" />

                      <Link
                        href={`/settings/organization#branch-${encodeURIComponent(branch.id)}`}
                        onClick={() =>
                          setSelectedBranchId((current) =>
                            current === branch.id ? null : branch.id,
                          )
                        }
                        className={`text-sm font-bold underline-offset-4 hover:text-blue-600 hover:underline ${
                          selectedBranchId === branch.id
                            ? 'text-blue-600 underline'
                            : 'text-[var(--foreground)]'
                        }`}
                      >
                        {branch.name}
                      </Link>

                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {branch.code}
                      </span>

                      {branch.isHeadquarters && (
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
                          دفتر مرکزی
                        </span>
                      )}

                      <span
                        className={
                          branch.isActive
                            ? 'rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }
                      >
                        {branch.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>

                    {branch.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone size={12} />
                        <span>{branch.phone}</span>
                      </div>
                    )}

                    {branch.address && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin size={12} className="mt-0.5 shrink-0" />
                        <span>{branch.address}</span>
                      </div>
                    )}
                  </div>

                  {canEditStructure && (
                    <button
                      type="button"
                      disabled={Boolean(deletingBranchId) || isSavingBranch}
                      onClick={() => void handleDeleteBranch(branch)}
                      aria-label={`حذف استان ${branch.name}`}
                      className="shrink-0 rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-950/30"
                    >
                      {isDeleting ? (
                        <span className="text-[10px]">حذف...</span>
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Departments Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-emerald-600" />
            <h3 className="text-sm font-bold text-[var(--foreground)]">
              واحدها
            </h3>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {visibleDepartments.length}
            </span>
            {selectedBranch && (
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                استان: {selectedBranch.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedBranch && (
              <button
                type="button"
                onClick={() => setSelectedBranchId(null)}
                className="rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              >
                نمایش همه
              </button>
            )}
            {canEditStructure && (
              <button
                type="button"
                onClick={openDepartmentModal}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Plus size={14} />
                افزودن واحد
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
            </div>
          ) : visibleDepartments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="h-12 w-12 text-gray-300 dark:text-gray-600" />

              <p className="mt-4 text-base font-medium text-gray-900 dark:text-gray-100">
                {selectedBranch
                  ? `برای ${selectedBranch.name} واحدی ثبت نشده است`
                  : 'هیچ واحدی تعریف نشده است'}
              </p>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                جهت ایجاد ساختار سازمانی، اولین واحد را اضافه کنید.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-gray-200 bg-gray-50/50 text-xs font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4">نام واحد</th>
                    <th className="px-6 py-4">کد</th>
                    <th className="px-6 py-4">استان</th>
                    {canEditStructure && (
                      <th className="px-6 py-4 text-left">عملیات</th>
                    )}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {visibleDepartments.map((department) => (
                    <tr
                      key={department.id}
                      id={`department-${department.id}`}
                      className="transition hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      <td className="whitespace-nowrap px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-emerald-500" />
                          <Link
                            href={`/settings/organization#department-${encodeURIComponent(department.id)}`}
                            className="font-semibold text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300"
                          >
                            {department.name}
                          </Link>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {department.code || '—'}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-gray-600 dark:text-gray-300">
                        {department.branch ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-gray-400" />
                            <span>{department.branch.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            عمومی (کل سازمان)
                          </span>
                        )}
                      </td>

                      {canEditStructure && (
                        <td className="whitespace-nowrap px-6 py-4 text-left">
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteDepartment(department)
                            }
                            disabled={deletingDepartmentId === department.id}
                            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-400"
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletingDepartmentId === department.id
                              ? 'در حال حذف...'
                              : 'حذف'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Branch Modal */}
      {isBranchModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="branch-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3
                  id="branch-modal-title"
                  className="text-base font-bold text-[var(--foreground)]"
                >
                  مشخصات استان جدید
                </h3>

                <p className="mt-1 text-xs text-muted-foreground">
                  اطلاعات استان یا دفتر سازمان را وارد کنید.
                </p>
              </div>

              <button
                type="button"
                onClick={closeBranchModal}
                disabled={isSavingBranch}
                aria-label="بستن مدال"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="branch-name" className="text-xs font-medium">
                    نام استان *
                  </label>

                  <input
                    id="branch-name"
                    required
                    autoComplete="off"
                    value={branchForm.name}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="مثلاً استان مرکزی"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="branch-code" className="text-xs font-medium">
                    کد استان *
                  </label>

                  <input
                    id="branch-code"
                    required
                    autoComplete="off"
                    value={branchForm.code}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="مثلاً BR-001"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="branch-phone" className="text-xs font-medium">
                    شماره تماس
                  </label>

                  <input
                    id="branch-phone"
                    type="tel"
                    value={branchForm.phone}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="02112345678"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="branch-address"
                    className="text-xs font-medium"
                  >
                    نشانی
                  </label>

                  <input
                    id="branch-address"
                    value={branchForm.address}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    placeholder="نشانی استان"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={branchForm.isHeadquarters}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        isHeadquarters: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-600"
                  />
                  دفتر مرکزی است
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] p-3 text-xs">
                  <input
                    type="checkbox"
                    checked={branchForm.isActive}
                    onChange={(event) =>
                      setBranchForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-blue-600"
                  />
                  استان فعال است
                </label>
              </div>

              {branchFormError && (
                <p className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {branchFormError}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={closeBranchModal}
                  disabled={isSavingBranch}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  disabled={isSavingBranch}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSavingBranch ? 'در حال ذخیره...' : 'ثبت استان'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Department Modal */}
      {isDepartmentModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="department-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between border-b border-[var(--border)] pb-4">
              <div>
                <h3
                  id="department-modal-title"
                  className="text-base font-bold text-[var(--foreground)]"
                >
                  افزودن واحد جدید
                </h3>

                <p className="mt-1 text-xs text-muted-foreground">
                  مشخصات واحد یا واحد سازمانی را تکمیل کنید.
                </p>
              </div>

              <button
                type="button"
                onClick={closeDepartmentModal}
                disabled={isSavingDepartment}
                aria-label="بستن مدال"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="space-y-4">
              <div>
                <label
                  htmlFor="department-name"
                  className="text-xs font-medium"
                >
                  نام واحد *
                </label>

                <input
                  id="department-name"
                  value={departmentForm.name}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="مثلاً امور مالی و حسابداری"
                />

                {departmentFormErrors.name && (
                  <p className="mt-1 text-xs text-rose-500">
                    {departmentFormErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="department-code"
                  className="text-xs font-medium"
                >
                  کد واحد *
                </label>

                <input
                  id="department-code"
                  value={departmentForm.code}
                  onChange={(event) =>
                    setDepartmentForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  placeholder="مثلاً FIN-01"
                />

                {departmentFormErrors.code && (
                  <p className="mt-1 text-xs text-rose-500">
                    {departmentFormErrors.code}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="department-branch"
                  className="text-xs font-medium"
                >
                  استان مربوطه
                </label>

                <select
                  id="department-branch"
                  value={departmentForm.branchId}
                  required
                  onChange={(event) =>
                    setDepartmentForm((current) => ({
                      ...current,
                      branchId: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                      {branch.code ? ` (${branch.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={closeDepartmentModal}
                  disabled={isSavingDepartment}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  disabled={isSavingDepartment}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isSavingDepartment ? 'در حال ثبت...' : 'ثبت واحد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="Organization-import-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <h3
                  id="Organization-import-modal-title"
                  className="text-base font-bold text-[var(--foreground)]"
                >
                  درون‌ریزی ساختار سازمانی
                </h3>

                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  فایل JSON شامل شعب و واحدها را انتخاب کنید. موارد تکراری
                  براساس نام استان و کد واحد ثبت نمی‌شوند.
                </p>
              </div>

              <button
                type="button"
                onClick={closeImportModal}
                disabled={isImporting}
                aria-label="بستن مدال"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <button
                type="button"
                onClick={handleDownloadImportSample}
                className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 transition hover:text-blue-700 dark:text-blue-400"
              >
                <Download size={15} />
                دانلود فایل نمونه JSON
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => void handleImportFileChange(event)}
              />

              <button
                type="button"
                disabled={isImporting}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[var(--border)] px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-blue-950/20"
              >
                <FileJson className="h-9 w-9 text-blue-600" />

                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {isImporting
                    ? 'در حال پردازش و ثبت اطلاعات...'
                    : importFileName || 'انتخاب فایل JSON'}
                </span>

                <span className="text-xs text-muted-foreground">
                  برای انتخاب فایل کلیک کنید
                </span>
              </button>

              {importErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <p className="mb-2 font-semibold">
                    فایل قابل درون‌ریزی نیست:
                  </p>

                  <ul className="list-inside list-disc space-y-1">
                    {importErrors.map((error, index) => (
                      <li key={`${error}-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={closeImportModal}
                  disabled={isImporting}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs transition hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
