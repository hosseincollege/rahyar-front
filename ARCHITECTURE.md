# Frontend source layout

## Routes and modules

- `src/app/` contains Next.js routes and the application shell.
- `src/app/(workspace)/rahcom/`, `settings/`, and `development/` group pages by product module. Keep Next.js route files such as `page.tsx` in their route folders.
- `src/app/api/` contains Next.js Route Handlers. These are HTTP endpoints and server-side glue, so their folder paths define their URLs.
- `src/app/login/` and `src/app/register/` are route segments required for the `/login` and `/register` URLs.

## Reusable code

- `src/components/` contains components shared across routes, such as the application shell and global controls.
- `src/components/rahcom/` is the single shared UI layer for Rahcom toolbars, tables, the main information window, compact row information, expanded information, and compact/expanded electricity details. Rahcom pages use `RahcomToolbar`; table callers use the shared `DataTable` export, which forwards to `RahcomTable`; the row-info host composes the four information/electricity views from this folder.
- Keep the common visuals and behavior beside their shared component: `rahcom-toolbar.module.css` controls toolbar sizing/labels and `rahcom-table.module.css` controls header, zebra-row, and hover colors.
- `src/lib/api/` contains API clients, grouped by feature when a feature has multiple clients. Single-client features live directly under `api/`; cross-feature clients live in `api/shared/`.
- Other cross-route helpers and state live directly under `src/lib/` or in a named feature group when there are several related files.

## Province workbooks

- `src/province-backup/` contains the checked-in province workbook backups and their filename exports. Do not put these files under `app/`; the API Route Handlers read and update them server-side.

Keep route folders where Next.js needs them. Avoid adding one-file utility folders unless they provide a required URL, a clear feature boundary, or a meaningful file group.
