# Invoice reliability and billing-period PDF

State: done

Provide reliable invoice saving, local calendar dates and scoped sequential numbering, plus one statement PDF for selected daily invoices.

Acceptance criteria:

- Successful creates/updates leave a clean form, including presets; failed saves retain the draft.
- Date selection and optional clearing propagate without mount-time mutations; defaults and output agree in local time.
- Saving older/custom numbers does not consume another number; numeric progression preserves padding and scope. Sequence failure rolls back the invoice transaction.
- Select at least two saved invoices for one business/client/currency, optionally filtered by date. Export chronological line items and totals without modifying invoices or allocating a number.
- Show the combined total, paid amount and balance, with pagination for long periods.

Scope: renderer form, date picker, CRUD save lifecycle, invoice backend service, billing-period selection/PDF and regression tests. No schema or release/package changes. Historical counters are not lowered automatically; periods are exported statements, not persisted entities.

Verification: targeted form/date tests (including Los Angeles and Auckland), SQLite invoice/sequence rollback tests, billing aggregation tests, real PDF generation/visual inspection, TypeScript, lint and renderer/Electron builds. See final handoff for recorded results.

Results (2026-09-14): all 60 tests across 11 suites passed. Renderer and webserver TypeScript checks passed. ESLint passed after the required format/lint workflow. Renderer, preload, migrations and Electron production builds completed. The seven-day sample and multi-page long invoice were rendered with Poppler and visually inspected. A single oversized description is split into bounded rows to avoid clipping. Existing PDF tests now use portable data URLs for image fixtures and allow 30 seconds for a 320-line PDF render.

Environment: tested with an isolated Node 24 runtime, installed SQLite/Windows bundler binaries, and a test-host-only Vite workaround that skips its optional Windows mapped-drive shell probe. These setup changes are not included in the source patch. No installer was built or deployed, and no real user invoice database was modified.
