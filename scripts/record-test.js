const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const cli = path.join(path.dirname(require.resolve('playwright/package.json')), 'cli.js');
const env = { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(root, 'browsers') };
let args;
if (process.argv.includes('--help')) {
  args = ['codegen', '--help'];
} else {
  const url = process.argv[2] || 'https://resumefromspace.com';
  if (!['https:', 'http:'].includes(new URL(url).protocol)) throw new Error('Use an HTTP or HTTPS URL.');
  const folder = path.join(root, 'recordings');
  fs.mkdirSync(folder, { recursive: true });
  const output = path.join(folder, `recording-${new Date().toISOString().replace(/[:.]/g, '-')}.spec.js`);
  console.log(`Recording to: ${output}\nClose the recorder when finished. This file must be adapted before adding it to the app catalog.`);
  args = ['codegen', '--browser', 'chromium', '--target', 'playwright-test', '--output', output, url];
}
const result = spawnSync(process.execPath, [cli, ...args], { stdio: 'inherit', env });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
