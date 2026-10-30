# Rahyar Frontend — Agent Guide

This directory is the frontend for Rahyar, an independent multi-province system monitoring and fault management product. ERP is a separate product and is not Rahyar's source of truth.

## Product objective

Help authorized users across provinces find their assigned systems, understand outages and incidents, record repair work, and coordinate system maintenance. Keep the product complete across Rahcom, Settings, and Development while preserving strict organization and province boundaries.

## Product independence

- Treat Rahyar and ERP as independent products with separate roadmaps, source, deployments, API destinations, identity, integrations, databases, and migrations.
- Do not copy, synchronize, port, or implement changes in ERP as part of Rahyar work unless the user explicitly requests cross-product work.
- Keep the Rahyar edition limited to Rahcom, Settings, and Development. ERP-only business modules, Dashboard routes, and ERP services are not Rahyar product features.
- Preserve Rahyar-specific product-edition and API-environment configuration; never point Rahyar at ERP services or data.

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
- **Accent preview:** Preview unsaved organization-wide accent colors only inside the authenticated Rahyar shell; restore the persisted accent when leaving settings without saving. Keep public landing and login pages on the default blue brand color. Store separate light and dark color values and restrict organization-wide changes to users with settings write permission.
- **Contrast preferences:** Keep independent saved light and dark contrast levels in the authenticated shell. Preview changes in settings and persist them only through the explicit save action.
- **Shell accent consistency:** Use `--primary`, `--primary-soft`, and `--primary-hover` for accents in the authenticated header, sidebar, and Rahcom pages; do not hardcode blue utility colors for shell accents.
- **Organization logo:** The saved header logo shadow is one of `NONE`, `DARK`, or `LIGHT` (white). Keep settings, API, import/export data, and header behavior aligned; do not add a surrounding frame.
- **Top header hover:** Hovering the first two navigation control icons or the account capsule must not change their colors. Preserve their existing active-state accent styling.
- **Notifications:** Keep any Rahcom alerts organization-scoped and province-aware. Do not restore dashboard-only notification pages or create client-side notification history as a substitute for persisted records.

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
- **Rahcom:** Province-scoped systems, fault monitoring, traffic and solar reports, imported tickets, maintenance activities, and history.
- **Settings:** Organization identity, accounts, roles, province assignments, preferences, announcements, and Rahcom data administration.
- **Development:** Restricted development utilities and demo data management.
- Track remaining audit work and validation evidence in `../AUDIT.md`. Do not restore ERP business modules as roadmap items.
## Local Changes and Vercel Deployment Workflow

- For routine feature work and fixes, make and validate changes in the local project only. Do not deploy to Vercel directly; the user will commit/push through Git and let the connected Vercel project deploy from that source.
- Keep local source as the source of truth. Do not make dashboard-only or production-only changes that are absent from the repository.
- Direct Vercel changes or deployments are reserved for an active production incident when they are necessary to restore service. Keep the corresponding source change in the repository so Git-based deployments do not undo the fix.
- Do not commit, push, or deploy unless the user explicitly asks for that action.

## Independent Rahyar product scope

- This repository is the Rahyar frontend only. Rahyar and ERP are independent products; do not treat ERP as canonical, synchronize changes, or port ERP code unless cross-product work is explicitly requested.
- Rahyar includes only Rahcom, Settings, and Development as product modules. Do not expose or retain Dashboard or other business modules in navigation, routes, or product setup. Keep shared shell features only where these modules need them.
- Keep Rahyar API host/port, Vercel settings, environment files, secrets, and integrations specific to Rahyar. Never point them at ERP resources. Preserve src/lib/product-edition.ts and src/lib/api-environment.ts.
- Rahyar owns its database and migration history. Never reuse ERP database connections or run migrations unless explicitly requested.
- Inspect this repository Git status and diffs before editing; preserve unrelated work. Do not edit ERP unless cross-product work is explicitly requested.
- Preserve Rahyar organization identity as رهیار and administrator-customized organization details and logo.
- Keep global search in the authenticated top header between assistant/action icons and centered company identity; keep it out of Tools tabs and usable on narrow screens.
- The user will move project folders. Do not move or rename directories.
