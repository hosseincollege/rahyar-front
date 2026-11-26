# Workspace modes: Form, Command, and AI

- Rahyar has three workspace modes: Form, Command, and AI. The header control is a workspace-mode selector, not a quick-mission-registration action.
- The desktop header icon shows the active mode and cycles through Form → Command → AI. Its tooltip and accessible label identify it as the workspace mode selector and include the active mode. Never label this control “Quick mission entry” or imply that it only registers a mission.
- On mobile, provide the same three explicit mode choices from the three-dot menu. Mark the active choice and update the selected mode immediately when tapped.
- In desktop Command and AI modes, render the mode panel as a full-height side column. It starts directly below the TopHeader and reaches the bottom of the workspace; in the Persian RTL layout it sits flush against the left edge, opposite the right sidebar. Keep it separate from the main content's padding and scrolling surface.
- Keep the selected mode synchronized with the shared `workspaceMode` preference and its persistence. Do not introduce separate mode state for the header or mobile menu.
- Keep mode-selection labels and behavior consistent across desktop and mobile, and localize the mode title and each mode name.
- Do not infer that the mode selector itself submits, registers, or creates a mission. A separate panel may have its own workflow, but the selector's purpose and labeling remain workspace-mode selection.

## Current implementation reference

- Mode preference: `src/components/providers/preferences-provider.tsx` (`WorkspaceMode`, `workspaceMode`, and `saveWorkspaceMode`).
- Header selector and mobile mode menu: `src/components/layout/top-header.tsx`.
- Shared header contract: `src/components/layout/app-shell.tsx`.
