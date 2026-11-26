# Rahcom — Systems

- The Systems toolbar search hover highlights its outline and magnifying-glass icon with the theme's primary color. Keep typed text in the normal foreground color.
- Apply hover color to the icon and outline only; do not let the toolbar's hovered label recolor the input text through inherited color.
- At the vertical edge of the table, wheel/touch scrolling continues to the page; horizontal scrolling stays inside the table.
- Keep the approved columns, labels, order, row density, and popup layout unchanged unless explicitly requested.

Implementation: `src/app/(workspace)/rahcom/systems/rahcom-systems-list.tsx`, shared viewport in `src/components/rahcom/table.tsx`, and styles in `src/app/globals.css`.
