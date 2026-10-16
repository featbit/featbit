import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { directory, stacks } from './stack.mjs';

export const configPath = join(directory, '.runs', 'config.json');

function validate(config) {
  if (!Object.hasOwn(stacks, config.stack)) throw new Error(`Unknown stack: ${config.stack}`);
  if (config.imageVersion !== null && (typeof config.imageVersion !== 'string' ||
      !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/.test(config.imageVersion))) {
    throw new Error(`Invalid image version: ${config.imageVersion}`);
  }
  return config;
}

export async function readConfig(path = configPath) {
  try {
    return { config: validate(JSON.parse(await readFile(path, 'utf8'))), isDefault: false };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return { config: { stack: 'postgres', imageVersion: null }, isDefault: true };
  }
}

export async function saveConfig(changes, path = configPath) {
  const { config } = await readConfig(path);
  const updated = validate({ ...config, ...changes });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`);
  return { config: updated, isDefault: false };
}

export function printConfig({ config, isDefault }) {
  console.log(`Stack:   ${config.stack}\nImages:  ${config.imageVersion ? 'published' : 'local'}`);
  if (config.imageVersion) console.log(`Version: ${config.imageVersion}`);
  if (isDefault) console.log('Using default configuration (setup has not been saved).');
}
