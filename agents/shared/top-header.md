# Top header

- Keep the authenticated top-header search in its approved position and preserve its existing search, suggestion, and clear behavior.
- Show a magnifying-glass icon inside the search field.
- On hover, highlight the search outline, magnifying-glass icon, and placeholder with the theme's primary color, and give the whole capsule the same dark, neutral `--background` surface as neighboring header controls. Keep the entered text in the normal foreground color.
- While the search input is focused, keep a primary-colored capsule outline with the same subtle focus ring used by the Systems toolbar search.
- On hover, highlight the account capsule outline with the theme's primary color, matching the search capsule. Preserve its existing active-state styling.
- Keep the Latin “Rahyar” label in the normal foreground by default. On hover over the centered brand capsule, highlight both brand labels with the theme's primary color and show a subtle dark neutral surface with a primary outline.
- Render the account avatar's fallback initial in black on its primary-colored circle.
- Keep the field background and other header controls consistent with the active theme. Do not recolor the query text on hover.

## Current implementation reference

- Header search: `src/components/layout/top-header.tsx`.
- Header search and account capsule hover outlines: `src/app/globals.css`; account capsule markup: `src/components/layout/top-header.tsx` (`#user-profile-header-btn`).
