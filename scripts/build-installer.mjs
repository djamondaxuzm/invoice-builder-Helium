import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import process from 'node:process';

const { values } = parseArgs({
  options: {
    win: { type: 'boolean' },
    mac: { type: 'boolean' },
    publish: { type: 'string', default: 'never' },
    'output-base': { type: 'string' }
  }
});
if (Boolean(values.win) === Boolean(values.mac)) throw new Error('Choose exactly one of --win or --mac.');
if (!['never', 'always'].includes(values.publish)) throw new Error('--publish must be never or always.');
if (!process.env.npm_execpath) throw new Error('Run this script through npm run package or npm run release:mac.');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const startedAt = new Date();
const id = startedAt.toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8);
const output = join(resolve(root, values['output-base'] || 'release'), id);
mkdirSync(output, { recursive: true });
const seconds = start => Number(((performance.now() - start) / 1000).toFixed(2));
const start = performance.now();
const metrics = { startedAt: startedAt.toISOString(), output, buildSeconds: 0, packageSeconds: 0, totalSeconds: 0 };
const run = args => {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error('Build command failed (' + (result.signal || result.status) + '). See the first error above.');
};

try {
  console.log('[1/2] Compiling the current source...');
  let step = performance.now();
  run([process.env.npm_execpath, 'run', 'build']);
  metrics.buildSeconds = seconds(step);
  console.log('[1/2] Compilation finished in ' + metrics.buildSeconds + ' seconds.');
  console.log('[2/2] Packaging installer into ' + output);
  step = performance.now();
  run([
    join(root, 'node_modules/electron-builder/cli.js'),
    ...(values.win ? ['--win', '--x64'] : ['--mac']),
    '--publish',
    values.publish,
    '--config.directories.output=' + output
  ]);
  metrics.packageSeconds = seconds(step);
  metrics.totalSeconds = seconds(start);
  const installers = readdirSync(output)
    .filter(name => (values.win ? name.endsWith('.exe') : name.endsWith('.dmg')))
    .map(name => ({ path: join(output, name), bytes: statSync(join(output, name)).size }));
  if (!installers.length) throw new Error('Packaging finished without an installer. Check the output above.');
  writeFileSync(join(output, 'build-metrics.json'), JSON.stringify({ ...metrics, installers }, null, 2) + '\n');
  console.log('[2/2] Packaging finished in ' + metrics.packageSeconds + ' seconds.');
  console.log('Installer build complete in ' + metrics.totalSeconds + ' seconds.');
  for (const installer of installers) console.log('INSTALLER: ' + installer.path);
} catch (error) {
  metrics.totalSeconds = seconds(start);
  writeFileSync(
    join(output, 'build-metrics.json'),
    JSON.stringify({ ...metrics, error: error.message }, null, 2) + '\n'
  );
  console.error(error.message);
  process.exitCode = 1;
}
