# Rahcom — Systems

- The Systems toolbar search hover highlights its outline, magnifying-glass icon, and placeholder with the theme's primary color, and gives the whole capsule a subtle dark neutral background. Keep typed text in the normal foreground color.
- Apply hover color directly to the placeholder, icon, and outline; keep typed input text in the normal foreground color.
- In the system information popup, active electricity and location action buttons keep the theme-colored capsule and use black icons.
- The systems count capsule with the location icon gets a themed outline and a subtle dark neutral surface on hover.
- At the vertical edge of the table, wheel/touch scrolling continues to the page; horizontal scrolling stays inside the table.
- Keep the approved columns, labels, order, row density, and popup layout unchanged unless explicitly requested.

Implementation: `src/app/(workspace)/rahcom/systems/rahcom-systems-list.tsx`, shared viewport in `src/components/rahcom/table.tsx`, and styles in `src/app/globals.css`.
