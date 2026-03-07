# Playbook: Flaky Timing Tests

## Trigger

A timing-sensitive test passes and fails intermittently.

## Response

1. Replace real clock/RAF usage with mocked deterministic time.
2. Move fragile expectations to fixture-driven comparisons.
3. Remove external dependencies (network/randomness/current time).
4. Re-run failing command at least 3 times locally.

## Exit Criteria

- Test passes repeatedly with deterministic runtime behavior.
- Fixture or comparator captures exact expected transitions.
