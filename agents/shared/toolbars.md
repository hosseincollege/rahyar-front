# Shared toolbars and search

- Keep toolbar controls at the approved 36px height and preserve their order, placement, spacing, and behavior unless the user specifically requests a change.
- Treat the shared Rahcom date and weekday control as one capsule: hovering either section applies one shared `--primary-soft` surface across both sections, and highlights the outer outline and internal divider with the theme's primary color. Override per-button toolbar hover fills so the date and weekday never look independently hovered.
- Give the Systems search capsule and shared date/weekday capsule a subtle dark neutral hover surface, alongside their themed outline, icon, text, and divider; preserve entered query text color.
- When a toolbar search receives focus, show only the themed primary border on the outer capsule; do not add an inset ring, glow, or focused background. This matches the TopHeader search and is the shared focus treatment for text fields throughout the app.
- In every Rahcom toolbar, use the same `text-foreground` color for enabled control labels, icons, search hints/placeholders, and count/date text. Do not use `text-muted-foreground` for enabled toolbar controls; reserve muted color for disabled controls or secondary status copy. Preserve existing primary hover and pressed-state colors. In dark balanced theme, this matches the date/count foreground (`#a8afb7`) instead of muted foreground (`#929aa4`).
- Put behavior shared across module toolbars here; record page-specific search styling in that page's file under its module.
- Keep search input typing responsive and local; do not make keystrokes wait for filtering or network requests.

