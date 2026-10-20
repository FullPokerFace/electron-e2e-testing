# Test Runner

See the [documentation index](docs/README.md), [implementation and handoff](docs/IMPLEMENTATION.md), and [requirements](REQUIREMENTS.md) for the complete project context.

Plain HTML Electron prototype. Select a team and environment, then click **Run All Tests**. The initial test opens https://resumefromspace.com in bundled Chromium. The browser stays open for inspection; close it to enable another run.

## Development

```powershell
npm install
npm run browser:install
npm start
```

## Portable Windows build

```powershell
npm run dist
```

The portable executable is written to `dist/`. It includes the browser and default test content, with no additional user installation. The initial build is unsigned.

To customize packaged content, place `test-content/catalog.json` and its referenced test files beside the original executable. Without an external catalog, bundled content is used. Click **Reload Test Content** after editing while idle. In development, edit the repository's `test-content` folder.

Tests are trusted CommonJS modules exporting an async function receiving `{ page }`. Use relative URLs with `page.goto('/')` so the environment controls the target. This prototype supports the browser APIs supplied through `page`; it does not install third-party test dependencies.

## Recording a new test

Run `npm run record` from the project folder to open Playwright's browser and Inspector at the Prod website. To record another site, run `npm run record -- https://example.com`.

Interact with the website to record actions. Use the Inspector's assertion tools for any expected results you want checked. Stop recording when done, then close the recorder windows. Each session saves to a new timestamped file in `recordings/`; the terminal prints its exact path.

Generated recordings are source material, not directly runnable catalog entries. Before registering a test, convert its `test(...)` wrapper to the runner's `module.exports = async ({ page }) => { ... }` format, replace application URLs with environment-relative paths, and adapt any generated assertions to the dependencies supported by the runner. Do not copy browser/context shutdown code into catalog tests; the app owns that lifecycle. Place the adapted file under `test-content/<team>/` and add its name, ID, and relative path to `catalog.json`, then reload test content in the app.

Recordings are ignored by Git because recorded actions can contain entered credentials or personal information. Review and replace these before publishing a test.

## Screenshots and reports

After each test, review the browser page and click the bottom-left **Save screenshot and go to next test** overlay. The last test shows **Save screenshot and finish**. The overlay is excluded from the saved full-page PNG. A failed capture offers a retry and does not advance. Closing the browser early leaves a partial report.

Each run gets its own folder under `screenshots/` in development, or under the app's writable per-user data directory in the packaged app. The app displays the exact location. Each folder contains PNG screenshots, `report.json`, and a plain `report.html` with results and images. Use **Open Report** or **Open Screenshots Folder** in the app. Screenshots capture webpage content, not browser chrome or the desktop.

Run `node scripts/verify-capture.js` to check the two-test capture sequence and report generation with local fixture content.

This is an execution prototype. Report export, complete catalog schema validation, time limits for arbitrary test code, content snapshots, and the remaining requirements are future work.
