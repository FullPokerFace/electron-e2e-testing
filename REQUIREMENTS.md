# Portable Playwright Test Runner — Requirements

Status: Draft for review  
Date: October 20, 2026

## 1. Purpose

Build a Windows desktop application that lets nontechnical users run predefined Playwright tests against websites through a simple Electron interface.

Users receive a portable `.exe`, open it, select tests, and view results without installing development tools or using a command line.

## 2. Confirmed requirements

- Use Electron for the desktop application.
- Use Playwright to execute browser tests.
- Distribute the application as a portable Windows `.exe`.
- Do not require an installation wizard or separate installation of Node.js, npm, Playwright, or a browser.
- Include the runtime, test runner, test files, and compatible browser binaries in the release.
- Design the interface for users without technical experience.
- Support multiple teams, each with its own test catalog.
- Provide an environment selector that determines the base URL used for a run.
- Allow trusted maintainers to add or remove teams and tests through an external JSON catalog and test files without rebuilding the executable.

## 3. Proposed first-release scope

The requirements below are proposed defaults. Items in section 12 need product decisions before their dependent features are implemented.

| Area | Proposed requirement |
| --- | --- |
| Operating system | Windows 11, x64; confirm the organization's required Windows versions |
| Browser | Bundle the Chromium revision supported by the pinned Playwright version |
| Test source | Ship default tests and support external, maintainer-provided test packages |
| Execution | One test run at a time; sequential test execution initially |
| Browser display | Show the browser by default so users can follow execution |
| Updates | Replace the executable for runtime/application changes; update external content independently for compatible team/test changes |
| Storage | Store settings and run artifacts in a per-user writable application directory |
| Network | No runtime dependency or browser downloads; access to the target website may require internet or VPN |

## 4. User workflow

1. Receive the portable executable through an approved distribution channel.
2. Double-click the executable to open the application.
3. Select a team.
4. Select a configured target environment, select that team's tests, and enter any required inputs.
5. Complete login when required by the target website.
6. Click **Run Tests**.
7. Follow progress and optionally stop the run.
8. Review results and open or export the report.

## 5. Functional requirements

### 5.1 Test selection and configuration

- List available tests with readable names and descriptions.
- Allow selection of one or more tests, including a suite-level selection.
- Show required inputs before execution and validate them with clear messages.
- Display the target environment prominently before starting a run.
- Keep secrets out of ordinary configuration fields and exported settings.
- Disable starting another run while one is active.
- Populate team, environment, and test selectors from the validated catalog.
- When switching teams, clear incompatible test selections and show only that team's tests.
- Show both the selected environment name and resolved base URL before execution.

### 5.1.1 Team catalog and plug-and-play test content

- Read an external `test-content/catalog.json` beside the original portable executable. Resolve this location from the launcher location, not its temporary extraction directory or the current working directory.
- Use bundled default content when no external catalog is present. A present external catalog replaces the default catalog as a complete set; do not implicitly merge entries.
- Keep bundled defaults available without requiring users to create external folders.
- Allow trusted maintainers to add or remove teams and test entries by editing the catalog and supplying or removing the referenced files.
- Support changes without rebuilding the executable or installing packages on user machines, provided content meets the bundled runner's compatibility contract.
- Include a **Reload Test Content** action available while idle; also load content on startup.
- Validate the complete catalog before activating it: schema version, required fields, unique team/environment IDs, unique test IDs within each team, supported package versions, valid HTTP(S) base URLs, and existing referenced files.
- Require relative test paths to resolve inside the selected content directory; reject absolute paths and directory traversal outside it.
- If an external catalog is invalid, show actionable diagnostics and prevent runs from that catalog. Do not silently switch to a different catalog or environment.
- Treat teams as organizational groupings, not access-control boundaries. Team-based permissions are outside the initial scope unless separately required.
- Snapshot the validated catalog and selected test content for each run so content reloads or file replacements cannot change an active run.
- Define and document supported test format, available dependencies, and runner compatibility. New dependencies or an incompatible runner contract require a new executable release.
- Store no passwords, tokens, or other secrets in the catalog.

Proposed content layout:

```text
TestRunner.exe
test-content/
  catalog.json
  claims/
    claim-search.spec.js
  enrollment/
    member-search.spec.js
```

Proposed catalog structure (illustrative URLs and tests):

```json
{
  "schemaVersion": 1,
  "contentVersion": "1.0.0",
  "runnerApiVersion": 1,
  "environments": [
    { "id": "qa", "name": "QA", "baseUrl": "https://qa.example.com" },
    { "id": "uat", "name": "UAT", "baseUrl": "https://uat.example.com" }
  ],
  "teams": [
    {
      "id": "claims",
      "name": "Claims",
      "tests": [
        {
          "id": "claim-search",
          "name": "Search for a claim",
          "file": "claims/claim-search.spec.js"
        }
      ]
    }
  ]
}
```

### 5.1.2 Environment routing

- Pass the selected environment's base URL to Playwright as `baseURL` for every selected test.
- Require test authors to use relative application URLs and the supplied environment configuration rather than hard-coded environment URLs.
- Prevent test/package configuration from overriding the selected `baseURL`. This configuration rule is not a security sandbox for executable tests.
- Freeze the team, environment, resolved URL, and test selections at run start.
- Default to a shared environment list across teams; team-specific URL overrides remain an open decision.

### 5.2 Test execution

- Run tests in a separate process so the interface stays responsive.
- Use the bundled browser and resolve its path correctly in the packaged executable.
- Do not depend on a globally installed Node.js runtime, browser, package manager, or developer workspace.
- Show queued, running, passed, failed, skipped, and canceled states as applicable.
- Show elapsed time and completed-test counts.
- Provide a **Stop** action that terminates the active run and its child browser processes.
- Preserve completed results when a run is stopped; mark unfinished work as canceled.
- Apply finite test timeouts and report timeouts clearly.
- Handle runner crashes and browser launch failures without closing the interface.
- On application close during a run, offer to continue running or stop and close.

### 5.3 Results and reports

- Show an overall outcome and per-test results after each run.
- Distinguish test assertion failures from application, browser, configuration, and connection errors.
- Include start time, duration, selected team, environment name and resolved base URL, application version, content version, and test identifiers.
- Capture screenshots for failed tests when browser state is available.
- Provide readable failure details and access to diagnostic logs.
- Provide a local report that users can open and export to a selected location.
- Keep report format and trace/video capture policy configurable during implementation; see section 12.
- Make the report and artifact folder accessible from the interface.

### 5.4 Settings and local data

- Persist nonsecret user preferences between launches.
- Write settings, logs, and results to a per-user location, not the executable directory.
- Clearly document the data location; a portable executable may still create local application data.
- Define retention limits and provide a way to delete saved run artifacts.
- Display the application version and a support-friendly diagnostic summary.

## 6. Packaging and distribution

- Deliver a single portable Windows `.exe` containing all runtime dependencies and default content. Maintainers may distribute an adjacent `test-content` folder for independent team/test updates; end users need no dependency setup.
- Bundle Electron, the Playwright runner, tests, and the matching Chromium binaries.
- Permit the portable launcher to extract supporting files to a writable runtime location automatically.
- Keep executable browser files outside the application archive where required for execution.
- Resolve packaged paths independently of the current working directory and source checkout.
- Support ordinary Windows paths, including spaces and non-ASCII characters.
- Target launch without administrator privileges on supported machines, subject to organization security policies.
- Do not download dependencies on first launch or first test execution.
- Show startup feedback if extraction or initialization takes noticeable time.
- Pin dependencies and browser versions for reproducible releases.
- Verify the distributed executable on a clean supported Windows machine.
- Record final download size and extracted disk requirements for each release. Size targets will be set after a packaging prototype.
- Decide code signing and the approved distribution channel before external release. An unsigned executable may trigger Windows warnings or organizational restrictions.

## 7. Architecture requirements

- **Renderer:** test selection, configuration, execution progress, and results.
- **Preload bridge:** a narrow, validated interface for approved desktop operations.
- **Main process:** application lifecycle, configuration, run orchestration, and artifact access.
- **Runner process:** Playwright execution and structured progress/result messages.
- **Bundled resources:** versioned tests, runner dependencies, and browser binaries.
- **External test content:** validated JSON catalog and compatible team test files, loaded independently of application releases.
- **Writable user data:** settings, logs, reports, and screenshots.

Do not execute tests inside the renderer. Keep Node.js integration disabled in the renderer and enable context isolation. Validate renderer requests before starting processes or accessing files. Do not expose arbitrary shell execution through the preload bridge.

## 8. Authentication, privacy, and operational behavior

- Support the target website's approved authentication flow; determine SSO and MFA behavior before implementing authentication.
- Do not store passwords or authentication tokens in plaintext.
- If persistent sessions are required, define storage protection, expiration, and a clear-session action.
- Mask sensitive input fields and avoid recording credentials in logs.
- Treat screenshots, traces, and reports as potentially sensitive; define what may be captured and retained.
- Keep results local unless an explicit upload or sharing feature is approved.
- Do not include telemetry in the first release unless separately agreed.
- Run against approved environments and accounts. Tests that modify data must document their effects and cleanup requirements.
- Show actionable connection errors when the target website or required VPN is unavailable.
- Accept executable test packages only from trusted maintainers; catalog validation does not sandbox test code.

## 9. Usability and reliability

- Use plain-language labels and errors with a useful next step.
- Support keyboard navigation and visible focus indicators.
- Pair status colors with text or icons.
- Keep the interface responsive throughout execution.
- Clean up processes created by the application after cancellation or normal exit.
- Detect incomplete historical runs after an unexpected exit and label them as interrupted.
- Allow a new run after failure or cancellation without requiring an application restart.
- Validate startup, extraction, browser launch, and execution performance on representative user hardware; set measurable thresholds after the prototype.

## 10. First-release acceptance criteria

1. A standard user on a clean supported Windows machine can open the delivered `.exe` without installing Node.js, npm, Playwright, or a browser.
2. The application starts and can run a local bundled smoke test with network access disabled, proving that runtime dependencies are included.
3. A user can select a bundled test, provide valid inputs, run it against an accessible approved website, and see progress and results.
4. Passing, failing, skipped, timed-out, and canceled tests display the appropriate outcomes.
5. A failed test produces readable failure details and a screenshot when available.
6. A user can open and export a run report.
7. Stopping a run terminates its runner/browser processes and allows another run.
8. Closing the application during execution follows the selected close behavior and leaves no application-created runner/browser processes behind after shutdown.
9. Settings and artifacts remain writable when the executable is launched from a directory the user cannot modify.
10. The packaged application works from a path containing spaces and non-ASCII characters.
11. Missing configuration, inaccessible websites, failed browser startup, and runner crashes produce actionable errors without crashing the interface.
12. Logs and exported reports do not expose supplied credentials.
13. Two teams with different test catalogs appear correctly, and switching teams does not retain another team's test selection.
14. Selecting QA versus UAT runs the same environment-relative test against the respective configured base URL; the UI and report show the resolved target.
15. Adding a team and compatible test files through the external catalog makes them available after reload without changing the executable or installing dependencies.
16. Removing a team or test from the catalog removes it from selection after reload.
17. Invalid JSON, duplicate IDs, unsupported versions, invalid URLs, missing test files, and paths outside the content directory produce actionable validation errors and prevent affected catalog execution.
18. External content is found beside the original executable when launched from another working directory or extracted runtime location.
19. With no external catalog present, bundled default tests remain available.
20. Reload is disabled during execution, and replacing source content cannot change the active run's captured configuration or tests.

## 11. Out of scope for the first release

- macOS and Linux packages.
- A test code editor, test recorder, or execution of arbitrary user-supplied scripts.
- Firefox and WebKit support.
- Cloud execution, centralized result storage, and multiuser dashboards.
- Automatic application or test updates.
- Concurrent independent test runs and scheduled unattended execution.

## 12. Open decisions

| Decision | Information needed |
| --- | --- |
| Product identity | Application name, branding, and support contact |
| User devices | Windows versions, CPU architecture, device restrictions, and administrator availability |
| Test inventory | Existing Playwright tests or new tests; initial suites and expected outcomes |
| Target systems | Website URLs, approved environments, network/VPN/proxy requirements |
| Environment mapping | Whether all teams share each environment's base URL or need team-specific URL overrides |
| Content ownership | Trusted team maintainers, content distribution process, and supported test/dependency contract |
| Authentication | Credentials, SSO, MFA, session reuse, and approved test accounts |
| Test inputs | Required data fields, fixtures, and whether users can edit target URLs |
| Data changes | Whether tests create or modify records, cleanup behavior, and production restrictions |
| Reports | HTML, PDF, CSV, or other required formats; trace and video policy |
| Retention | Artifact retention period, disk limits, and treatment of sensitive data |
| Distribution | Internal download location, code-signing certificate, and enterprise security review requirements |
| Updates | Who publishes new releases and how users are notified |
| Performance | Typical suite duration, supported machine baseline, and acceptable startup/run overhead |

## 13. Implementation deliverables

- Electron application source and predefined Playwright tests.
- Reproducible development and release build commands.
- Portable Windows executable containing required runtime dependencies.
- Clean-machine verification results mapped to the acceptance criteria.
- Short user guide covering launch, login, running tests, reports, and troubleshooting.
- Maintainer guide covering tests, browser/version updates, packaging, signing, and release distribution.
- Versioned JSON catalog schema, sample team test package, and maintainer instructions for adding/removing teams, tests, and environments without rebuilding the application.

