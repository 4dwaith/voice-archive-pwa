# Voice Archive PWA

A local React and TypeScript application scaffolded with Vite, styled with
Tailwind CSS 4, and configured as an installable PWA.

Library books open a minimal loading page and synchronize their structured data
into Dexie. See [content synchronization](docs/content-sync.md) for cache,
offline, cancellation, and version-invalidation behavior. The text reader follows
in phase 11.

## Development

Use Node.js **22.18 or newer** (Node 24 LTS recommended). The shell and IDE must
use the same supported runtime. Install the pinned dependency tree with `npm ci`.

```bash
npm install
npm run dev
```

Dexie defaults to `voice-archive`; set `VITE_DATABASE_NAME` before starting or
building Vite to use another database with the same schema. Storybook dev/build
explicitly default to persistent `voice-archive-storybook` (the same environment
variable can override it). Vitest and Cypress use isolated test database names.
Story switches do not clear Storybook data.

Reader preferences use the localStorage key `voice-archive-reader`. Set
`VITE_READER_PREFERENCES_KEY` before starting or building Vite to choose another
key. Storybook dev/build default to `voice-archive-reader-storybook`, with the
same variable available as an override. Vitest, Cypress component tests and
Cypress application tests use `voice-archive-reader-test`,
`voice-archive-reader-component-test` and `voice-archive-reader-e2e-test`
respectively. All stores run the same persistence middleware; tests clear their
own preferences between cases. Story switches retain Storybook preferences,
while reader stories explicitly start at their seeded scenario position.

Dexie schema version 8 drops the obsolete `contentPositions` table when the
application next opens the database. Historical schema versions remain defined;
other cached data is retained. Legacy positions are discarded, without copying
them into localStorage or changing existing localStorage preferences.

## Validation

```bash
npm run lint
npm run build
npm run preview
```

`npm run quality` runs formatting checks, lint, Vitest, Cypress type checking,
strict TypeScript/application build, and Storybook build. It does not need a
running backend. Browser execution and combined coverage use the separate
commands documented below.

`npm run format` formats the project, including generated TypeScript;
`npm run format:check` only reports formatting differences. Public source assets,
build output, temporary files, and the package lockfile are excluded.

## Generated API contract

FastAPI's live OpenAPI document is the contract source. No OpenAPI snapshot is
committed. See [the contract policy](docs/api-contract.md) for architecture,
validation behavior, and generator upgrade instructions.

With the backend running at `http://127.0.0.1:8000`:

```bash
npm run api:check
npm run api:regenerate
```

- `api:check` fetches once, regenerates in OS temporary storage, and reports stale,
  missing, or extra generated files with a failing exit code. It never changes
  project files. Temporary generation files are cleaned up.
- `api:regenerate` replaces files under `src/api-client/generated/`. Review the diff.
- Neither command stages files, commits, or modifies backend data.
- Set `OPENAPI_URL` to override the generation URL. Set `VITE_API_BASE_URL` to
  override the runtime origin (development default `http://127.0.0.1:8000`).
  Generation and runtime configuration are independent. Ordinary builds use
  tracked generated output and never fetch OpenAPI.

The generation scripts are TypeScript, strictly checked by `npm run build`.
Node 22.18+ executes them directly with built-in type stripping, so no separate
TypeScript runner is required.

## Live library

The library uses the validated API and RTK Query's infinite-query cache. It fetches
24 books at a time and loads the next batch as the shelf bottom approaches the
viewport. A keyboard-accessible **Load more books** button also works without
IntersectionObserver. Errors while loading more retain the existing books and
offer a retry; the shelf identifies when all books have loaded.

Run the backend before opening the library. `VITE_API_BASE_URL` is the backend
origin, defaulting to `http://127.0.0.1:8000` in development. Production builds use
`VITE_API_BASE_URL=/` from `.env.production`, resolved against the browser's origin;
generated paths already include `/api/v1`. Cover, PDF, and audio paths resolve
against that origin and image bytes stay outside Redux. Changing the environment
setting requires restarting Vite or rebuilding production. This phase
does not persist library metadata for offline use.

The infinite endpoint validates the raw response, then resolves file URLs in
`transformResponse` before caching. Components use the generated book model
directly, retaining `cover_url`; there is no separate presentation book model.

`LibraryPage` supplies request state and selection to the presentation component
`BookShelf`; the shelf owns observation, layout, and accessible state displays.
`Book` derives up to two initials from the first grapheme of each of the first
two title words, preserving combined Kannada characters and emoji. Single-word
titles use one grapheme. Failed images immediately use the same fallback.

Storybook's **Molecules/Library/BookShelf** entries cover initial loading, empty, unavailable,
loading more, later failure, more available, end, multilingual/long titles, and
interactive loading/selection. Storybook uses generated-schema-validated fixtures
and needs no backend. Development sample books were added once through the API;
there is no repository seeding command.

The final **Infinite Scroll** and **Infinite Scroll Failure** stories use a
a Storybook-only controller under `.storybook/helpers/`, using hard-coded
fixtures with 30 books in 12-book batches. Scroll to
the bottom to see a 2.5-second loading spinner, followed by more books or a
simulated error. The failure story succeeds on retry. Both show the loaded count
and eventually the end of the library; no backend is involved.

## Tests and WebStorm

```bash
npm test
npm run test:watch
```

Vitest uses `vitest.config.ts`, Node's Fetch/File APIs, and jsdom for component
tests. Tests use local fixtures and mocked fetch; they do not need the API,
PostgreSQL, or a browser. They cover
generated schemas, validation before RTK caching, multipart transport, and
generation determinism/stale-file detection. Strict TypeScript checks include
the tests and type-compatibility assertions during `npm run build`.

Tests are grouped by purpose, with supporting data and helpers beside their
consumers:

```text
tests/
├── api-client/
│   ├── client.test.ts
│   ├── booksApi.test.ts
│   ├── response-contracts.test.ts
│   └── fixtures/book.ts
├── components/
│   ├── App.test.tsx
│   ├── Book.test.tsx
│   ├── BookShelf.test.tsx
│   └── LibraryPage.test.tsx
└── scripts/
    ├── api-generation.test.ts
    ├── fixtures/
    │   ├── minimal-openapi.ts
    │   └── integration-openapi.ts
    └── helpers/load-generated-registry.ts
```

`tests/api-client/` tests the frontend connection layer: request serialization,
response validation, generated contract types, and error handling. Backend
correctness belongs to the backend's test suite. Browser integration is
exercised by the Cypress feature tests, including their isolated live mode.

`client.test.ts` covers shared transport, schema selection (including endpoint
overrides), and validation at the RTK boundary. `booksApi.test.ts` covers book
resource configuration: infinite pagination, URL transformation, cache tags,
error-schema wiring, and invalidation. `response-contracts.test.ts` covers the
generated schemas and their TypeScript compatibility. A book fixture in a shared
client test is representative wire data, rather than book-specific behavior.

`npm test` discovers Vitest suites under `tests/`. Fixture/helper filenames do
not end in `.test.ts`, so they are not collected as suites.
Component behavior tests live under `tests/components/` and are discovered
by the offline configuration, including `.test.tsx` suites. Keep test
documentation under `docs/` or here.

`LibraryPage.test.tsx` supplies API results at the service boundary and tests
page-owned deduplication, selection, query-state mapping, and action wiring.
It does not repeat transport validation, request offsets, or shelf layout tests.
The app-wide text-size regression during asynchronous loading lives in
`App.test.tsx` and uses the real API integration with mocked fetch.

Browser tests live under `cypress/`, with readable Gherkin features and their own
configuration/runner. Run `npm run cy:run:mock` without a backend, or
`npm run cy:run:live` to provision an isolated API from the sibling backend
checkout. `npm run cy:open:mock` opens the interactive runner.

`npm run coverage` runs Vitest and Cypress with Istanbul and produces a combined
frontend report at `coverage/combined/index.html`. There are no percentage
thresholds yet; backend coverage stays separate. See
[browser tests and coverage](docs/browser-tests.md) for prerequisites, commands,
database isolation, artifacts, coverage exclusions, and dependency upgrades.

Shared WebStorm configurations live together in `.run/`:

- **dev** and **storybook** launch the existing npm development scripts and open
  Chrome with WebStorm's JavaScript debugger attached. Use **Run** to start either
  configuration, then set breakpoints in component or application source files.
  These use the npm configuration's **Browser / Live Edit** settings.
  The **dev** configuration uses `vite.local.config.ts`, listening at
  `http://localhost:5173/` on this PC. It proxies `/api` (including
  PDF ranges) to `http://127.0.0.1:8000`; the backend can keep its existing local
  IDE startup. Browser API requests use the frontend's origin. To launch the same
  frontend from a terminal, use `npm run dev -- --config vite.local.config.ts`.
  Localhost is a loopback address: connections return to this same machine and
  browsers treat it as a secure context even over HTTP. LAN devices use the
  [Caddy deployment](../deploy/README.md).
  Ports are fixed to 5173 and 6006 respectively; stop any server already using
  that port first. Storybook's own automatic browser launch is disabled in its
  debugger configuration to avoid opening a second window.
- **Frontend tests** uses WebStorm's native Vitest runner, with `vitest.config.ts`.
- **API contract check** runs the read-only `api:check` npm task; it is a generation
  freshness check, not a Vitest suite.

Select Node 22.18+ as the project's JavaScript runtime; all configurations use
the project runtime. The native configuration type ID is
`JavaScriptTestRunnerVitest` (its displayed name in WebStorm is **Vitest**).
Individual tests can also run/debug from the editor gutter. Contract checking
needs the backend; the test configuration does not.

For Boox debugging, enable **Apps > top-right menu > App Management > USB Debug
Mode** ([Boox guide](https://booxsupport.zendesk.com/hc/en-us/articles/8569441562004-App-Management-Settings)).
Use Chrome on the device and connect it to the PC by USB. In desktop Chrome, open `chrome://inspect/#devices`,
enable **Discover USB devices**, authorize the PC on the Boox, and choose **inspect**
for the reader tab. Console shows frontend errors; Network shows API/PDF requests;
Sources supports breakpoints in the Vite TypeScript modules. Device/browser support
for remote inspection varies; see [Chrome's Android debugging guide](https://developer.chrome.com/docs/devtools/remote-debugging).

Reader layout hashing uses the browser's Web Crypto API and requires a secure
context. Use HTTP localhost for IDE development or the trusted HTTPS origin for
LAN access. PWA installation and service workers also require a secure context.

Reader gestures are owned by `ReaderControls`, using `@use-gesture/react` for
touch tracking. One finger turns text pages; two fingers swiped horizontally
switch Text/PDF. PDF scrolling and native pinch remain browser-controlled.

## Component development

Run Storybook to view and exercise reusable components in isolation:

Each reusable component has its own folder under `src/components/`, with its
component, stories, and private helpers together. `Book` and `ReaderSegmentContent`
live in `atoms/Book/` and `atoms/ReaderSegmentContent/`; `BookShelf` lives in
`molecules/BookShelf/`. The library components use the Storybook groups
**Atoms/Library/Book** and **Molecules/Library/BookShelf**.
Behavioral tests remain under `tests/components/`.

`ReaderPage` lives in `atoms/ReaderPage/`, with six **Atoms/Reader/ReaderPage**
stories. It takes ordered segments and an accessible label, fills a fixed-size
parent, and uses CSS Modules for its column viewport. ReaderContext supplies the
controlled page/count, existing text-size preference and actions; ReaderProvider
maps these to Redux. ReaderPage observes its actual dimensions and cancels obsolete
font/layout work locally before reporting a plain page count. No layout/session
models are required. Stories supply context directly from Controls, without
Redux. The reader is not wired into the book route yet.

Run `npm run cy:run:component` for independent Chrome viewport/measurement
checks, or `npm run cy:open:component` for interactive component tests. See
[browser tests](docs/browser-tests.md) for setup and coverage details.

```bash
npm run storybook
```

Create a production Storybook build with:

```bash
npm run build-storybook
```

Storybook explicitly resolves React and React DOM to the project installation
and prebundles their renderer/JSX entry points together. After changing Storybook
configuration or dependencies, restart its dev server and reload any existing
preview tabs so they use the refreshed dependency graph.

The IDE's `--no-open` startup also warms up story modules, since it does not use
Vite's automatic browser-open prewarming. This targets first-load timing; the
WebStorm debugger launch itself still needs verification in the IDE.

## Application shell

The compact header provides Back on book pages and app-wide text-size controls.
Back uses application history, falling back to the library for direct book entry.
The recording footer and route have been retired. Existing recordings remain in
IndexedDB for data compatibility; removing the feature does not clear cached books.

The production build generates the web app manifest and service worker in
`dist/`.

## Sample cover images

The bundled sample covers were retrieved from the
[Open Library Covers API](https://openlibrary.org/dev/docs/api/covers) using
cover IDs `14348537`, `13335427`, `8775559`, `13859660`, `12356249`, and
`6717853`. They can be replaced when the real library import flow is added.
