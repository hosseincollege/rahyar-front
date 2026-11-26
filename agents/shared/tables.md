# Tables and scrolling

- Let a table frame fit its rows when the result set is short. Do not stretch a table with only a few rows to fill the page.
- When rows need more space, let the table frame grow into the available page space and then scroll inside its viewport. Avoid an unnecessarily low fixed height that leaves usable page space empty.
- Keep Rahcom data rows at 36px by default. The explicitly enabled Tickets wrap mode may expand rows; when that makes the table taller, allow its frame to use available vertical space before scrolling. Keep short ticket tables content-sized.
- At the bottom or top edge of a Rahcom table, vertical wheel/touch scrolling should continue to the page. Keep horizontal table scrolling contained within the table.
- Put shared table behavior in shared components or shared styles so one adjustment applies consistently across Rahcom list pages. Use page-specific exceptions only when the user requests different behavior.
- Preserve approved table headers, column names/order, sticky headers, and the 36px row-height rule unless the user explicitly asks to change them; Tickets wrap mode is the specific approved exception.

## Current implementation reference

- Shared Rahcom table viewport: `src/components/rahcom/table.tsx` and `.rahcom-table-scroll` in `src/app/globals.css`.
- Ticket table content sizing and wrapped-row behavior: `src/app/(workspace)/rahcom/tickets/rahcom-tickets.tsx` and `.rahcom-tickets-table-frame` in `src/app/globals.css`.
