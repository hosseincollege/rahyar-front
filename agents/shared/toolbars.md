# Shared toolbars and search

- Keep toolbar controls at the approved 36px height and preserve their order, placement, spacing, and behavior unless the user specifically requests a change.
- Treat the shared Rahcom date and weekday control as one capsule: hovering either section applies one shared `--primary-soft` surface across both sections, and highlights the outer outline and internal divider with the theme's primary color. Override per-button toolbar hover fills so the date and weekday never look independently hovered.
- Give the Systems search capsule and shared date/weekday capsule a subtle dark neutral hover surface, alongside their themed outline, icon, text, and divider; preserve entered query text color.
- Put behavior shared across module toolbars here; record page-specific search styling in that page's file under its module.
- Keep search input typing responsive and local; do not make keystrokes wait for filtering or network requests.

