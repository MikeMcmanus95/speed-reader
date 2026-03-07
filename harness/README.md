# Harness Engineering

This directory is the system-of-record for deterministic engineering harnesses.

## Commands

- `pnpm harness:check`: Validate harness structure and policy consistency.
- `pnpm harness:eval`: Run deterministic product behavior evals.
- `pnpm ci:required`: Required CI gate.
- `pnpm ci:full`: Advisory comprehensive quality suite.

## Layout

- `registry.json`: machine-readable required checks and owners.
- `playbooks/`: failure response playbooks.
- `evals/`: fixture inputs and expected outputs.
- `scripts/`: harness runners and validators.

## Rule

When incidents happen, add or update at least one harness check or fixture and note it in the PR description.
