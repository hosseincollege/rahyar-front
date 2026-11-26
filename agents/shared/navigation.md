# Sidebar navigation

- Show the selected submenu item with the same solid theme-primary capsule used for the selected module in the first sidebar column.
- Keep the selected submenu item's text and index black in both light and dark themes.
- When the first sidebar column is collapsed, show the module title at the top of the second column in a rounded capsule, vertically centered like its submenu entries. On the module landing page, fill it with the solid primary color and black text.
- Keep the module title capsule and submenu capsules at the same height in the second column. Remove heading padding that clips the capsule within its capped height.
- On hover, highlight either column's unselected navigation capsule outline, text, and any icon or index with the theme's primary color. Use `--background` for the capsule surface, matching the authenticated top-header icon hover so it darkens slightly against the sidebar surface. Define this in scoped global CSS on `.sidebar-nav-item`, rather than relying only on utility classes. Preserve the selected item's solid capsule and readable foreground.
- **Approved sidebar capsule design (2026-11-26):** The module title capsule at the top of the second column is approved as vertically centered, rounded, and the same height as submenu capsules, with no clipping. Preserve this exact layout and hover behavior; change it only when the user explicitly requests a change.

## Current implementation reference

- Sidebar module and submenu states: `src/components/layout/sidebar.tsx` and `.sidebar-nav-item` rules in `src/app/globals.css`.
- Selected submenu and module-landing foreground: `src/app/globals.css` (`.sidebar-subitem-selected`, `.sidebar-module-landing-selected`).
