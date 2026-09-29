import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { processRun } from '../../stack.mjs';
import { sdkFixture } from '../shared/sdk-fixture.mjs';

const project = fileURLToPath(new URL('./ServerSdkProbe.csproj', import.meta.url));
const assembly = join(fileURLToPath(new URL('./', import.meta.url)),
  'bin', 'Release', 'net8.0', 'ServerSdkProbe.dll');

export async function testServerSdk(stack) {
  await processRun('dotnet', ['build', project, '-c', 'Release', '-v', 'quiet'], { quiet: true });
  await sdkFixture(stack, 'server', async ({ flagKey, runId, secrets }, verify) => {
    assert.ok(secrets.server, 'Server SDK key missing');
    const child = spawn('dotnet', [assembly], {
      env: { ...process.env, FB_SERVER_SECRET: secrets.server, FB_ELS_URL: stack.els,
        FB_FLAG_KEY: flagKey, FB_USER_PREFIX: runId },
      stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    });
    const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
    let stderr = '';
    child.stdin.on('error', () => {});
    child.stderr.on('data', chunk => { stderr += chunk; });
    try {
      await verify(async () => {
        child.stdin.write('evaluate\n');
        let timer;
        const reply = await Promise.race([
          lines.next(),
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Server SDK probe timed out')), 10_000); }),
        ]).finally(() => clearTimeout(timer));
        assert.ok(!reply.done, `Server SDK probe exited: ${stderr}`);
        const state = JSON.parse(reply.value);
        assert.equal(state.initialized, true, 'Server SDK not initialized');
        for (const user of ['tester', 'guest']) {
          assert.notEqual(state.result[user].value, 'missing', `${user}: fallback returned`);
          assert.ok(state.result[user].valueId, `${user}: variation ID missing`);
          assert.ok(state.result[user].reason, `${user}: evaluation reason missing`);
        }
        return { tester: state.result.tester, guest: state.result.guest };
      });
    } finally {
      child.stdin.end('close\n');
      let timer;
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        new Promise(resolve => { timer = setTimeout(() => { child.kill(); resolve(); }, 5_000); }),
      ]).finally(() => clearTimeout(timer));
    }
  });
}
