import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { validateOffer } from './lib/offers.mjs';

const failures = [];
async function checkDir(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') await checkDir(path); }
    else if (/\.(mjs|js)$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (result.status !== 0) failures.push(result.stderr);
    } else if (entry.name.endsWith('.json')) {
      try { JSON.parse(await readFile(path, 'utf8')); } catch { failures.push(`JSON inválido: ${path}`); }
    }
  }
}
for (const directory of ['site', 'scripts', 'sources', 'config', 'api']) await checkDir(directory);
const data = JSON.parse(await readFile('site/data/offers.json', 'utf8'));
for (const offer of data.offers) {
  const errors = validateOffer(offer);
  if (errors.length) failures.push(`${offer.id}: ${errors.join(', ')}`);
}
const html = await readFile('site/index.html', 'utf8');
if (!/lang=["']pt-BR["']/.test(html)) failures.push('Idioma pt-BR obrigatório');
if (!/viewport/.test(html)) failures.push('Viewport obrigatório');
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Sintaxe, JSON e ${data.offers.length} ofertas válidos.`);
