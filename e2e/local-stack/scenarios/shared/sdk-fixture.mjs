import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ensureOrganization } from '../../bootstrap/organization.mjs';
import { waitFor, logs } from '../../stack.mjs';

const condition = (property, value) => ({ id: randomUUID(), property, op: 'Equal', value });

export async function sdkFixture(stack, kind, run) {
  const runId = `sdk-${kind}-${randomUUID()}`;
  const evidence = { runId, stack: stack.name, startedAt: new Date().toISOString(), steps: [] };
  const { api, organization, project, environment } = await ensureOrganization(stack);
  const flagBase = `/envs/${environment.id}/feature-flags`;
  const segmentBase = `/envs/${environment.id}/segments`;
  const flagKey = runId;
  const values = [{ id: randomUUID(), name: 'Control', value: 'control' },
    { id: randomUUID(), name: 'Treatment', value: 'treatment' }];
  const users = ['tester', 'guest'].map(role => ({
    keyId: `${runId}-${role}`, name: `${kind} ${role}`,
    customizedProperties: [{ name: 'role', value: role }],
  }));
  let flag, segment;
  const expected = async (label, evaluate, tester, guest) => {
    await waitFor(label, async () => {
      const actual = await evaluate();
      assert.equal(actual.tester.value, tester, `${label}: tester`);
      assert.equal(actual.guest.value, guest, `${label}: guest`);
      for (const [role, value] of Object.entries({ tester, guest })) {
        if (actual[role].valueId !== undefined) {
          assert.equal(actual[role].valueId, values[value === 'control' ? 0 : 1].id,
            `${label}: ${role} variation ID`);
          assert.equal(actual[role].kind, value === 'control' ? 'Fallthrough' : 'RuleMatch',
            `${label}: ${role} evaluation reason`);
        } else {
          assert.equal(actual[role].reason, value === 'control' ? 'default' : 'SDK live update',
            `${label}: ${role} evaluation reason`);
        }
      }
      evidence.steps.push({ label, at: new Date().toISOString(), actual });
    }, 90_000);
  };
  const target = async property => {
    const latest = await api(`${flagBase}/${flagKey}`);
    const rule = {
      id: randomUUID(), name: 'SDK live update', includedInExpt: false,
      conditions: [property],
      variations: [{ id: values[1].id, rollout: [0, 1], exptRollout: 0 }],
    };
    await api(`${flagBase}/${flagKey}/targeting`, {
      revision: latest.revision,
      targeting: {
        disabledVariationId: values[0].id, targetUsers: [], rules: [rule],
        fallthrough: { includedInExpt: false,
          variations: [{ id: values[0].id, rollout: [0, 1], exptRollout: 0 }] },
        exptIncludeAllTargets: false,
      },
      comment: runId,
    }, 'PUT');
  };
  try {
    flag = await api(flagBase, {
      name: runId, key: flagKey, description: 'Isolated SDK live update test',
      isEnabled: true, variationType: 'string', variations: values,
      disabledVariationId: values[0].id, enabledVariationId: values[0].id, tags: [],
    });
    segment = await api(segmentBase, {
      name: runId, key: runId, type: 'environment-specific',
      scopes: [`organization/${organization.key}:project/${project.key}:env/${environment.key}`],
      description: 'Isolated SDK live update test',
    });
    await api(`${segmentBase}/${segment.id}/targeting`, {
      included: [], excluded: [], comment: runId,
      rules: [{ id: randomUUID(), name: 'Tester', conditions: [condition('role', 'tester')] }],
    }, 'PUT');
    const secrets = Object.fromEntries(environment.secrets.map(x => [x.type, x.value]));
    const context = { stack, runId, flagKey, values, users, secrets, evidence };
    await run(context, async evaluate => {
      await expected('initial', evaluate, 'control', 'control');
      await target(condition('role', 'tester'));
      await expected('flag update', evaluate, 'treatment', 'control');
      await target(condition('User is in segment', JSON.stringify([segment.id])));
      await expected('segment rule', evaluate, 'treatment', 'control');
      await api(`${segmentBase}/${segment.id}/targeting`, {
        included: [], excluded: [], comment: runId,
        rules: [{ id: randomUUID(), name: 'Guest', conditions: [condition('role', 'guest')] }],
      }, 'PUT');
      await expected('segment update', evaluate, 'control', 'treatment');
    });
    evidence.success = true;
  } catch (error) {
    evidence.success = false;
    evidence.error = error.stack;
    throw error;
  } finally {
    try {
      // These resources are unique to this run; keep them on failure for diagnosis.
      if (evidence.success) {
        if (flag) {
          await api(`${flagBase}/${flagKey}/archive`, { comment: runId }, 'PUT');
          await api(`${flagBase}/${flagKey}`, { comment: runId }, 'DELETE');
        }
        if (segment) {
          await api(`${segmentBase}/${segment.id}/archive`, { comment: runId }, 'PUT');
          await api(`${segmentBase}/${segment.id}`, { comment: runId }, 'DELETE');
        }
      }
    } catch (error) {
      evidence.success = false;
      evidence.error = error.stack;
      throw error;
    } finally {
      await stack.save(`${runId}.json`, evidence);
      await logs(stack);
    }
  }
  console.log(`[PASS] ${stack.name}: ${kind} SDK initial evaluation, flag update, segment update`);
}
