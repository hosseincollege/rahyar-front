/**
 * @file frontend/src/app/(workspace)/layout.tsx
 * @description اجازه دسترسی مشاهده‌ای به کاربر مهمان و محافظت از مسیرهای workspace در ERP Pro.
 * @project ERP Pro
 * @layer Frontend
 */

'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { AppShell } from '@/components/layout/app-shell'
import { getCurrentUser, isUserAuthenticated } from '@/lib/api/shared/auth-api'
import { isReducedEdition } from '@/lib/product-edition'
import { OPTIONAL_MODULE_IDS, readModuleVisibility } from '@/lib/module-visibility'

type WorkspaceLayoutProps = {
  children: React.ReactNode
}

const PUBLIC_PATHS = new Set(['/', '/login', '/register'])
const GUEST_MODE_STORAGE_KEY = 'erp-pro-guest-mode'

export default function WorkspaceLayout({
  children,
}: WorkspaceLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()

  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isAllowed, setIsAllowed] = useState(false)
  const [isGuestMode, setIsGuestMode] = useState(false)

  const isPublicPath = useMemo(() => {
    if (!pathname) return false

    return PUBLIC_PATHS.has(pathname)
  }, [pathname])

  useEffect(() => {
    if (!pathname) return

    function checkAccess() {
      if (isPublicPath) {
        setIsGuestMode(false)
        setIsAllowed(true)
        setIsCheckingAuth(false)
        return
      }

      const guestMode =
        window.localStorage.getItem(GUEST_MODE_STORAGE_KEY) === 'true'

      const authenticated = isUserAuthenticated()
      const currentUser = getCurrentUser()

      /*
       * کاربر رسمی:
       * - نشست معتبر دارد
       * - کاربر فعلی از auth-api دریافت شده است
       *
       * کاربر مهمان:
       * - کلید guest mode در localStorage فعال است
       *
       * نکته: مهمان فقط برای مشاهده صفحات مجاز می‌شود.
       * کنترل ایجاد، ویرایش و حذف باید در صفحات یا API انجام شود.
       */
      const hasOfficialSession = authenticated && currentUser !== null
      const hasGuestSession = guestMode

      if (!hasOfficialSession && !hasGuestSession) {
        setIsGuestMode(false)
        setIsAllowed(false)
        setIsCheckingAuth(false)
        router.replace('/')
        return
      }

      const modulePath = OPTIONAL_MODULE_IDS.find((id) => pathname === `/${id}` || pathname.startsWith(`/${id}/`));
      if (modulePath && !readModuleVisibility(isReducedEdition)[modulePath]) {
        setIsCheckingAuth(true)
        setIsAllowed(false)
        router.replace('/dashboard')
        return
      }

      setIsGuestMode(hasGuestSession && !hasOfficialSession)
      setIsAllowed(true)
      setIsCheckingAuth(false)
    }

    checkAccess()

    function handleAuthStateChanged() {
      setIsCheckingAuth(true)
      checkAccess()
    }

    function handleStorageChanged(event: StorageEvent) {
      if (
        event.key === GUEST_MODE_STORAGE_KEY ||
        event.key === null
      ) {
        setIsCheckingAuth(true)
        checkAccess()
      }
    }

    window.addEventListener(
      'auth-state-changed',
      handleAuthStateChanged,
    )

    window.addEventListener('storage', handleStorageChanged)

    return () => {
      window.removeEventListener(
        'auth-state-changed',
        handleAuthStateChanged,
      )

      window.removeEventListener('storage', handleStorageChanged)
    }
  }, [isPublicPath, pathname, router])

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            ERP
          </div>

          <h2 className="text-xl font-semibold">
            در حال بررسی دسترسی
          </h2>

          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            در حال اعتبارسنجی نشست کاربری و آماده‌سازی محیط کاری
            ERP Pro...
          </p>

          <div className="mt-6 flex justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAllowed) {
    return null
  }

  if (isPublicPath) {
    return <>{children}</>
  }

  return (
    <div
      data-guest-mode={isGuestMode ? 'true' : 'false'}
      data-read-only={isGuestMode ? 'true' : 'false'}
    >
      <AppShell>
        {children}
      </AppShell>
    </div>
  )
}
