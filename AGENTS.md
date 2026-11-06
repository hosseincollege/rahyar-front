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
- Make only the changes the user requested for the current task. Preserve unrelated code, UI, labels, ordering, data, and behavior.
- Do not make optional cleanups, redesigns, or adjacent improvements on your own. Share those as suggestions and wait for the user's approval before applying them.
- **Stable UI contract:** Rahyar has reached a stable UI state. Treat existing icons and their behavior, tables, table titles, column labels, column order, and placement/layout as user-approved and fixed. Do not rename, remove, add, move, reorder, or otherwise alter these elements as part of unrelated work, cleanup, responsive adjustments, or inferred improvements. Change them only when the user explicitly asks for that specific change. If an improvement seems useful, describe the proposed change and wait for the user's approval before applying it. Preserve all unaffected UI and behavior when an explicitly requested change is made.
- Treat each module's main destination (`href`) as its landing/overview page. Keep its submenu focused on distinct workflows and resources; never duplicate that landing page as an "Overview" submenu item. Put useful overview content on the module landing page itself, and keep submenu entries separate only when they represent genuinely distinct tasks. Apply this rule consistently across every module.
- Improve settings and module page contents within the current shell; global preferences must be additive and preserve responsive behavior.
- Persian and RTL remain the default. Apply English/LTR only when the user selects English.
- Keep Isfahan-specific source files under `src/provinces/isfahan/`; place any newly created Isfahan data or configuration in that directory and export shared entry points through its `index.ts`.

### Immediate interaction responsiveness (Priority 1 / P0 — highest priority)
- User-perceived responsiveness is a core, non-negotiable requirement across every screen. For every new feature or edit, prioritize immediate visible feedback and an unblocked interaction path ahead of nonessential features or visual polish, and explicitly review this before finishing.
- Make every user interaction respond in the same frame: update the selected control, toggle, tab, filter, or pressed state immediately, then do network requests, persistence, and expensive calculations asynchronously.
- Every toolbar icon and every selectable navigation item follows this rule explicitly: the click handler must synchronously update local selected/pressed state, so the clicked item becomes active and its previous selection becomes inactive immediately. This visual state must not be derived from fetched data, a completed route transition, a deferred value, or a persistence response. Start map/table refreshes, navigation, network requests, and persistence independently after the immediate state update; they may finish later or in parallel. For non-toggle actions, give immediate local feedback (for example, open the dialog or show a local pending state). Never disable the whole toolbar while results load.
- In click/change handlers, commit the optimistic local selection before the first `await`; never put persistence or data loading ahead of the visible state change. Start async work with `void` or after the state update, then reconcile on success and roll back with an inline error on failure.
- For navigation links, highlight the destination immediately on activation and clear the optimistic highlight when the router confirms the new pathname. Keep the current shell mounted while destination data loads.
- Never make a visible control wait for a server response before showing the user's selection. Keep optimistic UI state local and reconcile it with the response; show a clear error and restore state if the operation fails.
- Do not add a global shell progress bar, logo progress ring, or other persistent shell-wide progress animation. For work that continues after the immediate response, use a small, context-specific loading state next to the content or action being updated. Keep its space stable and do not block or dim the whole page.
- For route changes, update the selected navigation state immediately, then load the destination in stages: preserve the shell and stable layout, show local skeleton/loading feedback for pending content, and reveal loaded data as it arrives. Avoid blanking/rebuilding the whole page or causing layout jumps while waiting.
- Keep expensive filtering, sorting, and rendering work off the urgent interaction path. Use deferred values, transitions, pagination/virtualization, or incremental rendering when needed, and avoid broad state updates that delay unrelated controls.
- Treat immediate visible response as Priority 1 for every new feature and every edit. Before finishing, audit every toolbar icon, toggle, tab, filter, and sidebar destination: verify the selected/pressed state updates in the click handler before any `await`, and that the new item activates while the old one deactivates without waiting for the map, table, route, or server. Keep expensive result updates deferred if needed, with only local loading feedback. Optimize the remaining data load as far as practical without delaying the user's action.
- Apply these responsiveness rules to every Rahyar module and re-check them whenever a component, data flow, or interaction is added or edited.

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

## Shared Rahyar and ERP administration UI

- For shared administration experiences, especially Settings, module display management, TopHeader, and shell controls, inspect both Rahyar and ERP when changing either one and implement the compatible improvement in both products.
- Adapt each implementation to that product's modules, permissions, translations, and architecture. Do not blindly copy product-specific pages or code.
- Keep business features, APIs, data, identity, integrations, environments, and deployments product-specific. This shared-UI rule is an explicit exception to the default product separation above.

## Project documentation
- Keep `docs/as-built/` current as features, modules, APIs, data models, and workflows change. Record implemented behavior and relevant source paths; distinguish proposed work from implemented behavior.
- Keep `docs/presentation/` useful for the user's course presentation. Update its technical descriptions when the system architecture or demonstrated workflows change.

## Rahcom incident toggle invariant
- The shared «سرقت و تخریب» icon is a visibility toggle for incident records from the imported daily traffic list. Its incident fields are سرقت، تخریب، تعریض، and جابه‌جایی.
- The toggle is active by default. Active means incident-marked systems remain visible with the normal records; inactive means hide systems marked in those traffic-list fields while preserving all other records.
- Always classify this toggle from the traffic-list snapshot. Do not switch its source to `RahcomSystem.incidentType` or `RahcomSystem.incidentDetails`, and do not restore the two-button source selector.
- Keep the toggle state and behavior consistent wherever the «سرقت و تخریب» icon is shown, including the map, daily traffic, and solar daily views. Preserve the preference under `rahcom-show-incidents`.
- **Daily traffic table layout invariant:** Preserve the approved column labels and order. In rendered order, place the row number first, then «تردد لحظه‌ای CRM», then the source-provided «سرقت» and «تخریب» columns, then «کد سامانه»; retain every other column's current label, order, and behavior. Change this layout only when the user explicitly requests it.
- **Bill identifiers table layout invariant:** Preserve the displayed column order: «ردیف», «شناسه قبض», «کد سامانه», «آدرس انشعاب», «منطقه / امور», «نام مشترک», «وضعیت بررسی». Keep this order and these labels unchanged unless the user explicitly requests a change.

- **Solar daily table layout invariant:** Preserve the approved Solar daily column order. The CRM real-time traffic column now follows system name; axis code and announced/zone axis follow outage days. Keep every other column in its current position, and change this order only when the user explicitly requests it.
- **System detail popup layout invariant:** In the Systems table and map, keep the popup order as system code, system name, axis name, axis code, then actions for copying coordinates, editing (when permitted), routing, and history. Change this layout only when the user explicitly requests it.
- **Rahcom table header invariant:** Keep table headers sticky with fully opaque card backgrounds in Systems, Daily Traffic, Road List, Solar Daily, Tickets, Aggregate, and Bill Identifiers so row content never shows through while scrolling. Preserve each table's approved column labels and order.
- **Rahcom table row-height invariant:** Keep every data row in all Rahcom tables at 36px, matching Daily Traffic. Prevent wrapped content or oversized controls from expanding rows; keep long text accessible through its existing details or a title tooltip. Change this density only when the user explicitly asks.
- **Map toolbar height invariant:** Keep map toolbar controls and capsules at the Systems count capsule's height (36px), vertically centered in the toolbar. Preserve this sizing unless the user explicitly requests a change.
- **Rahcom toolbar spacing invariant:** In Map, Systems, Daily Traffic, Road List, Solar Daily, Tickets, Aggregate, Actions, and Bill Identifiers, keep toolbar controls 36px high and vertically centered. Keep exactly 12px of visual space between the toolbar controls and the page content, accounting for the mobile toolbar's scrollbar gutter. Preserve all other layout, table titles, and column order unless the user explicitly asks for a change.
- **Map and Systems vertical alignment:** Keep the Systems page top inset equal to the Map page top inset, with toolbar controls centered on the same 36px height and the same 12px gap before the table/map.
