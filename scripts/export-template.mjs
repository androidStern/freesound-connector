import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile, rm, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';

const root = resolve('.');
const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
if (resolve(gitRoot) !== root) throw new Error('Run export:template from this project Git root.');
const output = resolve('outputs/freesound-connector-template');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
// Only source tracked/staged by the maintainer. Never recurse through local secrets or build state.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
let copied = 0;
for (const file of files) {
  if (file === 'RETURN-HANDOFF.md' || file === '.openai/hosting.json' || file.startsWith('outputs/') || file.startsWith('.sites-runtime/') || file === '.dev.vars' || (file.startsWith('.env') && file !== '.env.example')) continue;
  try { await readFile(file); } catch { continue; } // Removed tracked source is not exported.
  const destination = join(output, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(file, destination); copied++;
}
await mkdir(join(output, '.openai'), { recursive: true });
await writeFile(join(output, '.openai/hosting.json'), JSON.stringify({ capabilities: ['mcp'], d1: 'DB', r2: null }, null, 2) + '\n');
const keys = [];
try { const local = await readFile('.dev.vars', 'utf8'); for (const line of local.split('\n')) { const m = /^FREESOUND_API_KEY\s*=\s*["']?([^"'\s]+)["']?\s*$/.exec(line); if (m) keys.push(m[1]); } } catch {}
let scanned = 0;
async function scan(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) await scan(file);
    else {
      const text = await readFile(file, 'utf8'); scanned++;
      if (keys.some(key => text.includes(key)) || /appgprj_[a-z0-9]{20,}|plugin_asdk_app_sites_[a-z0-9]{20,}/.test(text)) throw new Error(`Template contains private configuration in ${file.slice(output.length + 1)}`);
    }
  }
}
await scan(output);
const archive = resolve('outputs/freesound-connector-template.zip');
await rm(archive, { force: true });
execFileSync('zip', ['-qr', archive, '.'], { cwd: output });
console.log(JSON.stringify({ directory: output, archive, source_files: copied + 1, scanned_files: scanned }));
