# Frontend API contract policy

## Source and generated output

The live backend `/openapi.json` is authoritative. `api:regenerate` fetches it
once and supplies the same temporary, normalized input to both generators:

- `@rtk-query/codegen-openapi` **2.2.0** generates JSON/bodyless endpoints, hooks,
  and wire types in `src/api-client/generated/endpoints.ts`.
- Orval **8.45.0** generates reusable Zod **4.6.7** schemas, input/output types,
  and operation/status schemas in `src/api-client/generated/schemas.ts`.
- The generation script derives response-schema associations, error-schema
  associations, and multipart endpoint metadata into `validation.ts`.
- Prettier **3.9.10** formats all output with the project configuration.
- Vitest **5.0.5** exercises contract and boundary behavior.

All three generated files are tracked and carry a generated-file marker. Never
edit them manually. Configuration lives in `scripts/api-config.ts`; orchestration
and the small metadata writer live in `scripts/api-generation.ts`. All scripts
are strictly type-checked, including the generators' configuration types. Node
22.18+ runs them directly using built-in type stripping; no extra runner or
compilation step is needed to execute them.

No generation step runs during application/Storybook builds. `api:check` generates
into OS temporary storage, compares content and filenames, and exits nonzero on
drift without changing tracked files. `api:regenerate` explicitly replaces
generated files. Neither command runs Git operations or writes application data.

Generation tests cover repairing stale/missing output, removing obsolete generated
files, refusing unfamiliar obsolete files without changing the directory, and
cleanup/preservation after an injected Orval failure following successful RTK
generation. Replacement validates all obsolete files before deleting any of them;
individual filesystem writes are still not one atomic transaction.

A richer valid synthetic contract is run through both real generators. Tests load
the freshly generated validators and check multiple success shapes, status-specific
errors, Unicode boundaries, multipart metadata/Blob arguments, bodyless deletion,
and PDF/HEAD exclusions. These tests target our generation/integration behavior;
they do not attempt to fuzz the backend library's OpenAPI output.

Vitest suites are organized under `tests/api-client/` and `tests/scripts/`.
Frontend connection-layer fixtures live in `tests/api-client/fixtures/`; generator-only
OpenAPI fixtures and loading helpers live under `tests/scripts/fixtures/` and
`tests/scripts/helpers/`. Backend tests own backend correctness, `api:check` checks
generated-output freshness, and planned Cypress features will exercise browser
integration. There is no separate frontend live-backend smoke suite. The Cypress
BDD suite belongs in a separate top-level `cypress/` tree.

## Models and API imports

Do not declare server entities by hand under `src/models/` or elsewhere in the
application. Import server schemas and types from `src/api-client/generated/schemas`;
prefer generated `*Output` types for parsed values. Generated RTK request/response
types live in `generated/endpoints.ts`; compile-time tests check result-type
agreement with Zod output.

Book and BookShelf use generated `BookResponseOutput` values directly; there is
no intermediate BookCardModel or renamed coverImage field. Initials are derived
in the component. Mock books are only imported by Storybook and use generated-schema
validation; production library data comes from RTK Query.
Local recordings remain a separate client-owned model.

`src/api-client/archiveApi.ts` exports the shared `archiveApi`, attaches generated
contracts, and supplies the reducer/middleware installed once in the store.
Feature modules independently import and extend this instance; they do not
consume the previous feature module's result or require a central composition
chain. This follows RTK Query's endpoint-injection/code-splitting pattern.

Import `booksApi` from `src/api-client/resources/booksApi` for book hooks and selectors
(`booksApi.useLibraryBooksInfiniteQuery`, etc.). Import `archiveApi` for shared
operations such as health. Do not consume the raw generated API directly in
application features: its validators are attached by the shared module.

Resource modules live under `src/api-client/resources/`. Each enhances its
generated endpoints with resource-specific cache tags; injecting additional
endpoints is optional. `booksApi.ts` owns book cache enhancements and
infinite-query injection.
Its exported `booksApi` is the same runtime API/cache, with additional endpoint
types. API-owned selectors carry those injected types without requiring the
store's RootState to enumerate every independently loaded module.
The infinite endpoint sets
`extraOptions: { errorSchemaEndpoint: 'listApiV1Books' }` to reuse the generated
list operation's error validators. The shared client reads this optional mapping
and otherwise uses the RTK endpoint's own name; it has no book-specific logic.

The enhanced API reducer and middleware are installed in the production Redux
store. `libraryBooks` is an infinite-query endpoint using the generated list
request builder and generated `BookList` schema, fetching 24 books per page.
Its `rawResponseSchema` validates and strips the wire payload before
`transformResponse` resolves cover/PDF paths against the API origin. The cache
retains the generated book shape, including nullable file URLs and metadata.
Pages stay in one RTK cache entry; LibraryPage derives a deduplicated view by ID.
Empty pages terminate loading defensively. Offset pagination reflects current
server ordering, not a database snapshot; inserts/deletes between requests can
change the visible set until refresh.

Book list/entity tags allow successful generated book mutations to invalidate
the library without clearing unrelated endpoints. RTK's default cache retention
applies (60 seconds after the final subscriber leaves); this is not offline
metadata persistence. Refetches refresh loaded pages sequentially. The infinite
endpoint uses the generated list operation's status-specific error validators.

## Runtime behavior

Every generated JSON success endpoint has a generated `responseSchema` association.
RTK's Standard Schema support parses the response before caching it. Unknown
response properties are accepted and stripped recursively in all environments.
Invalid required fields, types, enums, nullability, and date formats fail without
coercion. Schema failures become a `CUSTOM_ERROR` with
`data.code = response_contract_error`; invalid values do not enter the cache.

Documented JSON error payloads are validated by endpoint and HTTP status in the
shared base query, including domain unions and readiness's separate 503 shape.
Network failures retain RTK's `FETCH_ERROR`. Unexpected undocumented statuses
retain the underlying HTTP error; the frontend does not invent an error model.

Dates remain RFC 3339 strings with timezone information; UTC `Z`, explicit offsets,
and fractional seconds are supported. They are never coerced into JavaScript Dates.
Nullable response fields remain required when OpenAPI marks them required.
PATCH omission and explicit null remain distinct. Zod 4 integers reject unsafe
JavaScript integers; a future need for IDs above `Number.MAX_SAFE_INTEGER` needs
a string-ID wire contract, not silent rounding in the frontend.

The backend remains responsible for semantic rules absent from OpenAPI (for
example langcodes normalization). Frontend validation is not authorization.
Request validators are generated for compatibility and future form use; this
phase does not add form validation or promise to reproduce all Python validators.

JSON Schema string limits count Unicode code points; Zod's native string length
checks count UTF-16 code units. A generic TypeScript AST transformation in
`scripts/zod-unicode.ts` replaces generated string min/max checks with equivalent
code-point refinements. This preserves valid non-BMP text at the backend's length
boundaries without introducing handwritten model constraints. Numeric limits are
unchanged. Boundary tests cover this compatibility adjustment.

## Multipart and binary resources

The live upload schemas represent file fields with OpenAPI 3.1
`contentMediaType: application/octet-stream`. The pinned RTK generator needs an
equivalent `format: binary` hint to generate Blob arguments. A generic traversal
adds it only to temporary input; the backend and its OpenAPI document are unchanged.
Orval recognizes these fields as Blob validators. The shared transport converts
generated upload objects to FormData, preserves File names, and lets fetch set
the multipart boundary. Generated endpoint URL/method/body wiring stays intact.

Binary GET and HEAD operations are deliberately excluded from RTK generation.
PDFs and covers are on-demand resources accessed through the server-generated
`source_pdf_url` and `cover_url`, resolved against the API origin. Do not place
file bytes in Redux or Dexie book rows. Orval may emit unused unknown schemas for
binary operations; these are not JSON validators and are never attached to RTK.
Native range responses (206, multipart/byteranges, text errors, 416) remain file
transport concerns. Bodyless delete endpoints are generated without a JSON schema.

## Upgrades

1. Upgrade pinned generator/Zod versions deliberately and retain `package-lock.json`.
2. Start the backend and run `npm run api:regenerate` with a supported Node runtime.
3. Review generated diffs for required/nullable properties, readonly delivery URLs,
   timestamps, multipart Blob types, named errors/unions, and binary exclusions.
4. Run `npm run quality` and `npm run api:check`. Ordinary tests include deliberate
   stale-output detection against a tiny synthetic contract, without modifying
   the real generated files or requiring the backend.
5. Keep the binary compatibility hint only while the RTK generator needs it.

The metadata writer currently requires unique explicit snake_case operation IDs,
matching the backend. Unsupported naming or response status patterns fail generation
instead of silently omitting validation. Type-check generated enhancements after
every upgrade to catch changes in either generator's naming conventions.
