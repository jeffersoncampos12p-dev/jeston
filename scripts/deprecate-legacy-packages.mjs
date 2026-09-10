import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const packages = ['@hedronjs/jeston', '@kvantjs/jeston'];
const message = 'Deprecated: this package has been superseded by @kvantjs/ryvax.js. Migrate to Ryvax.js: https://github.com/kvantjs/ryvax.js';

for (const name of packages) {
  const { stdout } = await run('npm', ['view', name, 'versions', '--json']);
  const parsed = JSON.parse(stdout);
  const versions = Array.isArray(parsed) ? parsed : [parsed];
  for (const version of versions) {
    console.log(`Deprecating ${name}@${version}`);
    await run('npm', ['deprecate', `${name}@${version}`, message], { env: process.env });
  }
}
