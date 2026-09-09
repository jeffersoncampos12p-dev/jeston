import fs from 'node:fs';
const [packageInfo] = JSON.parse(fs.readFileSync('/tmp/jeston-pack.json', 'utf8'));
const files = new Set(packageInfo.files.map(({ path }) => path));
for (const required of ['dist/src/index.js', 'dist/src/index.d.ts', 'bin/jeston.mjs', 'README.md', 'LICENSE']) {
  if (!files.has(required)) throw new Error(`Missing package file: ${required}`);
}
console.log(`Package file inspection passed (${packageInfo.files.length} files).`);
