# Documents — Invoices

# Documents — Invoices

- Keep invoice data and workflows within Rahyar's own product and runtime resources; never reuse ERP data or configuration.
- Preserve Persian/RTL defaults and use shared localization for user-facing text.
- Preserve current labels, column order, and layout unless the user specifically requests a change.
- The Invoices table uses the approved order documented in `docs/as-built/inventory-invoices.txt`. Keep source-message dates/identifiers as provided, leave absent details empty, and keep group-sourced financial records behind the authenticated organization/province-scoped Rahcom API.
- Store invoice attachments as files under the project-level `Rahyar Storage` directory, outside `rahyar-front` and `rahyar-back`. Group files by province code and category (for example, `ESF/Invoices`, `ESF/Payment Receipts`, `ESF/Work Start`, and `ESF/Work End`). Use safe, unique filenames that include the invoice number, attachment category, timestamp, and sanitized original name. Keep only relative storage paths and file metadata in the database; never expose the absolute storage root through the API. Resolve the root through `RAHYAR_STORAGE_ROOT` and keep province/organization authorization on file reads.
