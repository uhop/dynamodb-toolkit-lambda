# Architecture — dynamodb-toolkit-lambda

Internal layout and design notes for maintainers. Consumer-facing docs live in the [wiki](https://github.com/uhop/dynamodb-toolkit-lambda/wiki); the machine-readable API reference is in `llms.txt` / `llms-full.txt`.

## Shape

ESM-only JavaScript with a hand-written `.d.ts` sidecar next to every `.js` — no build step, no transpiler. Zero runtime dependencies; `dynamodb-toolkit` is the only peer dependency, and there is no framework peer (the target is AWS Lambda's own Node runtime). `@types/aws-lambda` is a dev-only type dependency. Each `.js` opens with a `// @ts-self-types="./<file>.d.ts"` directive so its sibling `.d.ts` is the sole source of types and docs; `.js` files hold no JSDoc beyond the load-bearing inline `/** @type */` annotations the implementation needs to type-check (the `ListOptions` and write-body casts in `index.js`).

A Lambda event shim, not a framework. All parsing, envelope building, policy merging, and route-shape matching are delegated to the parent toolkit; this package owns only event-shape detection, `Event` → `Result` translation, and error mapping.

## Composition

`createLambdaAdapter(adapter, options)` is the single public entry. It closes over the merged `policy`, `sortableIndices`, the `keyFromPath` / `exampleFromContext` extractors, `maxBodyBytes`, and `mountPath`, then returns one `(event, context) => Promise<result>` handler. The returned function is the whole runtime surface — there is no per-request object construction beyond the closures.

Delegation targets in the parent:

| Import                                                                                                                                                                                                                           | Responsibility                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `dynamodb-toolkit/rest-core` (`parsePatch`, `parseNames`, `parseFields`, `parseFlag`, `buildEnvelope`, `paginationLinks`, `mergePolicy`, `mapErrorStatus`, `buildListOptions`, `resolveSort`, `stripMount`, `validateWriteBody`) | Framework-agnostic REST primitives — parsers, builders, policy, mount stripping, DoS gates. |
| `dynamodb-toolkit/handler` (`matchRoute`)                                                                                                                                                                                        | Route-shape matching (`HEAD → GET` auto-promote).                                           |
| consumer-supplied `Adapter`                                                                                                                                                                                                      | The DynamoDB layer — `getList` / `getByKey` / `put` / `patch` / mass ops.                   |

Unlike the koa / express / fetch siblings, the JSON body reader is **not** imported from the parent. Lambda delivers bodies as already-materialized strings, so `src/read-lambda-body.js` is a synchronous reader (no stream to guard): optional base64 decode → byte-length check → `JSON.parse`, with the same `413` / `400` error shapes as the parent's stream reader.

## Event-shape detection

One handler serves four event shapes; `detectKind(event)` sniffs each invocation:

- `event.requestContext.elb` present → **ALB** (`ALBEvent` → `ALBResult`).
- `event.version === '2.0'` → **v2** (API Gateway HTTP / Lambda Function URL → `APIGatewayProxyStructuredResultV2`).
- otherwise → **v1** (API Gateway REST → `APIGatewayProxyResult`).

Order matters: an ALB event carries `httpMethod` + `path` just like v1, so the `elb` marker must be checked first or ALB mis-classifies as v1 and the response goes out in the wrong envelope shape (which ALB rejects). Shape then drives three reads — `readMethod` / `readPath` (v2 reads `requestContext.http.method` / `rawPath`; v1 / ALB read `httpMethod` / `path`) and `coerceQuery` (first-value-wins; v1 / ALB prefer `multiValueQueryStringParameters` since AWS sometimes populates only one of the two bags).

Two shape-specific normalizations run before dispatch:

- **`flattenV2Cookies`** — v2 puts cookies in `event.cookies: string[]`, not the `Cookie:` header. They are joined back into `event.headers.cookie` so `exampleFromContext` sees one shape across triggers. The event is mutated in place — Lambda events are never reused across invocations.
- **`wantsMultiValueHeaders`** — ALB with multi-value mode enabled stamps `multiValueHeaders` populated and `headers: null`, and strictly requires the response in the same shape. The sniff (`event.multiValueHeaders && event.headers === null`) keys on the explicit `null` sentinel so a malformed `headers: undefined` event doesn't flip into multi-value mode. v1 accepts either form (single-value emitted as the simpler default); v2 has no multi-value mode.

## Dispatch

The handler coerces the query, strips `mountPath` with the parent's `stripMount` (a non-match → `404`), then `matchRoute(method, path, policy.methodPrefix)` classifies the request into one of four `route.kind` buckets:

- `root` — `GET` / `POST` / `DELETE /` → list / post / `deleteListByParams`.
- `collectionMethod` — the `-by-names`, `-load`, `-clone` / `-move`, `-clone-by-names` / `-move-by-names` endpoints.
- `item` — `GET` / `PUT` / `PATCH` / `DELETE /:key` (the `:key` segment runs through `keyFromPath`).
- `itemMethod` — single-item `PUT /:key/-clone`, `PUT /:key/-move`.

An unknown route shape returns `404`; a known shape with an unsupported method returns `405`. Every handler returns a neutral `{status, body, headers?}`; `finalize(neutral, multi)` lifts that into the Lambda result envelope, moving headers into `multiValueHeaders` when `multi` is set. The whole dispatch is wrapped in one `try/catch` — `errorResponse` maps through `policy.errorBody` + `mapErrorStatus` (honoring an explicit `err.status` in the 4xx/5xx range), and the handler never throws back to the Lambda runtime.

## Request handling

- **Body** — `readJsonBody(event.body, event.isBase64Encoded, maxBodyBytes)` decodes base64 **before** the byte-length check (a 5 MiB JSON body arrives as ~6.7 MiB of base64; the cap applies to the decoded form), then `JSON.parse`s. `maxBodyBytes` (1 MiB default) is the tenant-level cap; platform caps (6 MB HTTP/Function URL, 10 MB REST, 1 MB ALB default) fire at the trigger before the Lambda is invoked and are documented, not enforced here.
- **`exampleFromContext`** — called with `{query, body, adapter, framework: 'lambda', event, context}`. The Lambda `context` is the fourth contextual object the siblings lack, exposing `awsRequestId` / `invokedFunctionArn` / `getRemainingTimeInMillis()` for log correlation, multi-env routing, and deadline-aware batch ops.
- **Pagination** — `urlBuilderFor` rebuilds next/prev links off the caller's path + query. v2 reuses `event.rawQueryString` verbatim (byte-preserving); v1 / ALB re-serialize from the multi-value (or single-value) query bag via `URLSearchParams`.

## Local debug bridges

`src/local.js` (the `dynamodb-toolkit-lambda/local.js` subpath export) drives the exact Lambda handler from real HTTP traffic without deploying:

- `createNodeListener(handler, options?)` — a `(req, res)` listener for `node:http`.
- `createFetchBridge(handler, options?)` — a `(request) => Promise<Response>` handler for Fetch runtimes (Bun, Deno, Cloudflare Workers, Hono, itty-router).

Both synthesize a full v1 or v2 event from the incoming request (`makeV1Event` / `makeV2Event`), invoke the handler, and translate the result envelope back. They live in a separate entry point so the production `index.js` import surface stays free of `node:http` — every runtime with a `Buffer` shim can run the adapter proper.

## Layout

```
src/
  index.js             # createLambdaAdapter — the single handler factory
  index.d.ts           # Type + doc sidecar (sole source of types and docs)
  read-lambda-body.js  # Synchronous string-body reader (base64 + cap + parse)
  read-lambda-body.d.ts
  local.js             # Local-debug bridges (node:http + Fetch)
  local.d.ts
tests/                 # Unit + mock-based tests (tape-six); real node:http harness
  helpers/             # Fake event fixtures + shared harness
llms.txt               # Machine-readable API reference (consumer-facing)
llms-full.txt
wiki/                  # Published wiki — git submodule
```

The published tarball ships `src/`, `README.md`, `LICENSE`, `llms.txt`, `llms-full.txt`, `package.json`. Tests, AI-rule files, and the wiki stay out (verify via `npm pack --dry-run`).
