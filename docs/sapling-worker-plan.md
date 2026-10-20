# Sapling worker proof experiment

## Baseline and scope

Start from template commit `020aecc`, preserving its existing wallet and counter behavior. Use a local branch and local commits only. The baseline build passes all 45 tests. No wallet request, live origination, or chain injection belongs to this experiment.

The experiment prepares a real one-output Sapling shielding transaction in a module worker, using a disposable published test mnemonic, fixed chain and contract identifiers, an empty pool fixture, an eight-byte memo limit, and one mutez. It uses built Sapling artifacts from pinned merged Taquito source `8ecb7ad0`. Proving parameters retain the upstream SHA-256 checks.

## Architecture

- A lazily opened React panel explains the fixture and shows real download/proving stages, results, retry, and stop controls. Opening the panel does not load proving parameters.
- A small worker client owns one active operation, validates incoming worker messages at the message interface, and terminates pending work on stop or unmount. Stale messages cannot overwrite a later result.
- The worker owns the disposable Sapling key and real SDK. The main thread receives transaction bytes, public fixture metadata, and measured timings, never a spending or viewing key. The test seed is public and must never be used with funds.
- The fixture implements only the public read-provider calls used by shielding. Unexpected calls fail. This controls chain state rather than mocking cryptography.
- A local test runner serves the production build and parameter fixtures. It sends resulting transaction bytes to an independent Octez verifier. The verifier executes the protocol instruction `SAPLING_VERIFY_UPDATE` and checks acceptance and rejection controls. This is the acceptance gate, not a successful SDK promise or byte length check.
- Keep proof execution, verification tooling, and UI concerns in separate files. Reuse current Vite, native React Compiler, pnpm, Oxlint, and Oxfmt. Add only dependencies required for this experiment.

## Agreed test interfaces

The user's requested real proof and compatibility evidence determine these interfaces:

1. The rendered playground controls and worker messages. Verify stage changes, cancellation/retry, responsive page interaction, and late-result isolation. These do not establish proof validity.
2. Built browser artifacts with real WASM in Chromium, Firefox, and WebKit. Verify genuine transaction preparation. Controlled RPC state and local authenticated parameter delivery are permitted; proof generation is never mocked.
3. Independent protocol verification of the returned transaction. Accept the original; reject a mutated proof and a mismatched contract/chain anti-replay context where supported. Validate stable serialized fields against independent literal fixtures, not randomized proof-byte equality.
4. Unchanged wallet, counter, and transfer tests, before and after implementation. Keep this compatibility result separate from new behavior tests. Check parameter-free startup separately from proof execution.

## Delivery sequence

1. Record the reviewed plan, pin reproducible Sapling artifacts and provenance, and preserve a runnable baseline.
2. Add the worker preparation path and independently validate a real generated proof before expanding the UI.
3. Add the accessible experiment panel and robust operation lifecycle. Use Emil's guidance for immediate feedback, visible focus, touch targets, restrained motion, and reduced-motion support. No animation library is needed.
4. Add production browser checks, negative verification controls, fixture provenance, and compatibility records. Review standards and spec separately and fix findings before final commits.

Each implementation slice follows a failing behavior test, minimal implementation, and targeted verification. Local commits should describe complete capabilities rather than file types.

## Completion evidence

Real worker proof generation and independent protocol acceptance/rejection must run locally. Report the exact browser, SDK, parameter hashes, Octez version/protocol, and fixture identifiers. Record cold/warm timings without claiming mobile performance. Original 45 compatibility tests must still pass. Keep output logs and screenshots outside generated build artifacts. Document any covered and uncovered behavior honestly.

## Architecture review

An independent review using Matt Pocock codebase-design and pstack sharpen approved the interfaces with these corrections before implementation:

- Use the actual local Octez mockup chain `NetXynUjJNZm7wi`, contract `KT1G2kvdfPoavgR6Fjdd68M2vaPk14qJ8bhC`, memo size eight, and `amount: 1, mutez: true`.
- Obtain the canonical empty-tree root from Octez or its protocol source. A zero buffer is not a valid empty Sapling root.
- Preserve transaction framing when altering the proof. Check proof mutation, binding-signature mutation, and anti-replay context separately. A parser rejection alone cannot establish cryptographic verification.
- Keep parameter-load timing separate from proof timing. Terminating a worker discards its WASM state; a restarted worker can have warm HTTP cache but cold WASM initialization.

The independent checker is Octez client v25.3, commit `e5d8a6b8`, executing the Tallinn protocol in local mockup mode. This is an explicit test protocol, not a claim about a live network deployment.
