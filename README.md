# Invoice Builder Helium

<img src="src/renderer/assets/helium.svg" width="96" alt="Helium atom icon" />

[![License](https://img.shields.io/github/license/djamondaxuzm/invoice-builder-Helium)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/djamondaxuzm/invoice-builder-Helium/total)](https://github.com/djamondaxuzm/invoice-builder-Helium/releases)
[![Latest Release](https://img.shields.io/github/v/release/djamondaxuzm/invoice-builder-Helium)](https://github.com/djamondaxuzm/invoice-builder-Helium/releases)
![Windows](https://img.shields.io/badge/Windows-10%2B-blue?logo=windows)
![macOS](https://img.shields.io/badge/macOS-DMG-lightgrey?logo=apple&logoColor=white)

**djamondaxuzm's personal Invoice Builder Helium fork.**

Helium has its own atom icon, app title, support links and update feed. Required upstream MIT notices remain in LICENSE.

**Offline invoicing with full data ownership.**

This fork includes client-first combined billing-period PDFs with date-ordered Ctrl/Shift selection, faster image-heavy invoice saves, and automatic propagation of edited business/client details and catalog prices to linked invoices. Archiving catalog items does not remove them from existing invoices. See [the billing-period and editing guide](TUTORIAL.md#export-a-billing-period) for the update rules.

**Invoice Builder** is an **offline-first, open-source invoicing and quoting application** for freelancers and small businesses who want full control over their data.

No accounts. No cloud. No subscriptions.  
Your data stays on your machine in a database file you own.

## 📸 Screenshots

![Invoice Form](tutorial/invoice_form.jpg)
![Invoice PDF Preview](tutorial/invoice_pdf_preview.jpg)
![Quote PDF Preview](tutorial/quote_pdf_preview.jpg)

## ❓ Why Invoice Builder?

Invoice Builder is designed for freelancers, contractors, and small businesses who want:

- **Full ownership of their data** - no cloud lock‑in
- **Offline access** - works anywhere, anytime
- **A predictable, transparent tool** - no subscriptions, no hidden sync
- **Cross-platform support** - Windows and macOS
- **Import/export freedom** - JSON, XLSX, full database backups
- **Highly customizable PDFs** - branding, layout, colors, typography

If you value **privacy, portability, and control**, this app is built for you.

## ✨ Key Features

### Core

- Create and manage **Invoices** and **Quotes**
- Offline-first: works without internet
- Database-file based (create or open a database anywhere)
- Automatic snapshotting of business, bank, style profile, layout, client, item, and currency data per invoice/quote
- Multi-currency support: choose the currency for each invoice/quote individually
- Responsive layout - usable on small and large screens, resizable windows supported
- Invoice/Quote translations – select a language per document, independent of app settings
- Native receipt printing for invoices and quotes in desktop Electron mode, including compact 80mm thermal receipt layouts for retail checkout workflows
- Log out from the sidebar to return to the database selection screen and switch databases without restarting the app

### Business Data Management

- Banks, Businesses, Clients, Items, Categories, Units, Currencies
- Persistent search, persistent sort, persistent filter, archive (non-destructive)
- XLSX import/export for most entities
- Automatic creation of missing units/categories on item import

### Financial Flexibility

- Fixed or percentage surcharge
- Fixed or percentage discounts
- Shipping fees
- Tax:
  - inclusive or exclusive
  - per-item or on total
  - deducted tax
- Partial payments, balance due tracking
- Invoice states: unpaid, partially paid, paid, closed
- Quote states: open, closed

### PDF Generation & Customization

- Live PDF preview
- A4 / Letter formats
- Layout presets
- Color, font size, font family (Supported fonts: Helvetica, Times-Roman, Courier, Roboto, Inter), logo size customization
- Table header & row styles
- Uppercase label toggle
- Quote & invoice watermarks (including paid watermark)
- Attachments: include images in PDFs
- Signature support: upload or hand-draw signatures and apply them to PDFs
- Style profiles are now available for invoices and quotes, enabling quick, consistent theming
- Layouts page for importing and managing JSON-driven invoice PDF compositions
- Customizable V1 and V2 JSON layout schemas, including page-level regions, sidebars, landscape compositions, recursive rows/columns/grids, and controlled content flow
- Layout JSON controls section order, visibility, header composition, supported block placement, spacing, and table sizing
- Export individual layouts as reusable JSON files
- See [LAYOUT.md](LAYOUT.md) for the complete layout JSON structure and usage guide
- Show quantity, unit, and row number in the PDF item table
- Custom header sections and custom values in the PDF item table
- Ability to reorder all columns/headers in the PDF item table
- Ability to include QR codes for payment into PDF
- Ability to customize invoice / quote labels to custom text

### Financial dashboard

- Inclusive local date ranges, currency/client/business filters and daily or monthly invoice/payment trends
- Client comparisons, payment methods and ledger, settlement status, overdue aging and item sales
- CSV exports for the selected view; archived invoices included and currencies kept separate
- Actual payment dates drive cash charts; legacy Paid status settles balances without inventing transactions
- Client-first bulk payments with an allocation preview, partial payments and one atomic save

### Import, Export & Backup

- Full database backup & restore
- Export all data to JSON and import back
- Export to XLSX for most entities
- Invoices and quotes support export; previously exported files remain unchanged

### Settings & Customization

- Language selection: currently French, German, English, Lithuanian and Portuguese
- Number & date formatting (e.g. `1,234.10` vs `1.234,10`)
- Invoice/quote number prefix & suffix
- Leading-zero invoice/quote numbering is preserved across auto-increment (for consistent alphabetical file sorting)
- File name customization for exported PDFs
- Light & dark mode
- Enable/disable receipt printing, reports, style profiles, presets and quotes
- Check for updates via GitHub releases
- Presets: Predefine default Invoice/Quote data (e.g., business, client, currency, bank, style profile, notes, language, signature) to streamline document creation

## 🖥️ Supported Platforms

- **Windows:** 10 or newer, 64-bit
- **macOS:** 11.0 (Big Sur) or newer, Apple Silicon (M1/M2/M3/M4), 64-bit, .dmg installer available
- **Memory:** 2 GB RAM minimum (1 GB may work for very small datasets)
- **Disk space:** ~200 MB for the installer; ~550mb for the app; additional space needed for database files

## 🐘 PostgreSQL Support

Invoice Builder now supports **two database backends**:

| Storage Type            | Description                                                           | Best For                                |
| ----------------------- | --------------------------------------------------------------------- | --------------------------------------- |
| **SQLite (local file)** | Simple, portable, zero‑configuration database stored as a single file | Solo users, offline use, desktop mode   |
| **PostgreSQL (server)** | Network‑accessible database server with concurrency and robustness    | Existing server-based desktop databases |

Users can now choose between:

- **Creating or opening a local SQLite database file**, or
- **Connecting to a PostgreSQL server** by entering host, port, username, password, and database name.

This makes Invoice Builder flexible for both lightweight personal use and more advanced multi‑device or multi‑user environments.

## 📦 Installation

Installers will be listed on the [GitHub Releases page](https://github.com/djamondaxuzm/invoice-builder-Helium/releases) when published. Changes on main do not automatically create a downloadable installer.

To build Windows locally, install Node.js, clone this repository, then run `npm ci` and `npm run package`. The installer is written to `release/`. Build macOS on a Mac with `npm ci`, `npm run build`, and `npx electron-builder --mac --publish never`.

> ⚠️ **Browser download warning**
>
> When downloading the app, your browser may show a message like:
>
> - “This file is from an unknown source”
> - “This file is rarely downloaded”
>
> This is normal for newly published apps and does **not** indicate a security issue.  
> Simply choose **Keep anyway / Save anyway** to proceed with the download.
>
> 🍎 **macOS Gatekeeper warning**
>
> Because this app is **unsigned**, macOS may display a message like:
>
> - “App is damaged and can’t be opened. Move to Trash”
> - “App is from an unidentified developer”
>
> This happens because macOS Gatekeeper treats all unsigned apps downloaded from the internet as potentially unsafe.  
> It adds a special **quarantine flag** to the app bundle, which prevents it from launching.
>
> To fix this, after downloading and installing it:
>
> 1. Open **Terminal**.
> 2. Run the following command:
>
>    ```bash
>     sudo xattr -rd com.apple.quarantine "/Applications/Invoice Builder.app"
>    ```

## 🚀 Quick Start

1. Launch the application
2. Create a new database file or open an existing one
3. Add at least:
   - a Layout
   - a Business
   - a Currency
   - a Client
   - a Bank
   - an Item
4. Create your first Invoice or Quote
5. Preview and export to PDF

## 📘 Tutorial

### Billing-period PDFs

In **Invoices**, choose **Billing period / payments**, choose a client, then a business and currency. Select invoices in date order using Ctrl/Cmd-click, Shift-click or checkboxes. Choose **Download PDF** for two or more invoices, or **Record payment** for one or more outstanding invoices. A payment preview shows the allocation and resulting balances before saving. See [the billing-period guide](TUTORIAL.md#export-a-billing-period).

The date range filters which invoices can be selected; changing it clears the selection. The exported period runs from the earliest to the latest selected issue date. Archived invoices can also be selected. This is a statement export, not a stored billing-period record or a replacement for the original invoice PDFs/attachments. Billing-period labels are currently in English.

Invoice dates follow the local calendar consistently in the picker, lists and PDFs. Saving an older or custom number no longer advances the automatic counter. Existing counters and issued invoice numbers are preserved; historical gaps are not automatically renumbered.

Detailed tutorials and usage guides are available here: [TUTORIAL](TUTORIAL.md)

Layout JSON structure and supported composition options are documented in [LAYOUT.md](LAYOUT.md).

## 🧠 Data Model & Snapshots

When an invoice or quote is created, snapshots of the following are stored with the document to ensure historical accuracy:

- **Bank**
- **Business**
- **Client**
- **Items**
- **Currency**
- **Style profile**
- **Layout**

Business/client definition edits and catalog item name, unit and price edits propagate to linked invoices and quotes. Archiving a catalog item preserves existing invoice lines. Other snapshots remain document-specific unless explicitly replaced. See [the update rules](TUTORIAL.md#invoice-save-and-date-behavior) before editing a shared definition.

## 🔄 Backups & Data Portability

You can:

- **Back up and reopen** the full database file
- **Export all data to JSON** and import it back
- **Import and export layout JSON** files from the Layouts page
- **Export entities to XLSX** for manual editing
- **Import entities from XLSX**

> **Note:** Invoices and quotes are export-only to preserve historical data integrity.

## 🛠️ Development & Contributing

### 📦 Running Locally

Clone the repository, install dependencies, and start the development server:

#### 🖥️ Electron (Desktop App)

```bash
git clone https://github.com/djamondaxuzm/invoice-builder-Helium.git
cd invoice-builder-Helium
npm install
npm run dev
```

### Verification

Run `npm test -- --run --maxWorkers=1`, `npm run lint`, `npx tsc --noEmit -p tsconfig.app.json`, and `npm run build`. The reporting browser suite uses `npx playwright test --config=playwright.reports.config.ts` with Vite running on port 5185.

### Compatibility and distribution

Windows and macOS are the supported desktop targets. Linux packages, Docker deployment scripts and EU XML export actions have been removed. Existing SQLite/PostgreSQL connections, schemas, migrations, legacy e-invoice metadata, backups/imports, presets, numbering and the updater are retained. This update does not migrate or delete database fields.

The internal HTTP adapter remains for development and compatibility checks; it is excluded from desktop packaging. Its server-only packages are development dependencies. `npm run build:webserver` verifies this adapter. It is not a supported self-hosted distribution.

### 📁 Project Structure

```bash
/src
  /backend          – Electron + Webserver
    /main           – Electron main process
      /assets       - Static resources required by the main process
      /ipc          - Your inter‑process communication layer
    /webserver      - Web server (REST API)
      /controllers  - HTTP request handlers (GET, POST, PUT, DELETE)
      /utils        - Utility helpers used by the webserver
    /shared         - Environment‑agnostic logic (used by both Electron and Webserver)
      /db           - Database access layer shared across environments
      /enums        - Centralized TypeScript enums used by the main process
      /migrations   - Folder is used to manage and version database schema changes.
      /services     - Business logic for each database entity
      /types        - TypeScript interfaces and type definitions used exclusively by the Electron/Webserver
      /utils        - Shared utility functions
  /preload          – Electron preload scripts
  /renderer         – UI code
    /__tests__      – UI unit tests
    /app            – Core React application
    /assets         – Fonts, images, and other static assets
    /i18n           – Translation files
    /mocks          – MSW (mock service worker) for testing
    /pages          – React components related to routing
    /state          – Redux-related code
    /shared
      /api          – A neutral layer for Electron preload, IPC handlers, or a lightweight web server
      /hooks        – Reusable React hooks
      /components   – Shared UI components
      /enums        – TypeScript enums
      /types        – TypeScript types/interfaces
      /utils        – Utility functions
```

### 🛠️ Core Stack

- **Electron** - cross-platform desktop framework
- **SQLite** - lightweight, reliable embedded database
- **TypeScript** - safer, maintainable code
- **React** - UI framework
- **MUI** - styling and UI components
- **exceljs** - XLSX import/export
- **@react-pdf/renderer** - PDF generation

### 🗂️ Database Schema

![Database Schema](schema.png)

### 🤝 Contributing Guidelines

Contributions of all kinds are welcome - bug reports, feature ideas, documentation improvements, and pull requests.  
Please open an issue before starting major work to ensure alignment.

- Report issues or features here: [ISSUES/FEATURES](https://github.com/djamondaxuzm/invoice-builder-Helium/issues)
- Feature requests and discussions are welcome
- Please follow [guidelines](CONTRIBUTING.md)
- For agentic/AI-assisted development workflows, see [AGENTS.md](AGENTS.md)

## 📚 Documentation

- [Tutorial](TUTORIAL.md)
- [Layout JSON reference](LAYOUT.md)
- [Privacy Policy](PRIVACY-POLICY.md)
- [Terms of Use](TERMS-OF-USE.md)

## 📌 Supported Versions

| Version | Status                |
| ------- | --------------------- |
| v2.8.0  | ✅ Actively supported |
| v2.7.1  | ✅ Actively supported |
| v2.7.0  | ✅ Actively supported |

Details about supported versions and update policy will be documented here.

## 📄 License

This project is licensed under the **MIT License**.  
See the [LICENSE](LICENSE) file for details.

Receipt loading and saves (October 2026): Invoice lists load receipt metadata; opening an invoice or exporting selected billing-period invoices loads the full receipts. Failed loads offer Retry and do not open an incomplete editor. Ordinary saves preserve unchanged line rows; insertion/reordering preserves display order. Save receives edits immediately while PDF previews wait 200 ms after typing. Cross-invoice payment/snapshot updates are rejected, and custom fields are stored as JSON once.
