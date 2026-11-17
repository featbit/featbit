import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export const flags = [
  { key: 'boolean-flag', name: 'Boolean Flag', variationType: 'boolean', values: ['false', 'true'] },
  { key: 'string-flag', name: 'String Flag', variationType: 'string', values: ['control', 'treatment'] },
  { key: 'number-flag', name: 'Number Flag', variationType: 'number', values: ['0', '1'] },
  { key: 'json-flag', name: 'JSON Flag', variationType: 'json', values: ['{"enabled":false}', '{"enabled":true}'] },
];

export async function ensureFlags({ api, environment }) {
  const base = `/envs/${environment.id}/feature-flags`;
  for (const fixture of flags) {
    const result = await api(`${base}?${new URLSearchParams({ name: fixture.key, pageSize: '100' })}`);
    let flag = result.items.find(x => x.key === fixture.key);
    if (!flag) {
      const variations = fixture.values.map((value, index) => ({
        id: randomUUID(), name: index === 0 ? 'Control' : 'Treatment', value,
      }));
      flag = await api(base, {
        name: fixture.name, key: fixture.key, description: 'Reusable local integration fixture',
        isEnabled: true, variationType: fixture.variationType, variations,
        disabledVariationId: variations[0].id, enabledVariationId: variations[1].id, tags: [],
      });
      console.log(`[up:flag] ${environment.key}: created ${fixture.key}`);
    }
    assert.equal(flag.variationType, fixture.variationType, `${fixture.key} variation type`);
    assert.equal(flag.isEnabled, true, `${fixture.key} must be enabled`);
    for (const [index, name] of ['Control', 'Treatment'].entries()) {
      assert.ok(flag.variations.some(x => x.name === name && x.value === fixture.values[index]),
        `${fixture.key} ${name} variation missing`);
    }
  }
}
