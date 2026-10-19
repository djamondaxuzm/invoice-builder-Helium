# Accurate client and payment reporting

State: done

## Scope and compatibility

Improve financial reporting and add dated and bulk payments. Limit desktop distribution to Windows and macOS and remove EU XML export actions. No release is published by this change.

Database schemas, all historical migrations, legacy EU metadata, app ID and user-data location remain unchanged. SQLite/PostgreSQL connections, backup/import, linked catalog updates, non-destructive catalog archives, presets, numbering, receipt/PDF export and update checks are retained. The internal HTTP adapter remains for compatibility checks but is excluded from desktop packaging. Server-only packages move to development dependencies without changing package versions.

## Acceptance and implementation

- Last 30 days covers 30 local dates including the whole final day, across DST. Currency is preserved on range changes; canceling custom dates preserves the previous range.
- Invoice totals use issue dates; payments use each actual payment entry's date, including receipts for old invoices. No inferred cash payments from Paid status.
- Currency snapshots group by code and subunit, and clients by ID. Archives and closed invoices count; quotes do not. Overpayment credits never cancel other invoices' debt.
- Current balances and aging use all invoices issued through today, not the selected period. Future payments do not settle today's balances. Unknown payment dates stay out of cash charts.
- Dashboard adds client/business/currency filters, client comparisons/drilldown, payment methods/ledger, overdue aging, settlement status, item sales, cumulative trends and CSV exports.
- Mark as paid opens a dated payment form; legacy Paid invoices start with a blank date and the unrecorded amount. Partial history preserves settlement and existing entries. Unknown legacy status dates stay unknown on save. Edited payments persist dates, methods and notes.
- Client-first bulk payments use date-ordered Ctrl/Cmd/Shift selection, one business/currency, oldest-first partial allocation, a review table, and one transaction. Stale inputs, duplicates, invalid amounts/dates and overpayments are rejected; failures require a refreshed preview.
- Shared invoice math fixes exclusive item taxes combined with inclusive invoice tax. Balances round to currency minor units before status comparisons.

## Verification evidence

- 154 tests in 22 files pass. Coverage includes PDF/report monetary agreement, fractional quantities, discounts/taxes/fees, currency subunits, time-zone/DST boundaries, manual Paid history, null dates, overpayments, archives and malformed data.
- Real SQLite tests check unchanged schema, retained receipt bytes and legacy metadata, partial historical corrections, stale data, duplicate requests and forced second-write failure rolling back the complete batch.
- Seven Playwright scenarios pass: dashboard ranges/filters/CSV/narrow layout, failed-load retry, client-first partial bulk payment, canceled legacy/new payment forms, confirmed historical date, and stale-batch recovery. Screenshots reviewed locally.
- Full formatter and ESLint fix commands pass; final touched files lint clean. App and internal-server TypeScript checks pass. Production renderer, preload, migration and Electron builds pass.
- Windows directory packaging passes using the cached Electron binary and existing native dependencies. The archive contains the payment IPC, renderer, preload, SQLite native binary, PostgreSQL library and all 32 migration modules. It contains no server-only files/packages. The unpacked app is 621,720,950 bytes; this is not an installer download measurement. An NSIS installer was not built or published.
- GitHub Windows CI passes from a clean dependency install (tests, migrations, ESLint and formatting). Native macOS execution and a live PostgreSQL server are not tested in this Windows session.

## Measurements

Synthetic, warmed local calculations, not end-to-end invoice loading times:

- A 2,000-line item-summary calculation falls from 239.73 ms to 0.33 ms median across 11 runs by reusing the invoice subtotal. Both paths return identical amounts. This measures that calculation only.
- Building the new report for 5,000 invoices / 50,000 lines takes 49.18 ms median across five runs, excluding database I/O and chart rendering.
- Desktop production dependency paths fall from 464 to 393: 71 excluded paths totaling 3,086,610 bytes (2.94 MiB) uncompressed. Removed distribution/XML source files total 128,378 bytes. Installer compression and the new dashboard affect the final download size; these are not measured installer savings. Electron remains the main size contributor.

## Delivery

History, README and tutorial updated. Published as PR #8 with local QA and GitHub Windows CI evidence. No database from the user's installed application was opened or modified for testing.
