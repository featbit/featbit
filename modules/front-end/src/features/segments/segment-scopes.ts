export function environmentScopeRn(input: {
  organizationKey: string
  projectKey: string
  environmentKey: string
}) {
  return `organization/${input.organizationKey}:project/${input.projectKey}:env/${input.environmentKey}`
}
