// Bundles and runs scripts/royale_crews.ts (house bot matches of the battle
// royale in each crew size, measured: ADR 0034).

import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

await build({
  entryPoints: ['scripts/royale_crews.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist-server/royale_crews.cjs',
  external: [],
});
const run = spawnSync(
  process.execPath,
  ['dist-server/royale_crews.cjs', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
  },
);
process.exit(run.status ?? 1);
