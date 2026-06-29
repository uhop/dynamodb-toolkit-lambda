# AGENTS.md — dynamodb-toolkit-lambda

Canonical rules and conventions for AI agents and contributors. Mirrored byte-identical to `.cursorrules`, `.windsurfrules`, `.clinerules`.

## What this package is

A thin AWS Lambda adapter for [`dynamodb-toolkit`](https://github.com/uhop/dynamodb-toolkit) v3. Serves the toolkit's standard REST route pack as a Lambda handler that accepts:

- **API Gateway REST API** events (v1, `APIGatewayProxyEvent` → `APIGatewayProxyResult`).
- **API Gateway HTTP API** events (v2, `APIGatewayProxyEventV2` → `APIGatewayProxyStructuredResultV2`).
- **Lambda Function URL** events (payload format v2.0, same shape as HTTP API).
- **Application Load Balancer** events (`ALBEvent` → `ALBResult`).

Same wire contract as the bundled `node:http` adapter (`dynamodb-toolkit/handler`) and the sibling `dynamodb-toolkit-fetch` / `dynamodb-toolkit-koa` / `dynamodb-toolkit-express` adapters — routes, envelope, status codes, meta prefix all identical, all overridable through `options.policy`.

## Posture

- **Zero runtime dependencies.** `dynamodb-toolkit` is a `peerDependency`. Anything in `dependencies` is a bug.
- **ESM-only.** `"type": "module"`. Hand-written `.d.ts` sidecars next to every `.js` file. No build step.
- **Thin.** Lambda event shim, not framework. Delegates parsing / envelope building / policy to `dynamodb-toolkit/rest-core`. Delegates route-shape matching to `dynamodb-toolkit/handler`'s `matchRoute`. The adapter's job is `Event` → `Result` translation + error mapping.
- **No framework peer dep.** Target is AWS Lambda's Node runtime; `@types/aws-lambda` is a dev-only type dependency.
- **Node 20+** target — AWS Lambda's current default runtime. Bun / Deno supported in the local test matrix because the core logic is runtime-agnostic; production target is Node on Lambda.

## Scripts

| Command                             | What it does                                                   |
| ----------------------------------- | -------------------------------------------------------------- |
| `npm install`                       | Install dependencies                                           |
| `npm test`                          | Run unit suite via tape-six (Node)                             |
| `npm run test:deno`                 | Same suite under Deno                                          |
| `npm run test:bun`                  | Same suite under Bun                                           |
| `npm run ts-test`                   | Run TypeScript test files (`tests/test-*.*ts`) via tape-six    |
| `npm run ts-check`                  | Strict `tsc --noEmit` over `.ts` / `.d.ts` files               |
| `npm run js-check`                  | `tsc --project tsconfig.check.json` — JS lint via type-checker |
| `npm run lint` / `npm run lint:fix` | Prettier check / fix                                           |

There is no build step. The published tarball ships `src/` as-is plus `llms.txt` + `llms-full.txt`.

## Project structure

```
dynamodb-toolkit-lambda/
├── src/                              # Published code (ESM .js + .d.ts sidecars)
│   ├── index.js / index.d.ts         # Main entry — exports the adapter factory
│   ├── read-lambda-body.js / .d.ts   # Synchronous string-body reader
│   └── local.js / local.d.ts         # Local-debug bridges (node:http + Fetch)
├── tests/
│   ├── test-*.js                     # Unit + mock-based tests (default `npm test`)
│   └── helpers/                      # Fake event fixtures + shared harness
├── ARCHITECTURE.md                   # Internal layout + design notes (maintainers)
├── llms.txt / llms-full.txt          # AI-readable API reference
└── .github/workflows/tests.yml
```

The published tarball includes only `src/` + `README.md` + `LICENSE` + `llms.txt` + `llms-full.txt` + `package.json`.

## Cross-project conventions (inherited from dynamodb-toolkit)

- **Minimal `node:*` imports at runtime.** `node:buffer` may be needed for base64 body decoding (API Gateway v1 / ALB encode binary bodies as base64). Type-only imports in `.d.ts` are always fine.
- **Prettier** enforces formatting (`.prettierrc`). Run `npm run lint:fix` before commits.
- **`.d.ts` is the sole source of types and docs.** Every `.js` opens with `// @ts-self-types="./<file>.d.ts"` so IDE hover and importers defer to the sidecar; `.js` files carry no JSDoc except the load-bearing inline `/** @type */` annotations the implementation needs to type-check. JSDoc `@param` + `@returns` lives on every exported symbol in the `.d.ts`; semantic `@returns` on non-void returns is mandatory.
- **Arrow functions and FP style.** Prefer `=>` unless `this` is needed. Lightweight objects over classes.
- **No `any` in TypeScript.** Use proper types or `unknown`.
- **No narrating comments.** Comments are short _why_-markers only — a non-trivial decision or constraint, an algorithm reference, or required JSDoc. Never narrate _what_ the code does; the bar is _why_, never _what_.

## Release posture

Run the `release-check` skill for the full pre-publish checklist. Commit, tag, and `npm publish` are user-driven. Tags are bare semver (`0.3.0`, no `v` prefix).
