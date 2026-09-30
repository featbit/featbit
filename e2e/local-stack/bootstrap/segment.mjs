import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function ensureSegment({ api, organization, project, environment }) {
  const base = `/envs/${environment.id}/segments`;
  const result = await api(`${base}?pageSize=100`);
  let segment = result.items.find(x => x.key === 'tester');
  if (!segment) {
    segment = await api(base, {
      name: 'Tester', key: 'tester', type: 'environment-specific',
      scopes: [`organization/${organization.key}:project/${project.key}:env/${environment.key}`],
      description: 'Users whose role property is tester',
    });
    assert.equal(await api(`${base}/${segment.id}/targeting`, {
      included: [], excluded: [], comment: 'Initialize tester fixture',
      rules: [{ id: randomUUID(), name: 'Role is tester', conditions: [{
        id: randomUUID(), property: 'role', op: 'Equal', value: 'tester',
      }] }],
    }, 'PUT'), true, 'Tester targeting update');
    console.log(`[up:segment] ${environment.key}: created tester`);
  }
  assert.equal(segment.type, 'environment-specific', 'Tester segment type');
  const detail = await api(`${base}/${segment.id}`);
  assert.ok(detail.rules.some(rule => rule.conditions.some(condition =>
    condition.property === 'role' && condition.op === 'Equal' && condition.value === 'tester')),
  'Tester segment must match role=tester');
}
