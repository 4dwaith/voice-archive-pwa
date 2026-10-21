# Voice Archive PWA

A local React and TypeScript application scaffolded with Vite, styled with
Tailwind CSS 4, and configured as an installable PWA.

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

`npm run quality` runs formatting checks, lint, Vitest, strict TypeScript/application
build, and Storybook build. It does not need a running backend.

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
- `api:regenerate` replaces files under `src/api/generated/`. Review the diff.
- Neither command stages files, commits, or modifies backend data.
- Set `OPENAPI_URL` to override the generation URL. Set `VITE_API_BASE_URL` to
  override the runtime origin (default `http://127.0.0.1:8000`). Generation and
  runtime configuration are independent. Ordinary builds use tracked generated
  output and never fetch OpenAPI.

The generation scripts are TypeScript, strictly checked by `npm run build`.
Node 22.18+ executes them directly with built-in type stripping, so no separate
TypeScript runner is required.

## Tests and WebStorm

```bash
npm test
npm run test:watch
```

Vitest uses `vitest.config.ts` and Node's Fetch/File APIs. Tests use local fixtures
and mocked fetch; they do not need the API, PostgreSQL, or a browser. They cover
generated schemas, validation before RTK caching, multipart transport, and
generation determinism/stale-file detection. Strict TypeScript checks include
the tests and type-compatibility assertions during `npm run build`.

Tests are grouped by purpose, with supporting data and helpers beside their
consumers:

```text
tests/
├── api-client/
│   ├── client.test.ts
│   ├── response-contracts.test.ts
│   └── fixtures/book.ts
└── scripts/
    ├── api-generation.test.ts
    ├── fixtures/
    │   ├── minimal-openapi.ts
    │   └── integration-openapi.ts
    └── helpers/load-generated-registry.ts
```

`tests/api-client/` tests the frontend connection layer: request serialization,
response validation, generated contract types, and error handling. Backend
correctness belongs to the backend's test suite. Browser-level integration will
be exercised by the planned Cypress feature tests; there is no separate live
backend smoke-test suite in this frontend.

`npm test` discovers Vitest suites under `tests/`. Fixture/helper filenames do
not end in `.test.ts`, so they are not collected as suites.
Future component tests can live under `tests/components/` and will be discovered
by the offline configuration. Keep test documentation under `docs/` or here.

Phase 07 will add the separate top-level `cypress/` directory specified in the
roadmap, with `e2e/*.feature`, `step_definitions/`, `fixtures/`, and `support/`.
Cypress BDD tests will use their own configuration and runner. Share fixture
code across runners only when an actual common use arises.

Shared WebStorm configurations live in `.run/`: **Frontend tests** (native Vitest
run/debug), **Frontend tests (npm)**, and **API contract check**
(read-only npm task). Select Node 22.18+ as the project's JavaScript runtime;
all configurations use the project runtime.
Individual tests can also run/debug from the editor gutter. Contract checking
needs the backend; the test configuration does not.

## Component development

Run Storybook to view and exercise reusable components in isolation:

```bash
npm run storybook
```

Create a production Storybook build with:

```bash
npm run build-storybook
```

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
