import { readFileSync, writeFileSync } from 'fs';

const workerPath = '.svelte-kit/cloudflare/_worker.js';
const worker = readFileSync(workerPath, 'utf8');

// Wrangler bundles _worker.js with esbuild at deploy time, so importing a .ts
// file here is fine — esbuild will transpile it and include UserSync in the bundle.
writeFileSync(
	workerPath,
	worker + '\nexport { UserSync } from "../../src/lib/server/do/UserSync.ts";\n'
);

console.log('✓ Appended UserSync export to _worker.js');
