const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');

function fail(msg) {
  console.error(`HARNESS_CHECK_FAILED: ${msg}`);
  process.exitCode = 1;
}

function requireFile(relPath) {
  const abs = path.join(repoRoot, relPath);
  if (!fs.existsSync(abs)) {
    fail(`Missing required file: ${relPath}`);
    return null;
  }
  return abs;
}

const requiredFiles = [
  'CLAUDE.md',
  'harness/README.md',
  'harness/registry.json',
  'harness/playbooks/test-discovery-failures.md',
  'harness/playbooks/flaky-timing-tests.md',
  'harness/playbooks/lint-regressions.md',
  'harness/evals/tokenizer-fixtures.json',
  'harness/evals/engine-fixtures.json',
  'backend/internal/http/testdata/harness_generate_title.json'
];

for (const relPath of requiredFiles) {
  requireFile(relPath);
}

let registry;
const registryPath = requireFile('harness/registry.json');
if (registryPath) {
  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (err) {
    fail(`Invalid JSON in harness/registry.json: ${err.message}`);
  }
}

if (registry) {
  if (typeof registry.version !== 'number') {
    fail('registry.version must be a number');
  }

  if (!Array.isArray(registry.checks) || registry.checks.length === 0) {
    fail('registry.checks must be a non-empty array');
  } else {
    for (const check of registry.checks) {
      if (!check.id || !check.command || !check.owner || !check.gating) {
        fail(`registry.checks entry is missing required fields: ${JSON.stringify(check)}`);
      }
      if (!['required', 'advisory'].includes(check.gating)) {
        fail(`registry.check ${check.id} has invalid gating: ${check.gating}`);
      }
      if (!registry.owners || !registry.owners[check.owner]) {
        fail(`registry.check ${check.id} references unknown owner key: ${check.owner}`);
      }
    }
  }

  if (!Array.isArray(registry.playbooks) || registry.playbooks.length === 0) {
    fail('registry.playbooks must be a non-empty array');
  } else {
    for (const relPath of registry.playbooks) {
      requireFile(relPath);
    }
  }
}

const claudePath = requireFile('CLAUDE.md');
if (claudePath) {
  const claude = fs.readFileSync(claudePath, 'utf8');
  const requiredHeadings = [
    '## Harness Contract',
    '## Definition of Done',
    '## Failure Playbooks'
  ];

  for (const heading of requiredHeadings) {
    if (!claude.includes(heading)) {
      fail(`CLAUDE.md missing required heading: ${heading}`);
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('Harness structure and policy checks passed.');
