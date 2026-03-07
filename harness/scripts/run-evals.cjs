const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const artifactsDir = path.join(repoRoot, 'harness', 'artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });

const commands = [
  {
    name: 'tokenizer_eval',
    cmd: 'pnpm',
    args: ['--filter', '@speed-reader/tokenizer', 'exec', 'vitest', 'run', 'src/harness.eval.test.ts']
  },
  {
    name: 'engine_eval',
    cmd: 'pnpm',
    args: ['--filter', '@speed-reader/engine', 'exec', 'vitest', 'run', 'src/harness.eval.test.ts']
  },
  {
    name: 'backend_contract_eval',
    cmd: 'go',
    args: ['test', './internal/http', '-run', 'TestHarnessEval', '-v'],
    cwd: path.join(repoRoot, 'backend')
  }
];

const results = [];
let failed = false;

for (const entry of commands) {
  console.log(`\\n>>> Running ${entry.name}`);
  const proc = spawnSync(entry.cmd, entry.args, {
    cwd: entry.cwd || repoRoot,
    env: {
      ...process.env,
      ...(entry.cmd === 'go' ? { GOCACHE: path.join(repoRoot, '.cache', 'go-build') } : {}),
    },
    stdio: 'pipe',
    encoding: 'utf8'
  });

  const output = `${proc.stdout || ''}${proc.stderr || ''}`;
  const outFile = path.join(artifactsDir, `${entry.name}.log`);
  fs.writeFileSync(outFile, output);

  const ok = proc.status === 0;
  results.push({
    name: entry.name,
    command: `${entry.cmd} ${entry.args.join(' ')}`,
    status: ok ? 'passed' : 'failed',
    exitCode: proc.status,
    logFile: path.relative(repoRoot, outFile)
  });

  process.stdout.write(output);

  if (!ok) {
    failed = true;
  }
}

const summaryFile = path.join(artifactsDir, 'eval-summary.json');
fs.writeFileSync(summaryFile, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\\n`);

if (failed) {
  console.error('Harness evals failed. See harness/artifacts/*.log and eval-summary.json');
  process.exit(1);
}

console.log('All harness evals passed.');
