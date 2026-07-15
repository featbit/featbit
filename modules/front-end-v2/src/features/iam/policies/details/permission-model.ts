export type PolicyEffect = "allow" | "deny"

export type PolicyStatement = {
  id: string
  resourceType: ResourceType
  effect: PolicyEffect
  actions: string[]
  resources: string[]
}

export type PolicyResource = {
  id: string
  name: string
  rn: string
  type: string
}

export type ResourceType =
  | "*"
  | "workspace"
  | "organization"
  | "iam"
  | "access-token"
  | "relay-proxy"
  | "project"
  | "env"
  | "flag"
  | "segment"

export type PermissionAction = {
  name: string
  resourceType: ResourceType
  label: string
  specificApplicable: boolean
  fineGrained?: boolean
}

export const RESOURCE_TYPES: ResourceType[] = [
  "*",
  "workspace",
  "organization",
  "iam",
  "access-token",
  "relay-proxy",
  "project",
  "env",
  "flag",
  "segment",
]

export const SPECIFIC_RESOURCE_TYPES = new Set<ResourceType>([
  "project",
  "env",
  "flag",
  "segment",
])

export const RESOURCE_PATTERNS: Record<ResourceType, string> = {
  "*": "*",
  workspace: "workspace/*",
  organization: "organization/*",
  iam: "iam/*",
  "access-token": "access-token/*",
  "relay-proxy": "relay-proxy/*",
  project: "project/*",
  env: "project/*:env/*",
  flag: "project/*:env/*:flag/*",
  segment: "project/*:env/*:segment/*",
}

const action = (
  resourceType: ResourceType,
  name: string,
  label: string,
  specificApplicable = true,
  fineGrained = false
): PermissionAction => ({
  resourceType,
  name,
  label,
  specificApplicable,
  fineGrained,
})

export const PERMISSION_ACTIONS: PermissionAction[] = [
  action("*", "*", "All actions", false),
  action("project", "CanAccessProject", "Access project"),
  action("project", "CreateProject", "Create projects", false),
  action("project", "DeleteProject", "Delete project"),
  action("project", "UpdateProjectSettings", "Update project settings"),
  action("project", "CreateEnv", "Create environments"),
  action("env", "CanAccessEnv", "Access environment"),
  action("env", "DeleteEnv", "Delete environment"),
  action("env", "UpdateEnvSettings", "Update environment settings"),
  action("env", "DeleteEnvSecret", "Delete environment secrets"),
  action("env", "CreateEnvSecret", "Create environment secrets"),
  action("env", "UpdateEnvSecret", "Update environment secrets"),
  action("flag", "*", "All flag actions"),
  action("flag", "CreateFlag", "Create flags", true, true),
  action("flag", "ArchiveFlag", "Archive flags", true, true),
  action("flag", "RestoreFlag", "Restore flags", true, true),
  action("flag", "DeleteFlag", "Delete flags", true, true),
  action("flag", "CloneFlag", "Clone flags", true, true),
  action("flag", "CopyFlagTo", "Copy flags", true, true),
  action("flag", "UpdateFlagName", "Update flag name", true, true),
  action("flag", "ToggleFlag", "Toggle flags", true, true),
  action(
    "flag",
    "UpdateFlagDescription",
    "Update flag description",
    true,
    true
  ),
  action("flag", "UpdateFlagOffVariation", "Update off variation", true, true),
  action("flag", "UpdateFlagTags", "Update flag tags", true, true),
  action(
    "flag",
    "UpdateFlagIndividualTargeting",
    "Update individual targeting",
    true,
    true
  ),
  action(
    "flag",
    "UpdateFlagTargetingRules",
    "Update targeting rules",
    true,
    true
  ),
  action("flag", "UpdateFlagDefaultRule", "Update default rule", true, true),
  action("flag", "UpdateFlagVariations", "Update variations", true, true),
  action("segment", "*", "All segment actions"),
  action("segment", "CreateSegment", "Create segments", true, true),
  action("segment", "ArchiveSegment", "Archive segments", true, true),
  action("segment", "RestoreSegment", "Restore segments", true, true),
  action("segment", "DeleteSegment", "Delete segments", true, true),
  action("segment", "UpdateSegmentName", "Update segment name", true, true),
  action(
    "segment",
    "UpdateSegmentDescription",
    "Update segment description",
    true,
    true
  ),
  action("segment", "UpdateSegmentTags", "Update segment tags", true, true),
  action(
    "segment",
    "UpdateSegmentTargetingUsers",
    "Update targeted users",
    true,
    true
  ),
  action("segment", "UpdateSegmentRules", "Update segment rules", true, true),
  action(
    "workspace",
    "UpdateWorkspaceGeneralSettings",
    "Update general settings",
    false
  ),
  action("workspace", "UpdateWorkspaceLicense", "Update license", false),
  action(
    "workspace",
    "UpdateWorkspaceSSOSettings",
    "Update SSO settings",
    false
  ),
  action("organization", "UpdateOrgSortFlagsBy", "Update flag sorting", false),
  action("organization", "UpdateOrgName", "Update organization name", false),
  action(
    "organization",
    "UpdateOrgDefaultUserPermissions",
    "Update default user permissions",
    false
  ),
  action("organization", "CreateOrg", "Create organizations", false),
  action("iam", "CanManageIAM", "Manage IAM", false),
  action("access-token", "ListAccessTokens", "List access tokens", false),
  action(
    "access-token",
    "ManageServiceAccessTokens",
    "Manage service access tokens",
    false
  ),
  action(
    "access-token",
    "ManagePersonalAccessTokens",
    "Manage personal access tokens",
    false
  ),
  action("relay-proxy", "ListRelayProxies", "List relay proxies", false),
  action("relay-proxy", "ManageRelayProxies", "Manage relay proxies", false),
]

export function isAllResources(statement: PolicyStatement) {
  return statement.resources.includes(RESOURCE_PATTERNS[statement.resourceType])
}

export function actionsForStatement(statement: PolicyStatement) {
  const allResources = isAllResources(statement)
  return PERMISSION_ACTIONS.filter(
    (item) =>
      item.resourceType === statement.resourceType &&
      (allResources || item.specificApplicable)
  )
}

export function createPolicyStatement(): PolicyStatement {
  return {
    id: crypto.randomUUID(),
    resourceType: "*",
    effect: "allow",
    actions: ["*"],
    resources: ["*"],
  }
}

export function resourceDisplayName(rn: string) {
  const lastPart = rn.split(":").at(-1) ?? rn
  return lastPart.split("/").at(-1) || rn
}
