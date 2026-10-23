# 🤖 ERP Pro - System Architecture & AI Agent Guidelines

You are the Lead Full-Stack Architect for this ERP Pro system (Next.js 15 App Router + NestJS + Prisma + PostgreSQL).
Your job is to think proactively, plan features, write robust modular code, and maintain system consistency.

---

## 🏗️ 1. Architecture Rules & Conventions

### Preserve the application shell
- Keep the existing `AppShell`, `TopHeader`, sidebar structure, module navigation, and page frame intact unless the user explicitly asks for a specific structural change.
- Treat each module's main destination (`href`) as its landing/overview page. Keep its submenu focused on distinct workflows and resources; never duplicate that landing page as an "Overview" submenu item. Put useful overview content on the module landing page itself, and keep submenu entries separate only when they represent genuinely distinct tasks. Apply this rule consistently across every module.
- Improve settings and module page contents within the current shell; global preferences must be additive and preserve responsive behavior.
- Persian and RTL remain the default. Apply English/LTR only when the user selects English.

### Frontend (Next.js App Router):
- **Layout Persistence:** All authenticated pages live under `src/app/(workspace)/`. Never re-instantiate `AppShell` inside child page components to prevent sidebar flickering/state resets.
- **RTL & Persian UI:** The app is strictly Persian RTL with Tailwind CSS (`dir="rtl"`, Vazirmatn font).
- **State Management:** Use the database as the source of truth for per-user locale and light/dark contrast, and for organization-wide accent preset/colors, shell background, calendar, and timezone. Load both scopes through the shared preferences provider on startup/login and save them through permission-checked APIs. Local storage may be a hydration cache only; theme mode and ephemeral UI state may use local storage with hydration guards.
- **Internationalization:** Keep the supported locale registry and locale metadata in `src/lib/languages/index.ts`, with one complete translation dictionary per locale in `src/lib/languages/messages/<locale>.ts`; use `src/lib/ui-messages.ts` as the shared lookup entry point. Add or remove a language through the registry and its locale file. Persian and Arabic use RTL; other supported locales use LTR. Every new or edited user-facing string must have translations for all supported locales; use the shared localization layer instead of component-level language conditionals.
- **Localization workflow:** Every feature that adds or changes user-facing text or variables must update the matching shared translation keys in all ten locale files (`fa`, `en`, `ar`, `zh-CN`, `fr`, `es`, `de`, `ru`, `ja`, `pt-BR`). Keep keys aligned and include the locales/files updated in the completion report.
- **RTL/LTR workflow:** Design every page and component for both directions. Read the selected locale direction from the shared preferences/locale registry, apply it to the page, prefer logical CSS utilities (`text-start`, `start/end`, `ms/me`, `ps/pe`) instead of physical left/right positioning, and explicitly use LTR for technical identifiers when appropriate.
- **Accent preview:** Preview unsaved organization-wide accent colors only inside the authenticated ERP shell; restore the persisted accent when leaving settings without saving. Keep public landing and login pages on the default blue brand color. Store separate light and dark color values and restrict organization-wide changes to users with settings write permission.
- **Contrast preferences:** Keep independent saved light and dark contrast levels in the authenticated shell. Preview changes in settings and persist them only through the explicit save action.
- **Shell accent consistency:** Use `--primary`, `--primary-soft`, and `--primary-hover` for accents in the authenticated header, sidebar, and dashboard; do not hardcode blue utility colors for shell accents.
- **Organization logo:** The saved header logo shadow is one of `NONE`, `DARK`, or `LIGHT` (white). Keep settings, API, import/export data, and header behavior aligned; do not add a surrounding frame.
- **Top header hover:** Hovering the first two navigation control icons or the account capsule must not change their colors. Preserve their existing active-state accent styling.
- **Notifications foundation:** Use the shared authenticated notifications service and database records for notifications; each record is scoped to its organization and recipient and carries per-user read state. All modules must publish notifications through `NotificationsService.createForUser` with localized title/body values for all ten supported locales, a stable source/event key, and an internal destination when applicable. Keep unread counts and read history in sync between the header bell, notification inbox, and dashboard summary. Do not create module-specific notification stores or use local storage as notification history.

### Backend (NestJS + Prisma):
- **Modular Design:** Every feature has its own Module, Controller, Service, and DTOs with `class-validator`.
- **RBAC & Auth:** Every route must be protected with `@UseGuards(JwtAuthGuard, RolesGuard)` unless marked `@Public()`.
- **Database:** Prisma multi-file schema (`prisma/schema/*.prisma`). Never break relational integrity.

---

## 🎯 2. Autonomous Workflow (How AI must think & work)

Whenever assigned a task:
1. **Analyze First:** Check existing Prisma models and frontend routes before writing code.
2. **Plan Steps:** Output a quick 3-to-4 step checklist before code implementation.
3. **Execute End-to-End:** 
   - Step A: DTOs & Service in NestJS.
   - Step B: Controller endpoints.
   - Step C: Frontend API Client in `src/lib/`.
   - Step D: UI Page in `src/app/(workspace)/`.
4. **Self-Review:** Ensure no memory leaks, hydration errors, or layout re-mountings.

---

## 📋 3. Project Roadmap & Modules Status

- [x] **Authentication & RBAC** (JWT, Roles, Global Guard)
- [x] **Core Layout & Shell** (Sidebar, TopHeader, Theme Toggle)
- [ ] **CRM & Customer Pipeline** (Next Step)
- [ ] **Inventory & Warehouses** (Products, Stock Issues, Receipts)
- [ ] **Accounting & Invoices** (Invoicing, Payments, Line Items)
- [ ] **Human Resources (HR)** (Employees, Leave Requests)
- [ ] **Ticketing System** (Support, Status Tracker)
## Local Changes and Vercel Deployment Workflow

- For routine feature work and fixes, make and validate changes in the local project only. Do not deploy to Vercel directly; the user will commit/push through Git and let the connected Vercel project deploy from that source.
- Keep local source as the source of truth. Do not make dashboard-only or production-only changes that are absent from the repository.
- Direct Vercel changes or deployments are reserved for an active production incident when they are necessary to restore service. Keep the corresponding source change in the repository so Git-based deployments do not undo the fix.
- Do not commit, push, or deploy unless the user explicitly asks for that action.

## ERP canonical source and reduced Rahyar edition

- ERP is the canonical source for the shared application. Apply shared changes from ERP using DevHub's “Apply to Rahyar” workflow; do not create divergent implementations of shared shell or module features here.
- Rahyar receives the full shared application code from ERP. Accounting, Commerce, Human Resources, Support, and Statistics remain in source but are hidden/disabled by default; keep the Rahyar edition switch responsible for the default visibility.
- Preserve Rahyar-specific API base URLs, localhost ports, Vercel settings, environment variables, secrets, and data store. Never sync `.env*`, deployment settings, or database contents from ERP.
- Preserve `src/lib/product-edition.ts` and `src/lib/api-environment.ts` as Rahyar-only files; the first sets the reduced-edition defaults for module visibility and the second keeps Rahyar's API destinations and ports.
- Rahyar has its own database and migration history. Review any shared schema changes and provide Rahyar-targeted migrations before applying them; do not reuse ERP database connections.
- Rahcom data import/management belongs to the Rahcom module in ERP. Keep Rahyar-specific runtime configuration separate. All other shared application modules are synchronized from ERP as well.
- Sync operations must preserve destination edits in a backup and must not delete Rahyar files unless an explicit reviewed manifest requires it.
- Keep the shared module navigation ordered Dashboard first and Rahcom second, followed by the remaining modules.
- For each requested ERP behavior change, implement it in ERP first and apply its equivalent shared frontend change to Rahyar in the same task. Keep Rahyar's Dashboard, Rahcom, Settings, and Development visible by default; the five reduced-edition modules remain hidden unless enabled in module settings.
- Keep local ports and API URLs, Vercel configuration, `.env*` files and secrets, databases and data, and deployment files specific to Rahyar. Never connect Rahyar to ERP runtime resources.
- Treat every feature request made in the ERP workspace as authorization to implement the shared behavior in ERP first and apply the corresponding change to Rahyar in the same task; the user should not need to repeat the request for Rahyar.
- Preserve Rahyar's reduced edition: Dashboard, Rahcom, Settings, and Development are visible by default; Accounting, Commerce, Human Resources, Support, and Statistics stay hidden unless explicitly enabled.
- Keep the Development data creation experience named "Create Data" in every supported locale. Create persistent, useful records that work in normal workflows; avoid user-facing test, sample, or mock labels. Preserve stable internal identifiers and idempotent fixture behavior.
- Seed Rahyar's organization identity as “رهیار” with the road/traffic camera Rahcom logo. Preserve administrator-customized company details and logos when reapplying seeded records.
- Place global search in the authenticated top header between the assistant/action icons and centered company identity, and keep it out of the Tools tabs.
