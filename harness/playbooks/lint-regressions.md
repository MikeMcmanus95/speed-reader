# Playbook: Lint Regressions

## Trigger

`pnpm ci:full` reports lint failures.

## Response

1. Classify each lint issue as bug-risk, architecture-risk, or style-only.
2. Fix bug/architecture risks in the same PR.
3. For style-only debt, create a tracked issue and keep advisory gate status unchanged.
4. If a rule is noisy, tune config with rationale and examples.

## Exit Criteria

- New regressions are fixed or tracked.
- Rule changes are explicit and justified.
