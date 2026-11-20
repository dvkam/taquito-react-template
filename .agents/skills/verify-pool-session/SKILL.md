---
name: verify-pool-session
description: Recheck local Sapling pool session ordering after changes to tools/pool-session.mjs, tools/privacy-pool.mjs or their HTTP callers.
---

# Verify pool session ordering

Run `pnpm verify:pool-session` from the React template using Node 24.21.0. The production module is `tools/pool-session.mjs`, function `createPoolSession`. `tools/privacy-pool.mjs` supplies the serialized RPC read and apply operations. `tools/pool-http.mjs` is its caller. No external actor may write the private mockup context.

Coverage is 781 histories of up to four accept/reject/unknown/stale/snapshot actions. Every application action also attempts an overlapping snapshot and submission. A reader or writer must not enter during an outstanding application. Only an accepted result increments the version. A stale request must not call apply. An unknown outcome must prevent every subsequent submission. Breaking these rules risks mixed state or repeated deposits.

This checks real JavaScript with generated inputs. It is bounded exhaustive testing, not an SMT or TLA+ proof. It does not verify cryptography, contract funding/payout logic, operating-system failures, public network concurrency or behavior after manual edits to mockup files.

The runner checks baseline and five temporary source variants with removed busy/stale/uncertain checks unconditional version increments, or loss of a confirmed receipt after a failed read. Each mutation must fail; the scratch copies are removed in a finally block. If a mutation stops matching, update it to break the same property. Do not weaken an assertion to make changed product behavior pass.

On a failure, report the sequence and whether production code or the test assumption is wrong. Confirm the contract callback still makes one complete protocol application before returning success. Recheck callers whenever that indivisible step changes.

Coverage record: implementation commit ed9948b1a1848d7f89680ad034ed9cafa0fe2ab6, checked with this verification on 21 October 2026. The check also verifies retention of a confirmed receipt after a read failure. Record completed browser evidence in docs/sapling-pool-evidence.md. Update that record only after rerunning and confirming the correspondence. Use pstack maintain-formal-verification-skill when relevant changes did not recheck this coverage.
