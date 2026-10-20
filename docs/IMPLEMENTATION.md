# Implementation and handoff

Last updated: October 20, 2026

## Product decisions

- Build an Electron desktop app that runs Playwright website tests for nontechnical users.
- Target portable Windows `.exe` distribution, bundling the runtime and Chromium so users need no separate development tools or browser installation.
- Organize tests by team and select an environment to determine the target base URL.
- Maintain teams, environments, and test references in JSON, with compatible external test files that can change independently of the executable.
- Keep the first application screen as plain HTML without styling. The browser overlay uses only the positioning and basic presentation needed to make it usable.
- After each test, pause for user review. The user saves a screenshot before continuing to the next test.
- Generate local reports from test outcomes and screenshots.

## Available now

The application displays a team selector, environment selector, resolved URL, and list of the selected team's tests. **Run All Tests** runs all those tests sequentially in visible Chromium. There is no individual test selection or separate suite selector yet.

The initial catalog contains:

| Item | Value |
| --- | --- |
| Team | Resume From Space (`resume-from-space`) |
| Environment | Prod (`prod`) |
| URL | `https://resumefromspace.com` |
| Test | Open website (`open-website`) |
| Test file | `test-content/resume-from-space/open-website.js` |

The initial test navigates to `/`, waits for DOM content to load, and fails if the navigation response is missing or has an unsuccessful HTTP status. It does not validate other site functionality.

Only one run may be active. Selection and content reload controls are disabled during execution and while the completed run's browser remains open. Closing the browser allows a new run. Closing the Electron window requests runner/browser shutdown.

## Screenshot review and reporting

1. Execute a test and record its pass/fail outcome.
2. Display an overlay button at the bottom-left of that test's page.
3. Wait for the user to review the page and click **Save screenshot and go to next test**.
4. Hide the overlay and save a full-page PNG before advancing.
5. If capture fails, restore the button as **Screenshot failed — retry** and wait for another attempt.
6. Close the previous test page before opening the next test's page. Tests share a browser context, so cookies and session state persist within a run.
7. On the final test, show **Save screenshot and finish**. Keep the final browser page open for inspection after capture.

Failed tests also receive the screenshot review step when their page remains available. Closing the page or browser before capture interrupts the run and preserves the report written so far. There is no skip-capture button.

Screenshots capture webpage content, not browser chrome or the desktop. They reflect the page at the time the user clicks, which may differ from the state when the test completed. Navigation or page code that removes the injected overlay can interrupt the review workflow; persistence across such navigation is not implemented.

Each run has a timestamp/UUID folder containing:

```text
screenshots/<run-id>/
  001-open-website.png
  report.html
  report.json
```

- Development: `screenshots/` inside the project root.
- Packaged app: `screenshots/` inside Electron's per-user application data directory, avoiding writes to a potentially read-only executable directory.
- The UI displays the actual run folder and exposes **Open Report** and **Open Screenshots Folder** buttons.
- HTML reports show team, environment, URL, start time, test results, errors, and screenshots.
- JSON reports include per-test timestamps, screenshot filenames, capture errors when applicable, and a run completion timestamp when completed normally.
- Reports are updated during the run. Share the entire run folder to preserve relative screenshot links.
- Results remain local. There is no export dialog, automatic retention cleanup, PDF export, or upload feature yet.

## Development and execution

From the project root in PowerShell:

```powershell
npm install
npm run browser:install
npm start
```

Developer setup downloads dependencies and browser files. End-user packages are intended to include them already.

| Command | Purpose |
| --- | --- |
| `npm start` | Open the Electron app |
| `npm run browser:install` | Download Chromium and required browser components into local `browsers/` |
| `npm run record` | Record actions at the current Prod URL |
| `npm run record -- https://example.com` | Record actions at a different URL |
| `npm run record -- --help` | Display recorder options |
| `node scripts/verify-capture.js` | Verify capture sequencing and report generation using local fixtures |
| `npm run dist` | Install bundled browser files and build the Windows portable target |

## Recording and adding another test

Run `npm run record`. Playwright opens a browser and Inspector. Perform the intended actions, add expected-result checks using Inspector's assertion tools, stop recording, and close the recorder windows. The terminal prints the timestamped destination under `recordings/`.

Each recording is saved as Playwright Test source (`.spec.js`). It is not directly compatible with the current custom runner, which uses the Playwright library rather than the Playwright Test runner.

To integrate a recording:

1. Review the generated file and remove recorded secrets or personal information.
2. Convert its test wrapper to `module.exports = async ({ page }) => { ... }`.
3. Replace target application URLs with relative paths so the selected environment supplies the host.
4. Adapt generated assertions to available dependencies; `@playwright/test` is not installed. Do not paste its imports unchanged.
5. Keep browser creation, shutdown, screenshots, and next-test controls owned by the application.
6. Save the adapted file under `test-content/<team>/` and register it in the catalog.
7. Reload content while the app is idle, then run the team tests.

Example compatible test:

```javascript
module.exports = async ({ page }) => {
  const response = await page.goto('/');
  if (!response || !response.ok()) throw new Error('Website did not load successfully.');
};
```

The user supplied a login recording, now adapted as `test-content/resume-from-space/login.js` and registered as **Test login** after **Open website** (content version `1.1.0`). It uses the selected base URL, logs out only when the logout button is visible, and preserves the supplied input values and three login attempts. The two recorded unnamed-button selectors still use positional indices and may need stronger locators. There are no explicit login outcome assertions yet: passing means the recorded actions completed, not that authentication was verified. The login flow has not been executed against Prod as part of adding the file.

## Catalog and plug-and-play content

The current catalog is `test-content/catalog.json`. It has `schemaVersion`, `contentVersion`, `runnerApiVersion`, `environments`, and `teams`. Each team has `id`, `name`, and `tests`; each test references a relative file path.

To add a team, create its directory and tests, then add a team entry. To add or remove tests, update that team's entries and corresponding files. Add environment entries with HTTP(S) `baseUrl` values. Currently environments are shared across teams; team-specific URLs remain undecided.

For packaged builds, place an optional `test-content` folder beside the original portable executable. When its catalog exists, it replaces the bundled catalog as a complete set. Otherwise bundled defaults load. In development the repository's content folder is used. External lookup uses the portable launcher location rather than its temporary extraction directory.

The current loader checks schema version 1, nonempty teams/environments, HTTP(S) URLs, team test arrays, existing test paths, and basic path containment. Full schema validation, duplicate-ID checks, compatibility enforcement, symlink-aware path validation, and snapshots of content for active runs remain outstanding. Test code is trusted executable code; the catalog is not a sandbox. Compatible updates need no executable rebuild; new dependencies or runner changes can require a new release.

## Architecture and files

| File | Responsibility |
| --- | --- |
| `src/index.html` | Plain HTML application screen |
| `src/renderer.js` | Selectors, test list, progress, report controls |
| `src/preload.js` | Narrow IPC bridge for catalog, run, progress, and artifacts |
| `src/main.js` | Window lifecycle, catalog loading, runner launch, output location, opening reports |
| `src/runner.js` | Electron utility process, visible Chromium, context lifecycle |
| `src/run-suite.js` | Sequential test execution, browser overlay, capture retry, HTML/JSON reports |
| `scripts/install-browser.js` | Project-local browser installation |
| `scripts/record-test.js` | Timestamped Playwright codegen recording |
| `scripts/verify-capture.js` | Local two-test verification with pass/fail and screenshot retry |
| `test-content/catalog.json` | Teams, environments, and test references |
| `package.json` / `package-lock.json` | Commands, pinned dependencies, packaging configuration |
| `REQUIREMENTS.md` | Intended product scope and acceptance criteria |

The renderer has Node integration disabled, context isolation enabled, and sandboxing enabled. Test execution runs in an Electron utility process. Report opening resolves application-owned artifact paths in the main process. Reports escape text values and disable scripts through a content security policy.

## Portable build status

Electron Builder is configured to produce `dist/TestRunner-Portable.exe`, with browser files and default content as extra resources. A portable executable may extract resources and create per-user data; it is not a promise of leaving no local files.

The portable executable has not yet been built or validated on a clean Windows machine. Current verification covers development execution. Code signing and distribution arrangements are still pending. Company policies may restrict executable launch regardless of packaging.

## Verification completed

- JavaScript syntax checks passed for the application scripts after the capture changes.
- Development Electron launch, selectors, Prod URL, and real website navigation passed.
- Electron progress IPC, the capture review prompt, and enabled report controls were verified against the actual website.
- `node scripts/verify-capture.js` passed: bottom-left placement, pausing before the next test, screenshot failure/retry, screenshots for passing and failing tests, and HTML/JSON report output.
- `npm run record -- --help` passed. A real user recording has not yet been captured.
- Production dependency audit reported zero vulnerabilities at initial setup; development dependencies reported eight moderate findings. These are historical results, not a current audit or completed remediation.

## Remaining work and limitations

- Capture and integrate the next business workflow recording.
- Decide whether a team needs multiple named suites and whether environment URLs differ by team.
- Finish catalog validation and compatibility enforcement; snapshot content at run start.
- Add finite whole-test execution limits; current page/navigation timeouts do not bound arbitrary custom code or the intentional user review wait.
- Add a dedicated Stop action, robust cancellation/timeout/skipped statuses, and unexpected-exit recovery.
- Improve overlay recovery if the user navigates during review or a test closes its own page.
- Complete reporting metadata/versioning, export, retention, and sensitive-data handling requirements.
- Implement the agreed authentication/session behavior after SSO/MFA needs are known.
- Build and verify the portable release, including clean-machine and read-only-location checks.
- Keep the UI unstyled until visual design is requested.

See [requirements](../REQUIREMENTS.md) for the full target scope and open decisions. This document records completed behavior and does not mark all requirements as implemented.
