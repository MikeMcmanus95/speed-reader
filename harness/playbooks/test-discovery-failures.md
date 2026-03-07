# Playbook: Test Discovery Failures

## Trigger

A package test command fails because no tests are discovered.

## Response

1. Confirm whether the package should have tests now.
2. If yes, add at least one deterministic harness eval or unit test.
3. If no, remove or scope the package test command from required jobs.
4. Update `harness/registry.json` so commands and ownership remain accurate.

## Exit Criteria

- Required CI commands execute without discovery errors.
- Registry command list matches actual package capabilities.
