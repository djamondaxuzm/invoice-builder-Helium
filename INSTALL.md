# Install Invoice Builder Helium

[Back to the project](README.md) · [Using Helium](TUTORIAL.md) · [Releases](https://github.com/djamondaxuzm/invoice-builder-Helium/releases)

Helium is a desktop app for Windows and macOS. You can install a published release or build an installer from source.

**Download status:** This fork has no published releases as of October 18, 2026. Use the build instructions below for now. Updating `main` does not automatically publish an installer; check the Releases page for future downloads.

## Install a published release

When an installer is available, open [Releases](https://github.com/djamondaxuzm/invoice-builder-Helium/releases), choose a release, and expand **Assets**.

| Platform     | File to download                                                          | How to install                                                           |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Windows, x64 | The file ending in `Setup.exe` or containing `Setup` and ending in `.exe` | Close Helium, run the installer, then launch Helium from the Start menu. |
| macOS        | The `.dmg` for your Mac's processor, if provided                          | Open the disk image and drag Invoice Builder Helium into Applications.   |

Files ending in `.yml`, `.yaml`, or `.blockmap` are updater metadata, not installers. GitHub's **Source code** ZIP is the project source and must be built before it can run. The `win-unpacked` folder is a packaging intermediate; use the Setup `.exe` to install the app.

## Build a Windows installer

You need Git and Node.js with npm available in PowerShell, an internet connection for dependency/build-tool downloads, and several GB of free disk space. This project uses Node.js 22 in CI and has also been built locally with Node.js 24. Use an up-to-date patch version of one of those major versions.

### 1. Get the source

Open PowerShell in the folder where you want the source code, then paste:

```powershell
git clone https://github.com/djamondaxuzm/invoice-builder-Helium.git
if ($LASTEXITCODE -ne 0) { throw 'Clone failed. Read the error above.' }
Set-Location -LiteralPath '.\invoice-builder-Helium' -ErrorAction Stop
```

If you already have a Git clone, open PowerShell in that repository instead. To update a clean checkout before rebuilding, run `git switch main` followed by `git pull --ff-only`; stop and resolve any errors before continuing. A source ZIP or an existing prepared local build folder is not a Git clone and cannot use `git pull`.

### 2. Build and open the installer folder

Run this from the repository folder containing `package.json`:

```powershell
$ErrorActionPreference = 'Stop'
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Read the error above.' }
npm.cmd run package
if ($LASTEXITCODE -ne 0) { throw 'Installer build failed. Read the error above.' }
```

The first build downloads Electron and packaging tools and can take several minutes. Wait for **Installer build complete** and the **INSTALLER:** file path; a `.yml` file appearing does not mean the build is finished.

Each build uses a fresh folder under `release` and prints the full Setup file path. Run that **Setup `.exe`** after closing Helium. These commands build locally and do not upload a release. For another build with the same dependency files, run only `npm.cmd run package`; rerun `npm.cmd ci` when `package.json` or `package-lock.json` changes. Compilation and packaging times are printed separately and saved as `build-metrics.json` beside the installer.

## Build a macOS installer

Build on a Mac with Git and Node.js/npm installed. The default build targets the architecture of the build environment; build on Apple Silicon for an Apple Silicon installer or Intel for an Intel installer.

In Terminal, clone and enter the repository:

```bash
git clone https://github.com/djamondaxuzm/invoice-builder-Helium.git && cd invoice-builder-Helium
```

After that succeeds, run:

```bash
npm ci && npm run package:mac
```

Open the generated `.dmg`, then drag Invoice Builder Helium into Applications. A local build is not automatically signed or notarized; those require separate signing credentials and release configuration.

## Updating an existing installation

1. Back up your current database before opening it with a newer version. For a local SQLite database, close Helium before copying the database file; keep the backup outside the source, build, and application folders.
2. Close Helium and install the new Setup `.exe` or replace the macOS app using the new `.dmg`.
3. Launch Helium and reopen your existing database. Choose **open existing database**, rather than creating a new one, if it is not already selected.

The installer and your invoice database are separate. Installing a new version does not require deleting your database. Database migrations run when a database is opened; keep the pre-update backup if you may need to return to an older app version.

## Troubleshooting

- **`EBUSY` / `win-unpacked` is locked:** Close any app running from the build output and retry the commands above, which choose a new output folder. Do not delete your invoice database to fix a build-folder lock.
- **`npm.ps1` cannot be loaded:** The Windows commands deliberately use `npm.cmd`, so no permanent PowerShell execution-policy change is needed.
- **Git, npm, or Node is not recognized:** Install the missing prerequisite, then reopen PowerShell or Terminal so it picks up the updated PATH.
- **A download fails or appears stalled:** Keep the terminal open, check the connection, and inspect the first error above the final failure message. Retry after resolving that error.
- **Windows or macOS reports an unknown publisher:** Local builds may be unsigned. Confirm where the installer came from and review the warning; an unknown-publisher message alone does not verify that a file is safe.

For a failed build, include the first error and your operating system in a [GitHub issue](https://github.com/djamondaxuzm/invoice-builder-Helium/issues). For everyday use after installation, see the [tutorial](TUTORIAL.md).

## Packaging checks

The compiled renderer and backend already contain their JavaScript libraries. Those libraries stay available as build dependencies; only SQLite and its native runtime dependency tree are packaged separately. No application features, database migrations or macOS targets are removed. Bundled dependency license notices ship with the compiled outputs.

The installer builder always compiles the current source, keeps Electron/installer caches, uses a fresh output directory to avoid locked-folder failures, and reports completion only after a Setup EXE or DMG exists. Initial dependency and tool downloads still need an internet connection.

For a packaged-app regression check, build first and set `HELIUM_PACKAGED_EXE` to the executable inside `win-unpacked` (or the macOS app bundle), then run `npm run test:packaged`. The test uses a separate profile and test database. Windows CI runs this check automatically.
