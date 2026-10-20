import { mkdir, rmdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';

export async function removeEmptyDirectory(path) {
  await rmdir(path).catch(error => {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error;
  });
}

export async function createRun(root, imageVersion, now = new Date()) {
  const label = imageVersion ?? 'local';
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(label)) throw Error('Invalid run image version');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const base = `${label}-${stamp}`;
  await mkdir(root, { recursive: true });
  for (let suffix = 0; ; suffix++) {
    const id = suffix ? `${base}-${suffix + 1}` : base;
    const path = join(root, id);
    try { await mkdir(path); }
    catch (error) { if (error.code === 'EEXIST') continue; throw error; }
    let commit = null;
    try { commit = (await promisify(execFile)('git', ['rev-parse', 'HEAD'], { cwd: root, windowsHide: true })).stdout.trim(); }
    catch { /* Evidence is also usable outside a Git checkout. */ }
    await writeFile(join(path, 'run.json'), JSON.stringify({ id, imageVersion: imageVersion ?? null,
      startedAt: now.toISOString(), timezone: 'UTC', commit }, null, 2));
    return { id, path };
  }
}

export function runPath(root, id) {
  if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*-\d{8}-\d{6}(?:-\d+)?$/.test(id)) throw Error('Invalid E2E run ID');
  return join(root, id);
}
