import { build, context } from 'esbuild';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));

const banner = `/*! hand-tracking-cursor v${pkg.version} | MIT | ${pkg.repository.url.replace(/^git\+|\.git$/g, '')} */`;

/** Dynamic imports of the MediaPipe bundle are deliberately left unresolved. */
const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  target: ['chrome100', 'firefox100', 'safari15.4', 'edge100'],
  platform: 'browser',
  legalComments: 'none',
  banner: { js: banner },
  logOverride: { 'unsupported-dynamic-import': 'silent' },
};

const targets = [
  { ...shared, outfile: 'dist/hand-cursor.js', format: 'iife', globalName: 'HandCursor' },
  {
    ...shared,
    outfile: 'dist/hand-cursor.min.js',
    format: 'iife',
    globalName: 'HandCursor',
    minify: true,
  },
  { ...shared, outfile: 'dist/hand-cursor.esm.js', format: 'esm' },
];

if (process.argv.includes('--watch')) {
  const contexts = await Promise.all(targets.map((options) => context(options)));
  await Promise.all(contexts.map((ctx) => ctx.watch()));
  console.log('watching src/…');
} else {
  await Promise.all(targets.map((options) => build(options)));
  console.log(`built dist/ (v${pkg.version})`);
}
