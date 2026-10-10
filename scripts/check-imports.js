// Static sanity check without dependencies: every relative import in src/ points to an
// existing file and every imported name is actually exported. Catches typos that would
// otherwise only show up as a blank page in the browser.

import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const exportsOf = (src) => {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) m[1].split(',').forEach((n) => names.add(n.trim().split(/\s+as\s+/).pop()));
  return names;
};

const all = await files(join(root, 'src'));
const sources = Object.fromEntries(await Promise.all(all.map(async (f) => [f, await readFile(f, 'utf8')])));
let problems = 0;
for (const [file, src] of Object.entries(sources)) {
  for (const m of src.matchAll(/import\s+(?:\{([^}]*)\}|\*\s+as\s+\w+)\s+from\s+'(\.[^']+)'/g)) {
    const target = resolve(dirname(file), m[2]);
    if (!(target in sources)) { console.error(`✗ ${relative(root, file)}: ${m[2]} bestaat niet`); problems++; continue; }
    if (!m[1]) continue;
    const available = exportsOf(sources[target]);
    for (const raw of m[1].split(',').map((s) => s.trim()).filter(Boolean)) {
      const name = raw.split(/\s+as\s+/)[0];
      if (!available.has(name)) { console.error(`✗ ${relative(root, file)}: '${name}' wordt niet geëxporteerd door ${m[2]}`); problems++; }
    }
  }
}
if (problems) process.exit(1);
console.log(`✓ ${all.length} modules, alle imports kloppen`);
