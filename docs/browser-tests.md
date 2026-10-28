# Browser tests and frontend coverage

Use the project's supported Node runtime (22.18+; verified with Node 24.19),
install with `npm ci`, and have Google Chrome installed. Cypress downloads its
own runner during installation; tests use the installed Chrome browser. No
Cypress Cloud account, recording key, or external service is required.

## Commands

Run these from `voice-archive-pwa/`:

```sh
npm run cy:open:mock     # interactive Cypress runner
npm run cy:run:mock      # headless Chrome, no Python or database required
npm run cy:run:live      # automatically start an isolated test API
npm run cy:run:coverage  # Cypress-only Istanbul JSON
npm run test:coverage    # Vitest-only Istanbul JSON
npm run coverage         # fresh Vitest + Cypress runs, then combined HTML/lcov
npm run coverage:merge   # regenerate combined reports from both existing JSONs
npm run cy:typecheck
```

Both interactive and headless runs share `cypress.config.ts`, Gherkin features,
step definitions, fixtures, and the same Vite development configuration. The
launcher owns a Vite server at `http://127.0.0.1:5174`, leaving the ordinary
development port free. Ports are strict: stop another E2E run before starting
the next. Mock requests target `http://127.0.0.1:8011` and are intercepted before
visiting the app; they never target the normal developer API on port 8000.

`cypress/e2e/library.feature` covers load/selection, Unicode
initials, empty/error/retry, malformed payload rejection, slow loading, broken
covers, infinite scrolling, later failure/retry, and manual loading without
IntersectionObserver, and the retired recordings address. `content.feature`
also covers book entry, header Back/browser Forward, direct-entry library fallback
and removal of the recording bar/reserved footer space alongside synchronization.
The app-wide font-size regression remains in `App.test.tsx`.
Successful wire fixtures and the 500 body are validated
against generated Zod schemas. The invalid payload deliberately fails that
validation. Assertions use accessible roles/names and visible text.

## Reader component tests

`npm run cy:run:component` runs the React component suite in headless Chrome;
`npm run cy:open:component` opens the component runner. These use the `component`
section of the same Cypress configuration, with a Vite React/Tailwind dev server,
`cypress/support/component.tsx`, and specs under `cypress/component/reader/`.
They need no backend or separately running frontend. The existing BDD feature
configuration, e2e support, launchers and coverage merge command are unchanged.
`npm run cy:typecheck` checks both TS and TSX component/e2e sources.

ReaderPage mounts independently with a controlled ReaderContext and real renderer
CSS, without Redux or the application provider. Tests cover parent sizing and
clipping, prose/verse fragmentation, unbroken text, empty content, focused text
on a clipped page, width/height/text-size remeasurement, clamping after the count
shrinks, and cancellation of an obsolete font wait. Assertions compare actual
fragment rectangles and hit testing with known page contents; remeasurement
checks show values before and after. There are no geometry mocks or fixed sleeps.
Support files live in `cypress/component/support/`. Helpers have no separate
component cases. Application happy/negative flows belong to feature tests added
with each owning app chunk: initial reader entry in 11.10, followed by ToC,
footer navigation, persistence and minimal search. Final acceptance audits these
existing flows rather than postponing them all. The current
[phase-11 index](../../plan/11-reader-text-and-toc.md) defines ownership;
organism stories use the real Redux/provider/Dexie path, unlike isolated atoms.

Setting `VITE_COVERAGE=true` before a component run enables the existing Istanbul
instrumenter and code-coverage plugin, using the same application exclusions and
`coverage/cypress/coverage-final.json` output. Component and e2e capture share that
output location, so a later capture replaces it. The existing `npm run coverage`
aggregate still runs Vitest and mock e2e; it does not yet orchestrate component
tests. Ordinary component runs do not instrument code.

On a restricted Windows agent, the Cypress cache may resolve to a sandbox profile
instead of the installed user cache. Set `CYPRESS_CACHE_FOLDER` to the actual
installed cache when needed; do not download another runner merely for that path
mismatch. Native browser execution may also require normal runtime permissions.

## Automatically starting the sibling backend

The backend remains a separate Git repository. No backend source changes or
test-only HTTP routes are required. The frontend launcher executes the backend's
Python interpreter with that checkout as its working directory.

Prerequisites:

- Keep `voice-archive-api/` next to `voice-archive-pwa/`, or set
  `E2E_BACKEND_DIR` to its absolute path.
- Prepare the backend Python 3.14 environment with `uv sync --locked` in that
  checkout. The launcher uses its `.venv` interpreter; `E2E_PYTHON` can override
  the executable path.
- Configure the backend `.env` for Compose and ignored `.env.test` as described
  in its README. `.env.test` must explicitly select environment `test` and the
  admin database `voice_archive_test`, using the dedicated test credentials.
- Docker Desktop must be running. The launcher starts only the existing
  `db-test` service. Set `E2E_SKIP_DB_START=1` when that test PostgreSQL service
  is already managed externally, for example in CI.

Each live run performs the following:

1. Refuse an occupied API port 8011 rather than attaching to an unknown server.
2. Start/wait for `db-test`, then validate `.env.test` before any database write.
3. Create a uniquely named `va_e2e_<uuid>` database and OS temporary upload root.
4. Apply the backend's Alembic migrations and start Uvicorn on loopback port 8011.
5. Wait for `/api/v1/ready`, which checks database connectivity. Connection
   refusal and 503 are retried for up to 30 seconds; a stopped API fails early.
6. Run the two `@live` scenarios. Books are created and deleted through HTTP
   APIs; Cypress never uses SQL for fixtures.
7. Stop owned servers, drop only this run's named database, and remove its
   temporary upload directory, including after assertion/migration failures.

The database helper refuses names outside the exact `va_e2e_<32 hex digits>`
namespace. It never migrates, truncates, or drops the admin test database or the
development database. The shared `db-test` container is left running so backend
pytest sessions are not disrupted. Ordinary interruption triggers cleanup;
force-killing the runner or shutting down the machine can leave a disposable
database/temp directory requiring manual removal.

Live tests deliberately do not attach to the standard API URL: a healthy
`/ready` endpoint alone cannot establish that a server uses a disposable
database. Missing prerequisites produce a failing command before browser tests
start. There is no fallback to the developer server.

## Coverage policy

Vitest uses `@vitest/coverage-istanbul`; Vite enables `vite-plugin-istanbul` only
when the Cypress launcher is invoked with `--coverage`. Ordinary application,
Storybook, and production builds do not enable this instrumentation. Cypress
collects browser counters with `@cypress/code-coverage`.

Both suites include application `.ts`/`.tsx` under `src/`, excluding generated
API files, Storybook stories, mock-data helpers, and declarations. Dependencies,
test/runner code, and API-generation scripts are outside the application
coverage denominator. Vitest includes unexecuted application files. Coverage
does not justify adding unrelated scenarios.

Outputs are separate until the final merge:

| Output        | Location                                |
| ------------- | --------------------------------------- |
| Vitest JSON   | `coverage/vitest/coverage-final.json`   |
| Cypress JSON  | `coverage/cypress/coverage-final.json`  |
| Combined HTML | `coverage/combined/index.html`          |
| Combined lcov | `coverage/combined/lcov.info`           |
| Combined JSON | `coverage/combined/coverage-final.json` |

`npm run coverage` clears previous coverage, runs both suites, checks each report
for executed statements/functions/branches, merges JSON deterministically with
`istanbul-lib-coverage`, then uses `nyc` to generate HTML/lcov. The complete
Vitest map is merged first because browser source-map remapping can omit
implicit branch locations. Regression tests verify complementary coverage and
branch preservation, and the merge rejects lost coverage data. It fails for
failed tests, missing/empty coverage, or non-application files. It combines execution counters rather than averaging
percentages. `coverage:merge` requires both existing reports from the same source
revision. Do not mix reports from different commits or dependency versions.

The initial verified baseline is 59.91% statements, 62.5% branches, 60.75%
functions, and 61.06% lines. No percentage thresholds are enforced yet.
Backend pytest-cov remains a completely separate Python report.

## Failure artifacts and CI

Screenshots are captured on failure. Videos are recorded during headless runs
and deleted for passing specs, so a failing feature retains its video. Cypress
clears the previous screenshots/videos before each run. Artifacts live under
`cypress/artifacts/`, and coverage/NYC outputs and artifacts are ignored by Git
and formatting. A subsequent successful run removes previous failure artifacts.

A CI worker with Node and Chrome can run `npm ci`, `npm run quality`, and
`npm run coverage`; mock/coverage runs need no API or PostgreSQL. To run live
tests, also check out the sibling backend, prepare its Python environment and
test configuration, and provide Docker or a dedicated PostgreSQL test service.
Upload `cypress/artifacts/` only on failure and `coverage/combined/` as the
coverage artifact. CI and local commands use the same configuration; no
provider-specific pipeline or additional browser matrix is introduced here.

## Dependency upgrades

The compatible toolchain is pinned in package.json and package-lock.json:
Cypress 16.2.0, Cucumber preprocessor 28.0.1, esbuild preprocessor 2.2.8,
esbuild 0.28.2, code-coverage 4.0.3, vite-plugin-istanbul 9.0.1, nyc 18.0.0,
Testing Library Cypress 10.1.3, and Vitest/Istanbul provider 5.0.5.
The deterministic merger uses istanbul-lib-coverage 3.2.2 and its types 2.0.6.

Upgrade Cypress, the preprocessors, and coverage integration as a group after
checking their peer requirements. Keep Vitest and its coverage provider at the
same exact version. Cypress 16 integrations use `expose` for non-secret browser
configuration and tag filtering. After upgrades, run type checks, all mock/live
features, combined coverage, and the normal quality checks. Inspect source paths,
uncovered branches, failure artifacts, and database cleanup before accepting a
new baseline.
