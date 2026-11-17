import assert from 'node:assert/strict';
import { workspaceId } from '../stack.mjs';

const defaults = {
  organizationName: 'Local Stack',
  organizationKey: 'local-stack',
  projectName: 'Integration Tests',
  projectKey: 'integration-tests',
  environments: ['Dev', 'Prod'],
};

export async function ensureOrganization(stack) {
  const headers = { 'Content-Type': 'application/json' };
  const api = async (path, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`${stack.api}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const result = await response.json();
    assert.ok(response.ok && result.success, `${path}: HTTP ${response.status} ${JSON.stringify(result)}`);
    return result.data;
  };

  const login = await api('/identity/login-by-email', { email: 'test@featbit.com', password: '123456' });
  headers.Authorization = `Bearer ${login.token}`;
  headers.Workspace = await workspaceId(stack);

  const organizations = await api('/organizations');
  let organization = organizations.find(x => x.key === 'playground')
    ?? organizations.find(x => x.key === defaults.organizationKey)
    ?? (organizations.length === 1 ? organizations[0] : undefined);
  assert.ok(organization, 'Expected one seeded organization for onboarding');
  headers.Organization = organization.id;
  if (!organization.initialized) {
    assert.equal(await api('/organizations/onboarding', defaults), true, 'Onboarding result');
    organization = await api(`/organizations/${organization.id}`);
    assert.equal(organization.initialized, true, 'Organization initialized');
    console.log(`[up:organization] ${stack.name}: ${defaults.organizationName} initialized`);
  }
  const projects = await api('/projects');
  const project = projects.find(x => x.key === defaults.projectKey);
  assert.ok(project, 'Onboarding project missing');
  for (const key of ['dev', 'prod']) {
    assert.ok(project.environments.some(x => x.key === key), `Onboarding environment ${key} missing`);
  }
  const environment = project.environments.find(x => x.key === 'dev');
  return { api, organization, project, environment };
}
