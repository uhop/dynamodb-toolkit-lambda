# Architecture — dynamodb-toolkit-lambda (frozen thunk)

Since 0.4.0 this package is a re-export thunk over the core package's
`dynamodb-toolkit/lambda` subpath. There is no implementation here:

- `src/index.js` — `export * from 'dynamodb-toolkit/lambda'` (ESM, `@ts-self-types` sidecar convention).
- `src/local.js` — path-compat re-export of `dynamodb-toolkit/lambda/local.js` (the local-debug bridges).
- `src/read-lambda-body.js` — path-compat re-export of `dynamodb-toolkit/http/lambda/read-lambda-body.js` (consumers imported it via the `./*` wildcard).
- matching `.d.ts` re-exports next to each `.js`.
- `tests/` — verify the re-export surfaces match the core modules (identity per symbol) plus `require(esm)` interop and a typed smoke.

The real architecture is documented in the core repo's `ARCHITECTURE.md`
(module `http/` — ports over a shared neutral-result engine). The pre-thunk
standalone implementation is preserved in git history at tags ≤ 0.3.0.
