---
description: Pre-release verification checklist for dynamodb-toolkit-lambda
---

# Release Check

Lambda adapter release flow. Mirrors the parent `dynamodb-toolkit` release posture:
ESM-only, tarball ships `src/` + `llms*.txt`, no build step, manual tag + publish.

## Steps

1. **Semver decision.** `git log <last-tag>..HEAD`:
   - Additive API → minor.
   - Behavior fix or dep bump → patch.
   - Any signature / return / export rename → major.
2. **AGENTS.md** is up to date with any rule or workflow changes.
3. **AI rule files** (`.cursorrules`, `.windsurfrules`, `.clinerules`) are byte-identical to `AGENTS.md`:
   ```
   diff -q AGENTS.md .cursorrules && diff -q AGENTS.md .windsurfrules && diff -q AGENTS.md .clinerules
   ```
4. **`llms.txt` / `llms-full.txt`** reflect the current API.
5. **`package.json`:**
   - `version` bumped.
   - `files` is `["src", "llms.txt", "llms-full.txt"]`.
   - Top-level `main` / `module` / `types` present.
   - `exports` map covers the public sub-paths + `"./*"` wildcard.
   - `peerDependencies` covers `dynamodb-toolkit` (compatible range). No framework peer dep — Lambda is the target runtime.
   - `engines.node` tracks what Lambda currently offers (Node 20+ default at time of writing).
   - `description` / `keywords` accurate.
6. **LICENSE** exists; copyright year current.
7. **Regenerate lockfile:** `npm install`.
8. **Full check matrix:**
   ```
   npm run lint
   npm run ts-check
   npm run js-check
   npm test
   ```
   Cross-runtime (Deno / Bun) should be green — core logic is runtime-agnostic, only the event shim touches Lambda-specific shapes.
9. **Dry-run publish:** `npm pack --dry-run`.
   Confirm tarball = `src/` + `README.md` + `LICENSE` + `llms.txt` + `llms-full.txt` + `package.json`. NONE of: `tests/`, `.github/`, `.claude/`, `.windsurf*`, `.cursor*`, `.cline*`, `AGENTS.md`, `CLAUDE.md`, `dev-docs/`.
10. **Stop and report.** User drives commit, tag, `npm publish`.
