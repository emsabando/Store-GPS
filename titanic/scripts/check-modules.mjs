// Bundles src/main.js (or a given entry) with esbuild in memory — a fast syntax/import check
// that does NOT write into dist/, so several engineers can run it concurrently.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const entry = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.join(root, 'src/main.js');

try {
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2022',
    logLevel: 'silent',
    absWorkingDir: root,
    loader: { '.css': 'css', '.glsl': 'text', '.vert': 'text', '.frag': 'text', '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.svg': 'dataurl', '.json': 'json' },
  });
  const bytes = result.outputFiles.reduce((n, f) => n + f.contents.length, 0);
  console.log(`OK  ${path.relative(root, entry)} bundles (${(bytes / 1024).toFixed(0)} kB, ${result.warnings.length} warnings)`);
  for (const w of result.warnings) console.log('  warn:', w.text, w.location ? `${w.location.file}:${w.location.line}` : '');
} catch (err) {
  console.error('FAIL', entry);
  for (const e of err.errors || [{ text: err.message }]) {
    console.error('  ', e.text, e.location ? `@ ${e.location.file}:${e.location.line}:${e.location.column}` : '');
  }
  process.exit(1);
}
