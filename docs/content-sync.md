# Structured book synchronization

Library selection opens `/books/:bookId`. The minimal route shows Loading… and
its library cover while waiting for the first committed segment batch. It stays
open when text is unavailable, showing “There’s no text data for this book.”
A failed request shows an inline retry action; deleted books show an unavailable
error. Text rendering, reader hooks, settings, and page measurement are phase 11.

## Ownership and entry points

- Dispatch `requestBookLoad(bookId)` on open, `requestBookRetry(bookId)` after an
  error, and `requestBookClose(bookId)` when leaving. `requestBookRemoval(bookId)`
  removes local content and position. These are intent actions, not promises.
- `bookDownloadsSlice` owns serializable per-book status, manifest/version,
  expected counts (in the manifest), committed row counts, section completion,
  last stored segment sequence, and errors. Components use Redux selectors.
  Component intent actions use `request…`; middleware results use `record…`,
  including request start, manifest arrival, committed batches, request success/
  failure, and request completion after its work/cleanup has finished.
- `bookDownloadsListener` owns side effects. Duplicate load requests coalesce
  while loading. A close/removal cancels the current request; removal or immediate
  reopen waits for its actual pending writes and cleanup to finish first.
  Different books can download independently. There is no custom subscriber,
  controller/promise registry, or component-local copy of sync progress.
- `synchronizeBookContent` checks the manifest, selects reuse/refetch/offline/no-text
  behavior, stages content, and marks completion. `downloadBookSections` and
  `downloadBookSegments` independently fetch and store their paginated collections.
- The content API resource creates a transport with the listener's dispatch;
  it does not import the singleton store. Existing generated RTK endpoints perform
  schema validation. Responses have no additional manual content validators.
- Content types live in `src/models/content.ts`; small database operations remain
  in `src/data/contentRepository.ts` alongside `database.ts`. Previously reviewed
  pure hierarchy/path/root-audio helpers live in `src/utils/contentHierarchy.ts`.
  The speculative batched reader iterator and custom sync service were removed.

## Download and invalidation behavior

Every open checks the manifest. A complete matching Dexie cache is reused without
section or segment requests. Only a network failure permits offline reuse; HTTP
errors and invalid API responses are not treated as offline success. Other request
failures preserve an existing complete cache unless it is confirmed stale/missing.

Sections (2,000/request) and segments (500/request) fetch concurrently through RTK.
Both use integer offsets and the pinned `If-Content-Version` header. Sections arrive
in persisted preorder; segment sequence gaps do not affect pagination. Segment
writes wait for the small section download to resolve stored `root_section_id`
(null for unsectioned text). Each batch atomically commits its rows and next offset in a Dexie transaction,
then updates Redux progress. Dexie stores independent section/segment offsets
(zero before the first batch, null after the last batch) and the last committed
segment sequence. Partial staging is not considered complete offline content. RTK releases transient
responses after transfer; canonical text is not duplicated in a long-lived slice.

A changed manifest version deletes stale content and logical position, then
fetches the current data without leaving the route. A version failure during a
paginated read, or a changed final manifest, also clears staging and restarts.
Publication changes are retried at most three attempts per load; repeated changes
produce a recoverable error. An unpublished/no-text manifest clears old content
and produces the empty state. A deleted book clears its cache and produces an
unavailable error. There is no title/source-key migration across versions.

Each download checks page versions, advancing offsets and expected total counts.
Completion rechecks the manifest version/state before marking Dexie complete.
There is no final full-book scan, manual field/relationship validation, diagnostic
timing state, polling, focus refresh, or cross-tab job coordination. A stream
failure cancels its sibling, and both writers settle before the request completes.
Failures and closing retain valid committed batches. On retry or reopening, a
matching manifest resumes each unfinished stream at its durable offset, skips
completed streams, and restores Redux progress from Dexie. Section ancestry is
rebuilt from stored preorder before resuming so child segments retain their roots.
A failed batch transaction rolls back both its rows and checkpoint. If only the
final manifest check failed, retry checks the manifests without downloading rows
again. Version changes, purge/deletion, and explicit local removal still clear
content and positions.

Dexie schema 5 preserves recordings and adds structured content/versioned logical
positions. Schema 4/5 upgrades clear incompatible old projections while preserving
recordings and saved positions for the next fetch. Resume checkpoints are optional
metadata fields and need no new indexes or schema upgrade. Existing complete
caches remain reusable; older incomplete caches without checkpoints restart once.
File URLs are normalized by
copying API results, which may be frozen. PDF/audio bytes are never downloaded or
stored by synchronization; on-demand media delivery stays range-capable.

## Verification

Vitest integration tests create an isolated real store with listener middleware,
RTK endpoints, and fake IndexedDB, mocking HTTP only except when deliberately
holding or failing a database write. They check concurrent requests, coalescing,
progress after commits, cache reuse, version changes during reads/final checks,
retry bounds, no-text/deleted states, contract errors, offline reuse, pagination,
quota errors, atomic checkpoint rollback, resume after fresh-store reopening,
section ancestry across resumed pages, cancellation/removal/reopen, and schema upgrades.

Cypress mock/live scenarios exercise the minimal route, progressive availability,
retry, offline content, purge/no-text, replacement imports without redirects, and
actual conditional range requests. The test-only harness lives under `src/testing`
and is enabled only with `VITE_E2E_TESTING_HARNESS=true`; production builds exclude it.
It dispatches the same Redux intents and reads tiny fixture records for assertions.
Routine fixtures are synthetic; no complete sample book is added to public assets.

The planned phase 11 reader will query complete root sections through useLiveQuery,
including an implicit Before unit for unsectioned front matter. Those hooks and
page-count stores are not implemented by this phase.
