import { uuidv4 } from "@utils/index";

export interface IPolicyStatement {
  id: string;
  resourceType: string;
  effect: string;
  actions: string[];
  resources: string[];
}

export interface Resource {
  id: string;
  name: string;
  rn: string;
  type: ResourceTypeEnum;
}

export interface ResourceV2 {
  id: string;
  name: string;
  pathName: string;
  rn: string;
  type: ResourceTypeEnum;
}

export function isChildResourceOf(childRN: string, parentRN: string) : boolean {
  // check if childRN is a child resource of parentRN
  // ex: childRN = organization/abc:project/def:env/ghi, parentRN = organization/abc:project/def
  return childRN !== parentRN && `${childRN}:`.startsWith(`${parentRN}:`);
}

export interface ResourceFilter {
  type: ResourceTypeEnum;
  name: string;
}

export interface ResourceFilterV2 {
  spaceLevel: ResourceSpaceLevel;
  types: ResourceTypeEnum[];
  name: string;
}

export interface ValPlaceholder {
  displayName: string,
  name: string
}

export interface IamPolicyAction {
  id: string;
  name: string;
  resourceType?: ResourceTypeEnum,
  description: string;
  isOpenAPIApplicable: boolean;
  isSpecificApplicable: boolean; // can it be applied to a specific resource, ex: an environment with name "abc"
  isFineGrainedAction: boolean;
}

export enum ResourceTypeEnum {
  All = '*',
  workspace = 'workspace',
  organization = 'organization',
  IAM = 'iam',
  AccessToken = 'access-token',
  RelayProxy = 'relay-proxy',
  Project = 'project',
  Env = 'env',
  Flag = 'flag',
  Segment = 'segment'
}

export enum ResourceSpaceLevel {
  Workspace = 'workspace',
  Organization = 'organization'
}

export enum EffectEnum {
  Allow = 'allow',
  Deny = 'deny'
}

export interface ResourceType {
  type: ResourceTypeEnum,
  pattern: string,
  displayName: string
}

export interface RNViewModel {
  val: string;
  id: string;
  isInvalid?: boolean
}

export const generalResourceRNPattern = {
  all: '*',
  workspace: 'workspace/*',
  organization: 'organization/*',
  iam: 'iam/*',
  accessToken: 'access-token/*',
  "access-token": 'access-token/*', // this duplicated property is necessary for resource types consisting of multiple words because of access-token-drawer.component.ts line 132
  relayProxy: 'relay-proxy/*',
  "relay-proxy": 'relay-proxy/*', // this duplicated property is necessary for resource types consisting of multiple words because of access-token-drawer.component.ts line 132
  project: 'project/*',
  env: 'project/*:env/*',
  flag: 'project/*:env/*:flag/*',
  segment: 'project/*:env/*:segment/*'
};

export const ResourceTypeAll: ResourceType = {
  type: ResourceTypeEnum.All,
  pattern: generalResourceRNPattern.all,
  displayName: $localize`:@@iam.rsc-type.all:All`
};

export const ResourceTypeWorkspace: ResourceType = {
  type: ResourceTypeEnum.workspace,
  pattern: generalResourceRNPattern.workspace,
  displayName: $localize`:@@iam.rsc-type.workspace:Workspace`
};

export const ResourceTypeOrganization: ResourceType = {
  type: ResourceTypeEnum.organization,
  pattern: generalResourceRNPattern.organization,
  displayName: $localize`:@@iam.rsc-type.organization:Organization`
};

export const ResourceTypeIAM: ResourceType = {
  type: ResourceTypeEnum.IAM,
  pattern: generalResourceRNPattern.iam,
  displayName: $localize`:@@iam.rsc-type.iam:IAM`
};

export const ResourceTypeAccessToken: ResourceType = {
  type: ResourceTypeEnum.AccessToken,
  pattern: generalResourceRNPattern.accessToken,
  displayName: $localize`:@@iam.rsc-type.access-token:Access token`
};

export const ResourceTypeRelayProxy: ResourceType = {
  type: ResourceTypeEnum.RelayProxy,
  pattern: generalResourceRNPattern.relayProxy,
  displayName: $localize`:@@iam.rsc-type.relay-proxy:Relay proxy`
};

export const ResourceTypeProject: ResourceType = {
  type: ResourceTypeEnum.Project,
  pattern: 'project/{project}',
  displayName: $localize`:@@iam.rsc-type.project:Project`
};

export const ResourceTypeEnv: ResourceType = {
  type: ResourceTypeEnum.Env,
  pattern: 'project/{project}:env/{env}',
  displayName: $localize`:@@iam.rsc-type.env:Environment`
};

export const ResourceTypeFlag: ResourceType = {
  type: ResourceTypeEnum.Flag,
  pattern: 'project/{project}:env/{env}:flag/{flag}',
  displayName: $localize`:@@iam.rsc-type.feature-flag:Feature flag`
};

export const ResourceTypeSegment: ResourceType = {
  type: ResourceTypeEnum.Segment,
  pattern: 'project/{project}:env/{env}:segment/*',
  displayName: $localize`:@@iam.rsc-type.segment:Segment`
};

export const resourcesTypes: ResourceType[] = [
  ResourceTypeAll,
  ResourceTypeWorkspace,
  ResourceTypeOrganization,
  ResourceTypeIAM,
  ResourceTypeAccessToken,
  ResourceTypeRelayProxy,
  ResourceTypeProject,
  ResourceTypeEnv,
  ResourceTypeFlag,
  ResourceTypeSegment
];

export enum ResourceParamTypeEnum {
  Project = 'project',
  Env = 'env',
  Flag = 'flag',
  Tag = 'tag',
}

export interface ResourceParamViewModel {
  val: string;
  type: ResourceParamTypeEnum;
  placeholder: ValPlaceholder;
  isAnyChecked: boolean;
  isInvalid: boolean
}

export const rscParamsDict: { [key in ResourceTypeEnum]: ResourceParamViewModel[] } = {
  [ResourceTypeEnum.All]: [],
  [ResourceTypeEnum.workspace]: [],
  [ResourceTypeEnum.organization]: [],
  [ResourceTypeEnum.IAM]: [],
  [ResourceTypeEnum.AccessToken]: [],
  [ResourceTypeEnum.RelayProxy]: [],
  [ResourceTypeEnum.Project]: [
    {
      val: '',
      type: ResourceParamTypeEnum.Project,
      placeholder: {
        name: '{project}',
        displayName: $localize`:@@iam.policy.project:Project`
      },
      isAnyChecked: false,
      isInvalid: false
    }
  ],
  [ResourceTypeEnum.Env]: [
    {
      val: '',
      type: ResourceParamTypeEnum.Project,
      placeholder: {
        name: '{project}',
        displayName: $localize`:@@iam.policy.project:Project`
      },
      isAnyChecked: false,
      isInvalid: false
    },
    {
      val: '',
      type: ResourceParamTypeEnum.Env,
      placeholder: {
        name: '{env}',
        displayName: $localize`:@@iam.policy.environment:Environment`
      },
      isAnyChecked: false,
      isInvalid: false
    }
  ],
  [ResourceTypeEnum.Flag]: [
    {
      val: '',
      type: ResourceParamTypeEnum.Project,
      placeholder: {
        name: '{project}',
        displayName: $localize`:@@iam.policy.project:Project`
      },
      isAnyChecked: false,
      isInvalid: false
    },
    {
      val: '',
      type: ResourceParamTypeEnum.Env,
      placeholder: {
        name: '{env}',
        displayName: $localize`:@@iam.policy.environment:Environment`
      },
      isAnyChecked: false,
      isInvalid: false
    },
    {
      val: '',
      type: ResourceParamTypeEnum.Flag,
      placeholder: {
        name: '{flag}',
        displayName: $localize`:@@iam.policy.flags:Flags`
      },
      isAnyChecked: false,
      isInvalid: false
    },
    {
      val: '',
      type: ResourceParamTypeEnum.Tag,
      placeholder: {
        name: undefined,
        displayName: $localize`:@@iam.policy.tags:Tags`
      },
      isAnyChecked: false,
      isInvalid: false
    }
  ],
  [ResourceTypeEnum.Segment]: [],
};

export const permissionActions: { [key: string]: IamPolicyAction } = {
  All: {
    id: uuidv4(),
    name: '*',
    resourceType: ResourceTypeEnum.All,
    description: $localize`:@@iam.action.all:All`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  CanAccessProject: {
    id: uuidv4(),
    name: 'CanAccessProject',
    resourceType: ResourceTypeEnum.Project,
    description: $localize`:@@iam.action.can-access-project:Can access project`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  CreateProject: {
    id: uuidv4(),
    name: 'CreateProject',
    resourceType: ResourceTypeEnum.Project,
    description: $localize`:@@iam.action.create-projects:Create projects`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  DeleteProject: {
    id: uuidv4(),
    name: 'DeleteProject',
    resourceType: ResourceTypeEnum.Project,
    description: $localize`:@@iam.action.delete-projects:Delete projects`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  UpdateProjectSettings: {
    id: uuidv4(),
    name: 'UpdateProjectSettings',
    resourceType: ResourceTypeEnum.Project,
    description: $localize`:@@iam.action.update-project-settings:Update project settings`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  CreateEnv: {
    id: uuidv4(),
    name: 'CreateEnv',
    resourceType: ResourceTypeEnum.Project,
    description: $localize`:@@iam.action.create-env:Create environment`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  CanAccessEnv: {
    id: uuidv4(),
    name: 'CanAccessEnv',
    resourceType: ResourceTypeEnum.Env,
    description: $localize`:@@iam.action.can-access-env:Can access environment`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  DeleteEnv: {
    id: uuidv4(),
    name: 'DeleteEnv',
    resourceType: ResourceTypeEnum.Env,
    description: $localize`:@@iam.action.delete-envs:Delete environments`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  UpdateEnvSettings: {
    id: uuidv4(),
    name: 'UpdateEnvSettings',
    resourceType: ResourceTypeEnum.Env,
    description: $localize`:@@iam.action.update-env-settings:Update environment settings`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  DeleteEnvSecret: {
    id: uuidv4(),
    name: 'DeleteEnvSecret',
    resourceType: ResourceTypeEnum.Env,
    description: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  CreateEnvSecret: {
    id: uuidv4(),
    name: 'CreateEnvSecret',
    resourceType: ResourceTypeEnum.Env,
    description: $localize`:@@iam.action.create-env-secret:Create environment secret`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  UpdateEnvSecret: {
    id: uuidv4(),
    name: 'UpdateEnvSecret',
    resourceType: ResourceTypeEnum.Env,
    description: $localize`:@@iam.action.update-env-secret:Update environment secret`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },

  // feature flag
  FlagAllActions: {
    id: uuidv4(),
    name: '*',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.flag-all-actions:All actions`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: false
  },
  CreateFlag: {
    id: uuidv4(),
    name: 'CreateFlag',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.create-flag:Create feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  ArchiveFlag: {
    id: uuidv4(),
    name: 'ArchiveFlag',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.archive-flag:Archive feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  RestoreFlag: {
    id: uuidv4(),
    name: 'RestoreFlag',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.restore-flag:Restore feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  DeleteFlag: {
    id: uuidv4(),
    name: 'DeleteFlag',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.delete-flag:Delete feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  CloneFlag: {
    id: uuidv4(),
    name: 'CloneFlag',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.clone-flag:Clone feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  CopyFlagTo: {
    id: uuidv4(),
    name: 'CopyFlagTo',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.copy-flag-to:Copy feature flag to another environment`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  UpdateFlagName: {
    id: uuidv4(),
    name: 'UpdateFlagName',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-name:Rename a feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  ToggleFlag: {
    id: uuidv4(),
    name: 'ToggleFlag',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-on:Toggle a feature on or off`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  UpdateFlagDescription: {
    id: uuidv4(),
    name: 'UpdateFlagDescription',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-description:Update the description of a feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  UpdateFlagOffVariation: {
    id: uuidv4(),
    name: 'UpdateFlagOffVariation',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-off-variation:Change the variation returned when a feature flag is set to off`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  UpdateFlagTags: {
    id: uuidv4(),
    name: 'UpdateFlagTags',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-tags:Change the tags associated with a feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  UpdateFlagIndividualTargeting: {
    id: uuidv4(),
    name: 'UpdateFlagIndividualTargeting',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-individual-targeting:Change a flag's individual user targeting rules`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  UpdateFlagRules: {
    id: uuidv4(),
    name: 'UpdateFlagTargetingRules',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-rules:Change a flag's custom targeting rules`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  UpdateFlagDefaultRule: {
    id: uuidv4(),
    name: 'UpdateFlagDefaultRule',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-fallthrough:Change a flag's default rule`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },
  UpdateFlagVariations: {
    id: uuidv4(),
    name: 'UpdateFlagVariations',
    resourceType: ResourceTypeEnum.Flag,
    description: $localize`:@@iam.action.update-flag-variations:Change a flag's variations`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true,
    isFineGrainedAction: true
  },

  // segment
  ManageSegment: {
    id: uuidv4(),
    name: 'ManageSegment',
    resourceType: ResourceTypeEnum.Segment,
    description: $localize`:@@iam.action.manage-segment:Manage segment`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },

  // workspace
  UpdateWorkspaceGeneralSettings: {
    id: uuidv4(),
    name: 'UpdateWorkspaceGeneralSettings',
    resourceType: ResourceTypeEnum.workspace,
    description: $localize`:@@iam.action.update-ws-general:Update workspace general settings`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  UpdateWorkspaceLicense: {
    id: uuidv4(),
    name: 'UpdateWorkspaceLicense',
    resourceType: ResourceTypeEnum.workspace,
    description: $localize`:@@iam.action.update-ws-license:Update workspace license`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  UpdateWorkspaceSSOSettings: {
    id: uuidv4(),
    name: 'UpdateWorkspaceSSOSettings',
    resourceType: ResourceTypeEnum.workspace,
    description: $localize`:@@iam.action.update-ws-sso:Update workspace SSO settings`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },

  // org
  UpdateOrgSortFlagsBy: {
    id: uuidv4(),
    name: 'UpdateOrgSortFlagsBy',
    resourceType: ResourceTypeEnum.organization,
    description: $localize`:@@iam.action.update-org-sort-flags-by:Update sort flags by`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  UpdateOrgName: {
    id: uuidv4(),
    name: 'UpdateOrgName',
    resourceType: ResourceTypeEnum.organization,
    description: $localize`:@@iam.action.update-org-name:Update org name`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  UpdateOrgDefaultUserPermissions: {
    id: uuidv4(),
    name: 'UpdateOrgDefaultUserPermissions',
    resourceType: ResourceTypeEnum.organization,
    description: $localize`:@@iam.action.update-org-default-user-permissions:Update org default user permissions`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  CreateOrg: {
    id: uuidv4(),
    name: 'CreateOrg',
    resourceType: ResourceTypeEnum.organization,
    description: $localize`:@@iam.action.create-org:Create organization`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },

  // iam
  CanManageIAM: {
    id: uuidv4(),
    name: 'CanManageIAM',
    resourceType: ResourceTypeEnum.IAM,
    description: $localize`:@@iam.action.iam:IAM`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },

  // access tokens
  ListAccessTokens: {
    id: uuidv4(),
    name: 'ListAccessTokens',
    resourceType: ResourceTypeEnum.AccessToken,
    description: $localize`:@@iam.action.list-access-tokens:List access tokens`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  ManageServiceAccessTokens: {
    id: uuidv4(),
    name: 'ManageServiceAccessTokens',
    resourceType: ResourceTypeEnum.AccessToken,
    description: $localize`:@@iam.action.manage-service-access-tokens:Manage service access tokens`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  ManagePersonalAccessTokens: {
    id: uuidv4(),
    name: 'ManagePersonalAccessTokens',
    resourceType: ResourceTypeEnum.AccessToken,
    description: $localize`:@@iam.action.manage-personal-access-tokens:Manage personal access tokens`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },

  // relay proxy
  ListRelayProxies: {
    id: uuidv4(),
    name: 'ListRelayProxies',
    resourceType: ResourceTypeEnum.RelayProxy,
    description: $localize`:@@iam.action.list-relay-proxies:List relay proxies`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
  ManageRelayProxies: {
    id: uuidv4(),
    name: 'ManageRelayProxies',
    resourceType: ResourceTypeEnum.RelayProxy,
    description: $localize`:@@iam.action.manage-relay-proxies:Manage relay proxies`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false,
    isFineGrainedAction: false
  },
}

// check if the resource is a general resource
// if returns false, that means the actions which cannot be applied to a specific resource should be hidden
// ex: CreateProject should not be available for a specific project: project/abc
export function isResourceGeneral(type: ResourceTypeEnum, rn: string): boolean {
  const generalResourceTypes = [ResourceTypeEnum.All, ResourceTypeEnum.workspace, ResourceTypeEnum.organization, ResourceTypeEnum.IAM, ResourceTypeEnum.AccessToken, ResourceTypeEnum.RelayProxy];
  if (generalResourceTypes.includes(type)) {
    return true;
  }

  switch (type) {
    case ResourceTypeEnum.Project:
      return rn === generalResourceRNPattern.project;
    case ResourceTypeEnum.Env:
      return rn === generalResourceRNPattern.env;
    case ResourceTypeEnum.Flag:
      return rn === generalResourceRNPattern.flag;
    case ResourceTypeEnum.Segment:
      return rn === generalResourceRNPattern.segment;
  }

  return false;
}

export function getResourceTypeName(type: ResourceTypeEnum): string {
  switch (type) {
    case ResourceTypeEnum.organization:
      return $localize`:@@common.organization:Organization`;
    case ResourceTypeEnum.Project:
      return $localize`:@@common.project:Project`;
    case ResourceTypeEnum.Env:
      return $localize`:@@common.environment:Environment`;
    case ResourceTypeEnum.Flag:
      return $localize`:@@common.flag:Flag`;
    case ResourceTypeEnum.Segment:
      return $localize`:@@common.segment:Segment`;
    default:
      return '';
  }
}

export interface GroupedResource {
  name: string;
  items: ResourceV2[];
}

export function groupResources(resources: ResourceV2[]): GroupedResource[] {
  const groupedItems: GroupedResource[] = [];
  for (const resource of resources) {
    const type = getResourceTypeName(resource.type);
    const group = groupedItems.find(x => x.name === type);
    if (group) {
      group.items.push(resource);
    } else {
      groupedItems.push({
        name: type,
        items: [ resource ]
      });
    }
  }

  return groupedItems;
}
