# Dependency security review — 2026-10-28

`npm audit` initially reported seven affected packages: one high, two moderate
and four low. These represent nine underlying advisories in two libraries;
the parent-package entries repeat their transitive dependencies' findings.
All affected packages are development/build dependencies. `npm audit --omit=dev`
reports zero vulnerabilities; that result does not assess backend or browser bugs.

## Findings and fixes

Undici 7.29.1 was installed through jsdom and Orval's Scalar JSON tooling:

| Severity | Advisory                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| High     | [Unhandled errors on excessive content encodings](https://github.com/advisories/GHSA-xjj6-f33q-929c)                  |
| High     | [Cross-origin redirect cache poisoning and cross-user disclosure](https://github.com/advisories/GHSA-4w7w-5xrc-9h26)  |
| High     | [Dropped Agent TLS options bypass certificate validation](https://github.com/advisories/GHSA-2m5v-pch6-74hx)          |
| High     | [TLS 1.2 certificate-changing renegotiation denial of service](https://github.com/advisories/GHSA-qrxm-fqhp-jwvm)     |
| Moderate | [Unbounded EventSource parser memory](https://github.com/advisories/GHSA-4qv8-2p9j-2685)                              |
| Moderate | [Subresource Integrity bypass with non-lowercase algorithm tokens](https://github.com/advisories/GHSA-f72v-6w45-q472) |
| Moderate | [Unbounded automatic WebSocket PONG buffering](https://github.com/advisories/GHSA-9fm3-97px-rjf6)                     |
| Moderate | [Unhandled exceptions in the decompress interceptor](https://github.com/advisories/GHSA-55wc-3pg8-jfw6)               |

Updated the exact Orval pin **8.43.0 → 8.45.0**, which uses patched Scalar
dependencies, and refreshed compatible Undici resolutions to **7.30.1** for both
Orval and jsdom. No override, Node requirement change or application changes were
needed. The [Orval release](https://github.com/orval-labs/orval/releases/tag/v8.45.0)
and [Undici security release](https://github.com/nodejs/undici/releases/tag/v7.30.1)
describe these fixes. Keep the updated lockfile when installing with `npm ci`.

## Remaining low-severity advisory

[Deepmerge prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
affects installed **4.3.1**. The dependency path is:

`vite-plugin-pwa → workbox-build → @rollup/plugin-node-resolve → deepmerge`

This is one advisory reported against four packages. No patched Deepmerge version
is published. Latest Workbox 7.4.1 and Rollup node-resolve 16.0.3 retain it; even
vite-plugin-pwa 2.0.0 still uses that Workbox release. A major upgrade does not
remove the finding. npm's suggested forced fix downgrades vite-plugin-pwa to
0.2.1; that is not a maintained upgrade for the current toolchain and was not applied.

Inspection of the installed Rollup plugin's ESM/CJS implementations found its
Deepmerge call only clones static internal defaults (`deepMerge({}, defaults)`),
not imported book/API data or user-supplied options. This limits apparent exposure
in this dependency path; it does not fix the vulnerable library or clear the audit.
Removing the dependency altogether would require a maintained upstream fix or a
separately reviewed replacement/patch. No downgrade, custom fork or audit suppression
was introduced just to change the reported count.

## Verification

- `npm audit`: **four low**, zero moderate/high/critical; production-only audit
  remains **zero**.
- `npm run api:check` against the running local backend: **passed**, generated
  schemas/endpoints unchanged.
- `npm run quality`: **passed**, including **217 tests / 23 files**, formatting,
  lint, TypeScript, PWA/service-worker and Storybook builds. Existing bundle-size
  warnings remain.
- Chrome 156: `npm run cy:run:mock` **25 scenarios passed** and
  `npm run cy:run:component` **15 checks passed / 4 specs**.
- No new tests or changes to application, Cypress or generated API source.
