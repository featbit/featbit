import type {
  AccessTokenType,
  PermissionDraft,
  PolicyStatement,
  ResourceType,
  UserPolicy,
} from "./access-token-types"

export type PermissionAction = {
  name: string
  descriptionKey: string
  fineGrained?: boolean
}

export type PermissionCategory = {
  type: ResourceType
  labelKey: string
  pattern: string
  supportsSpecific: boolean
  actions: PermissionAction[]
}

const action = (
  name: string,
  descriptionKey: string,
  fineGrained = false
): PermissionAction => ({ name, descriptionKey, fineGrained })

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    type: "flag",
    labelKey: "accessTokens.permissions.categories.flag",
    pattern: "project/*:env/*:flag/*",
    supportsSpecific: true,
    actions: [
      action("*", "accessTokens.permissionDescriptions.allFlagActions"),
      action(
        "CreateFlag",
        "accessTokens.permissionDescriptions.createFlag",
        true
      ),
      action(
        "ArchiveFlag",
        "accessTokens.permissionDescriptions.archiveFlag",
        true
      ),
      action(
        "RestoreFlag",
        "accessTokens.permissionDescriptions.restoreFlag",
        true
      ),
      action(
        "DeleteFlag",
        "accessTokens.permissionDescriptions.deleteFlag",
        true
      ),
      action(
        "CloneFlag",
        "accessTokens.permissionDescriptions.cloneFlag",
        true
      ),
      action(
        "UpdateFlagName",
        "accessTokens.permissionDescriptions.updateFlagName",
        true
      ),
      action(
        "ToggleFlag",
        "accessTokens.permissionDescriptions.toggleFlag",
        true
      ),
      action(
        "UpdateFlagDescription",
        "accessTokens.permissionDescriptions.updateFlagDescription",
        true
      ),
      action(
        "UpdateFlagOffVariation",
        "accessTokens.permissionDescriptions.updateFlagOffVariation",
        true
      ),
      action(
        "UpdateFlagTags",
        "accessTokens.permissionDescriptions.updateFlagTags",
        true
      ),
      action(
        "UpdateFlagIndividualTargeting",
        "accessTokens.permissionDescriptions.updateFlagIndividualTargeting",
        true
      ),
      action(
        "UpdateFlagTargetingRules",
        "accessTokens.permissionDescriptions.updateFlagTargetingRules",
        true
      ),
      action(
        "UpdateFlagDefaultRule",
        "accessTokens.permissionDescriptions.updateFlagDefaultRule",
        true
      ),
    ],
  },
  {
    type: "segment",
    labelKey: "accessTokens.permissions.categories.segment",
    pattern: "project/*:env/*:segment/*",
    supportsSpecific: true,
    actions: [
      action("*", "accessTokens.permissionDescriptions.allSegmentActions"),
      action(
        "CreateSegment",
        "accessTokens.permissionDescriptions.createSegment",
        true
      ),
      action(
        "ArchiveSegment",
        "accessTokens.permissionDescriptions.archiveSegment",
        true
      ),
      action(
        "RestoreSegment",
        "accessTokens.permissionDescriptions.restoreSegment",
        true
      ),
      action(
        "DeleteSegment",
        "accessTokens.permissionDescriptions.deleteSegment",
        true
      ),
      action(
        "UpdateSegmentName",
        "accessTokens.permissionDescriptions.updateSegmentName",
        true
      ),
      action(
        "UpdateSegmentDescription",
        "accessTokens.permissionDescriptions.updateSegmentDescription",
        true
      ),
      action(
        "UpdateSegmentTags",
        "accessTokens.permissionDescriptions.updateSegmentTags",
        true
      ),
      action(
        "UpdateSegmentTargetingUsers",
        "accessTokens.permissionDescriptions.updateSegmentTargetingUsers",
        true
      ),
      action(
        "UpdateSegmentRules",
        "accessTokens.permissionDescriptions.updateSegmentRules",
        true
      ),
    ],
  },
  {
    type: "project",
    labelKey: "accessTokens.permissions.categories.project",
    pattern: "project/*",
    supportsSpecific: true,
    actions: [
      action(
        "CanAccessProject",
        "accessTokens.permissionDescriptions.canAccessProject"
      ),
      action(
        "CreateProject",
        "accessTokens.permissionDescriptions.createProject"
      ),
      action(
        "DeleteProject",
        "accessTokens.permissionDescriptions.deleteProject"
      ),
      action(
        "UpdateProjectSettings",
        "accessTokens.permissionDescriptions.updateProjectSettings"
      ),
      action("CreateEnv", "accessTokens.permissionDescriptions.createEnv"),
    ],
  },
  {
    type: "env",
    labelKey: "accessTokens.permissions.categories.env",
    pattern: "project/*:env/*",
    supportsSpecific: true,
    actions: [
      action(
        "CanAccessEnv",
        "accessTokens.permissionDescriptions.canAccessEnv"
      ),
      action("DeleteEnv", "accessTokens.permissionDescriptions.deleteEnv"),
      action(
        "UpdateEnvSettings",
        "accessTokens.permissionDescriptions.updateEnvSettings"
      ),
      action(
        "DeleteEnvSecret",
        "accessTokens.permissionDescriptions.deleteEnvSecret"
      ),
      action(
        "CreateEnvSecret",
        "accessTokens.permissionDescriptions.createEnvSecret"
      ),
      action(
        "UpdateEnvSecret",
        "accessTokens.permissionDescriptions.updateEnvSecret"
      ),
    ],
  },
  {
    type: "iam",
    labelKey: "accessTokens.permissions.categories.iam",
    pattern: "iam/*",
    supportsSpecific: false,
    actions: [
      action(
        "CanManageIAM",
        "accessTokens.permissionDescriptions.canManageIam"
      ),
    ],
  },
  {
    type: "workspace",
    labelKey: "accessTokens.permissions.categories.workspace",
    pattern: "workspace/*",
    supportsSpecific: false,
    actions: [
      action(
        "UpdateWorkspaceGeneralSettings",
        "accessTokens.permissionDescriptions.updateWorkspaceGeneralSettings"
      ),
      action(
        "UpdateWorkspaceLicense",
        "accessTokens.permissionDescriptions.updateWorkspaceLicense"
      ),
      action(
        "UpdateWorkspaceSSOSettings",
        "accessTokens.permissionDescriptions.updateWorkspaceSsoSettings"
      ),
    ],
  },
]

export function visibleActions(
  category: PermissionCategory,
  fineGrainedGranted: boolean
) {
  if (
    fineGrainedGranted &&
    (category.type === "flag" || category.type === "segment")
  ) {
    return category.actions.filter((item) => item.name !== "*")
  }

  return category.actions
}

export function createEmptyPermissionDraft(): PermissionDraft {
  return {
    flag: { selectedActions: [], scope: "all", specificResources: [] },
    segment: { selectedActions: [], scope: "all", specificResources: [] },
    project: { selectedActions: [], scope: "all", specificResources: [] },
    env: { selectedActions: [], scope: "all", specificResources: [] },
    iam: { selectedActions: [], scope: "all", specificResources: [] },
    workspace: { selectedActions: [], scope: "all", specificResources: [] },
  }
}

export function permissionDraftFromStatements(
  statements: PolicyStatement[] | undefined,
  fineGrainedGranted: boolean
): PermissionDraft {
  const draft = createEmptyPermissionDraft()

  PERMISSION_CATEGORIES.forEach((category) => {
    const matching = (statements ?? []).filter(
      (statement) =>
        statement.effect === "allow" && statement.resourceType === category.type
    )

    if (!matching.length) {
      return
    }

    const savedActions = new Set(matching.flatMap((item) => item.actions))
    const actions = visibleActions(category, fineGrainedGranted)
    draft[category.type].selectedActions = savedActions.has("*")
      ? !fineGrainedGranted &&
        (category.type === "flag" || category.type === "segment")
        ? actions.filter((item) => item.name === "*").map((item) => item.name)
        : actions.map((item) => item.name)
      : actions
          .filter((item) => savedActions.has(item.name))
          .map((item) => item.name)

    const resources = Array.from(
      new Set(matching.flatMap((item) => item.resources))
    )
    const isAll = resources.includes(category.pattern)
    draft[category.type].scope = isAll ? "all" : "specific"
    draft[category.type].specificResources = resources.filter(
      (resource) => resource !== category.pattern
    )
  })

  return draft
}

export function permissionDraftToStatements(
  draft: PermissionDraft
): PolicyStatement[] {
  return PERMISSION_CATEGORIES.flatMap((category) => {
    const categoryDraft = draft[category.type]
    if (!categoryDraft.selectedActions.length) {
      return []
    }

    return [
      {
        id: crypto.randomUUID(),
        resourceType: category.type,
        effect: "allow" as const,
        actions: categoryDraft.selectedActions,
        resources:
          category.supportsSpecific && categoryDraft.scope === "specific"
            ? categoryDraft.specificResources
            : [category.pattern],
      },
    ]
  })
}

function userStatements(policies: UserPolicy[]) {
  return policies.flatMap((policy) => policy.statements ?? [])
}

export function hasOwnerPolicy(policies: UserPolicy[]) {
  return policies.some(
    (policy) => policy.name === "Owner" && policy.type === "SysManaged"
  )
}

function wildcardMatch(value: string, pattern: string) {
  const expression = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*")
  return new RegExp(`^${expression}$`).test(value)
}

function statementMatchesAction(
  statement: PolicyStatement,
  resourceType: string,
  actionName: string
) {
  const typeMatches =
    statement.resourceType === "*" || statement.resourceType === resourceType
  const actionMatches = statement.actions.some(
    (actionNameInStatement) =>
      actionNameInStatement === "*" || actionNameInStatement === actionName
  )

  return typeMatches && actionMatches
}

export function isPermissionGranted(
  policies: UserPolicy[],
  resourceName: string,
  resourceType: string,
  actionName: string
) {
  if (hasOwnerPolicy(policies)) {
    return true
  }

  const matching = userStatements(policies).filter(
    (statement) =>
      statementMatchesAction(statement, resourceType, actionName) &&
      statement.resources.some((resource) =>
        wildcardMatch(resourceName, resource)
      )
  )

  return (
    matching.length > 0 &&
    matching.every((statement) => statement.effect === "allow")
  )
}

export function canManageAccessTokenType(
  policies: UserPolicy[],
  type: AccessTokenType
) {
  return isPermissionGranted(
    policies,
    "access-token/*",
    "access-token",
    type === "Personal"
      ? "ManagePersonalAccessTokens"
      : "ManageServiceAccessTokens"
  )
}

export function canGrantAction(
  policies: UserPolicy[],
  resourceType: ResourceType,
  actionName: string
) {
  if (hasOwnerPolicy(policies)) {
    return true
  }

  const matching = userStatements(policies).filter((statement) =>
    statementMatchesAction(statement, resourceType, actionName)
  )

  return (
    matching.some((statement) => statement.effect === "allow") &&
    matching.every((statement) => statement.effect === "allow")
  )
}

export function resourcePathLabel(resourceName: string) {
  return resourceName
    .split(":")
    .map((segment) => {
      const [path, tags] = segment.split(";")
      const value = path.split("/").slice(1).join("/") || path
      return tags ? `${value};${tags}` : value
    })
    .join(" / ")
}
