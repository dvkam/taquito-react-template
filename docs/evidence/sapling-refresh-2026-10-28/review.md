# Review record

The SDK review compares `e9a573bb...179d34c3`. The playground review compares `44d26ba...HEAD` and separately inspects the follow-up receipt and experiment fixes committed as `675cb97` and `c97a66e`.

## Standards

The Pocock Standards reviewer read the SDK contributor guide, root and Sapling READMEs, template README and local session verification skill. It reported two findings. The template README incorrectly said no upstream issue existed. The current builder could extract an archive over old baseline sources and retain files removed from main. The README now links #3472, and baseline builds use a fresh temporary directory. No further actionable Fowler smell findings were reported. The baseline-directory issue was a verification defect; it did not show that the previous unchanged-Sapling run was corrupt.

## Spec

The Pocock Spec reviewer traced SDK policy validation and both signed builder paths, public projection, role switching, cancellation gates, receipt handling, the funded Michelson contract and serialized session. It found one documentation problem. The observer-only draft attributed unchanged vendor, worker, lock and contract files to the whole contribution. The final playground draft now describes the complete branch and limits source preservation to the existing wallet/counter files. The reviewer reported no actionable implementation finding in its reviewed paths.

## Interrogation intent

Preserve default SDK behavior while adding unbiased secure opt-in output ordering. Check real browser-generated Sapling proofs and a stateful local funded cycle. Distinguish public facts from viewing-key facts. Keep privacy measurements separate from protocol and API compatibility. Share feature branches without creating PRs or deploying a service.

## Reviewers

- Reviewer A used GPT-6 Astra. It found one remaining receipt-loss path.
- Reviewer B used GPT-6.1 Sol. It reported no findings.

The configured pstack defaults, Claude and Grok, were not available in this environment. These two available models replaced them. The reviewers read the same pstack rubric and code-quality instructions. They inspected actual files and callers independently.

## Act on

Reviewer A traced three accepted payments followed by a rejected final observation. The ordinary error reached the generic UI failure branch and hid the confirmed receipt. Missing and mismatched observations had the same effect. Four new regressions fail before the correction while eight existing client tests pass. The correction keeps the public receipt in a sanitized PoolReceiptError and still discards inactive results. The 16-test client/UI group passes afterward. Both reviewers reread the correction and experiment changes and reported no further findings.

## Consider, noted and dismissed

No unresolved findings remain in these categories. An error-message mismatch in the new current-build measurement command was corrected before the canonical measurement. It is not an outstanding SDK finding. Public-network and real-wallet validation are explicit limits, not claims established by the local tests.

## Agreement and limits

Only Reviewer A identified the final observation receipt path. The owner reproduced it before accepting the finding. Both models agreed that the corrected follow-up had no further findings. The reviews are scoped assessments and do not establish correctness for every input or deployment. Executed test results and their raw evidence remain separate.

A separate read-only evidence audit recomputed all six corpus histograms and held-out counts, rehashed all 14 served assets and all recorded SDK artifacts and dependency locks, and inspected the raw 17 accepted applications and six unchanged-state rejections. It also checked exact complete-output swaps and the single bound-recipient-byte mutations. The audit found no attribution gaps.
