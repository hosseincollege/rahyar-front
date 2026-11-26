# Top header

- Keep the authenticated top-header search in its approved position and preserve its existing search, suggestion, and clear behavior.
- Show a magnifying-glass icon inside the search field.
- On hover, highlight the search outline, magnifying-glass icon, and placeholder with the theme's primary color, and give the whole capsule the same dark, neutral `--background` surface as neighboring header controls. Keep the entered text in the normal foreground color.
- While the search input is focused, highlight only the capsule border in the theme's primary color. Do not add an inset ring or change the capsule surface; use this same border-only focus treatment for all text-entry fields and search capsules throughout the app.
- On hover, highlight the account capsule outline with the theme's primary color, matching the search capsule. Preserve its existing active-state styling.
- Keep the Latin “Rahyar” label in the normal foreground by default. On desktop, hover over the centered brand capsule highlights both brand labels with the theme's primary color and uses the same `--background` surface as neighboring header icons, with a primary outline, in both themes. On mobile, show only the logo in a compact circle and apply that same hover surface and outline to the circle.
- Render the account avatar's fallback initial in black on its primary-colored circle.
- On mobile, keep the toolbar-label/help toggle out of the main header row and put its question-mark icon in the three-dot menu as a labeled toggle. Keep the desktop control in the header.
- The Form / Command / AI header control selects the workspace mode. Its accessible label and tooltip must identify the workspace mode and current option, never call the control “Quick mission entry.” On mobile, list the same three modes in the three-dot menu. Follow [workspace-modes.md](workspace-modes.md) for the full behavior contract.
- Keep the field background and other header controls consistent with the active theme. Do not recolor the query text on hover.

## Current implementation reference

- Header search: `src/components/layout/top-header.tsx`.
- Header search and account capsule hover outlines: `src/app/globals.css`; account capsule markup: `src/components/layout/top-header.tsx` (`#user-profile-header-btn`).
