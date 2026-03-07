import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(currentDir, '..');
const distDir = path.join(extensionRoot, 'dist');
const manifestPath = path.join(distDir, 'manifest.json');

if (!existsSync(manifestPath)) {
  throw new Error(`Missing ${manifestPath}. Run the extension build before packaging.`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const version = manifest.version;

if (!version || typeof version !== 'string') {
  throw new Error('Unable to read extension version from dist/manifest.json');
}

const archiveName = `speed-reader-rsvp-v${version}.zip`;
const archivePath = path.join(distDir, archiveName);

if (existsSync(archivePath)) {
  rmSync(archivePath);
}

execFileSync(
  'zip',
  ['-qr', archiveName, '.', '-x', 'speed-reader-rsvp-v*.zip'],
  { cwd: distDir, stdio: 'inherit' }
);

console.log(`Created package: ${archivePath}`);
