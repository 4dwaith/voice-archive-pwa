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
  override the runtime origin (default `http://127.0.0.1:8000`). Generation and
  runtime configuration are independent. Ordinary builds use tracked generated
  output and never fetch OpenAPI.

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
origin, defaulting to `http://127.0.0.1:8000`; generated paths already include
`/api/v1`. Cover paths resolve against that origin and image bytes stay outside
Redux. Changing the environment setting requires restarting Vite. This phase
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

## Voice recordings

The fixed footer records audio with the browser MediaRecorder API. The latest
15 clips are stored locally in IndexedDB through Dexie and can be played from
the Recordings route. Microphone access requires HTTPS in production; localhost
is accepted during development.

The production build generates the web app manifest and service worker in
`dist/`. Camera and microphone APIs require HTTPS in production (localhost is
accepted during development).

## Sample cover images

The bundled sample covers were retrieved from the
[Open Library Covers API](https://openlibrary.org/dev/docs/api/covers) using
cover IDs `14348537`, `13335427`, `8775559`, `13859660`, `12356249`, and
`6717853`. They can be replaced when the real library import flow is added.
