# Repository working agreements

## Keep changes comfortable to review

- Implement the requested behavior with the smallest clear change. A chunk is a
  human review boundary, not permission to build every related extension point.
- Before editing, briefly state the intended files, behaviors and test layer.
  Do not turn this into another planning artifact or an approval round.
- Treat roughly 400 added/changed lines of production code, tests and stories as
  a scope warning, excluding generated files and documentation. This is neither
  a quota nor a reason to compress readable code or omit required behavior.
  Simplify first. If the required work still needs a substantially larger change,
  propose a smaller review boundary before implementation rather than delivering
  a large diff and explaining afterward.
- Add state, actions, types, guards and abstractions only for behavior exercised
  in the current chunk. Future consumers are not a justification. Use ordinary
  typed props and existing helpers before creating parallel view models/adapters.
- Prefer one explicit parameterized action over several trivial inverse actions
  when it expresses the same behavior. Shared actions do not require a generic
  command framework or lifecycle statuses for synchronous updates.
- Keep helpers and fixtures beside their consumer. Extract shared test machinery
  only when existing tests actually need it; do not create factories, probe
  components or harness suites merely to accommodate a few new fields.
- Keep unrelated files unchanged. Do not rewrite existing tests/stories for
  consistency beyond the lines required by the change.
- A plan/prompt revision request is documentation-only. Do not resume rejected
  implementation, recover discarded changes, reset Git, or commit unless asked.

## Test each concern at the appropriate layer

- Vitest: pure rules, meaningful state transitions, and independent component
  behavior/corner cases. Use controlled ReaderContext for reader components.
- Group tests in `describe` blocks named for the component or rule; use nested
  groups for distinct concerns. Keep `it` descriptions short and plain, stating
  one expected outcome. Put shared context in the group name instead of packing
  several behaviors or implementation terms into a test title.
- Each test owns its mutable fixtures, mocks and initial state; shared read-only
  examples are fine. Split separate behaviors into independent cases instead of
  chaining scenarios to reuse setup.
  Start directly in the state a case needs. Keep related assertions about one
  outcome together; one assertion per test is not required. Parameterize cases
  of the same rule without conditional assertions.
- Test a behavior once at its lowest useful layer. Do not duplicate the same
  matrix across component, reducer, provider and browser suites. Simple property
  assignment, selector access and one-to-one dispatch wiring need no separate
  suites. Add adapter tests when the adapter performs meaningful translation.
- Cypress component tests: actual layout, fragmentation, reflow or browser-only
  behavior that jsdom cannot establish. Do not add browser coverage automatically
  for every component or repeat unit cases in Chrome. Reuse the existing setup.
- Feature tests: complete application flows, including happy and negative paths.
  New/changed reader feature scenarios belong only to chunk 11.10. Integrated
  ToC/page/search journeys belong there, not in earlier component-test harnesses.
- Stories: a few representative states with Controls, using the existing context
  decorator pattern. No Redux stores, production provider or elaborate data
  simulation in presentation stories. Do not add a story for every permutation.
- Keep security, data integrity and real race-condition checks. Remove redundant
  coverage, not distinct failure modes. Never test test helpers for their own sake.
- Run `npm run quality` for implementation changes, plus relevant browser checks.
  It already runs formatting, lint, Vitest, Cypress TypeScript and both builds.
  Do not rerun its stages separately without a specific reason. Documentation-only
  changes need formatting/link/consistency checks, not application/browser suites.

## Existing coding and reader contracts

- Reader UI targets low vision and e-ink: use large, obvious, high-contrast controls
  with static feedback. Avoid smooth motion, subtle affordances and immersive effects.
- Prefer Tailwind utilities for component styling. Retain CSS for imported content
  formatting and complex descendant rules where it is clearer.
- Use explicit verbs/verb phrases for functions, and is/has/can for predicates.
- Separate test setup, action and assertion groups with blank lines. Apply the
  same readable spacing to stories/helpers; leave untouched files alone.
- Define Redux Toolkit selectors in the slice's `selectors` option and export
  from `slice.selectors`. Adapters use those selectors through hooks rather than
  duplicating root-state traversal.
- Reader components are Redux-free and use ReaderContext. ReaderProvider maps
  context actions to central Redux actions; it owns no competing reader state.
  Canonical content stays in Dexie. DOM refs/transient geometry stay local.
- For reader chunks read `../plan/README.md`,
  `../plan/00-source-findings-and-decisions.md`,
  `../plan/11-reader-text-and-toc.md`, the target chunk and preceding records.
  The index's current review/testing policy supersedes older repeated checklists.
