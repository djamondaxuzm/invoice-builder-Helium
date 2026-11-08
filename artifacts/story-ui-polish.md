# Coherent editor and application styling

State: implemented and locally verified; packaged verification runs in CI

## Acceptance criteria

- Contracts use the same Edit / Preview control as invoices and quotes. Preview occupies its own view; returning to Edit preserves the current step and unsaved values.
- Headers, buttons, surfaces, navigation, empty states and light/dark themes use one visual language.
- Existing operations, validation, calculations, saved data, legal wording and PDF content remain intact.
- Controls work with keyboard navigation and at narrow and desktop window sizes.

## Implementation scope

Contract layout/preview, shared theme, page/modal headers, navigation, search fields, list headings, editor labels and empty states. Preview version 2.9.0-contracts.5 includes packaged-app coverage for Edit / Preview switching, PDF export and contract deletion. No dependency, database, calculation or PDF exporter changes.

## Verification plan

- TypeScript, formatter, lint, renderer build and existing test suite.
- Contract view switching, unsaved values/step preservation, failed saves, save/reopen, deletion cancellation and export using isolated data.
- Visual review of contracts, invoice/quote editors, catalog pages, settings and reports in light/dark themes and at narrow widths.
- Review the diff for changes outside presentation and view state.

## Integration

Integrated from the reviewed UI patch onto the published 2.9.0-contracts.4 baseline. All 845 existing source files matched the baseline before application. Validation uses synthetic data and isolated databases.

## QA result — November 8, 2026

- Pass: 215 tests in 28 files, including two new contract mode-switching and failed-save regression tests.
- Pass: formatter, ESLint, application TypeScript check, full application build and final renderer build.
- Pass: built-app checks across 50 desktop/narrow views in light and dark mode, with no page errors or horizontal overflow. The harness uses synthetic catalog data and an isolated in-memory SQLite contract store.
- Pass: keyboard view switching, unsaved fields and current-step preservation, save/reopen, PDF download and deletion cancellation.
- Pass: visual inspection of representative contract, invoice, quote, settings and report screens; diff reviewed for presentation-only scope.
- Existing Vite configuration and bundle-size warnings remain. Local UI checks do not use the live business database. Windows and macOS packaged-app checks are required by the branch's CI workflow.

The PR and associated CI run record the published commit and installer verification. The feature remains on the contracts preview branch.
