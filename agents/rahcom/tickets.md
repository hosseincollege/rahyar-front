# Rahcom — Tickets

- Keep a short ticket table content-sized. When the rows become tall, including when text wrapping is enabled, let the frame grow into available page space before the table viewport scrolls.
- Avoid leaving usable space below a wrapped table when the table still needs vertical room. Short tables should not be stretched solely to fill the page.
- Preserve approved ticket columns, labels, and order.

Implementation: `src/app/(workspace)/rahcom/tickets/rahcom-tickets.tsx` and ticket frame rules in `src/app/globals.css`.
