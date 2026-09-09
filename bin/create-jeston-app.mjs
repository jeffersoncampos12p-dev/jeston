#!/usr/bin/env node
process.argv.splice(2, 0, 'create');
await import('../dist/src/cli/index.js');
