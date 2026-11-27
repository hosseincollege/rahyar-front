# Documents — Mission

- `/documents/mission` is the Isfahan field-mission report list, imported from the cumulative daily Excel workbook. It uses the shared Rahcom data-list toolbar and table.
- Mission rows are scoped by organization and selected province and are stored through the authenticated Rahcom API in PostgreSQL. Keep the worksheet values, including Jalali dates and populated source columns without a heading.
- Excel upload replaces the selected province's complete report list after an explicit browser confirmation when data already exists. Excel download exports the current database list as a restorable backup.
- Do not confuse this page with the separate quick-mission actions in the global top header. Keep Persian/RTL behavior and the shared list style.
