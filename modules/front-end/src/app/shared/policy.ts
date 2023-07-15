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

export interface ValPlaceholder {
  displayName: string,
  name: string
}

export interface IamPolicyAction {
  id: string;
  name: string;
  resourceType?: ResourceTypeEnum,
  displayName: string;
  description: string;
  isOpenAPIApplicable: boolean;
  isSpecificApplicable: boolean; // can it be applied to a specific resource, ex: an environment with name "abc"
}

export enum ResourceTypeEnum {
  All = '*',
  Account = 'account',
  IAM = 'iam',
  AccessToken = 'access-token',
  RelayProxy = 'relay-proxy',
  Project = 'project',
  Env = 'env',
  Flag = 'flag',
  Segment = 'segment'
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
  account: 'account/*',
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

export const ResourceTypeAccount: ResourceType = {
  type: ResourceTypeEnum.Account,
  pattern: generalResourceRNPattern.account,
  displayName: $localize`:@@iam.rsc-type.account:Account`
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

export const ResourceTypeEnv = {
  type: ResourceTypeEnum.Env,
  pattern: 'project/{project}:env/{env}',
  displayName: $localize`:@@iam.rsc-type.env:Environment`
};

export const ResourceTypeFlag = {
  type: ResourceTypeEnum.Flag,
  pattern: 'project/{project}:env/{env}/flag/*',
  displayName: $localize`:@@iam.rsc-type.feature-flag:Feature flag`
};

export const ResourceTypeSegment = {
  type: ResourceTypeEnum.Segment,
  pattern: 'project/{project}:env/{env}/segment/*',
  displayName: $localize`:@@iam.rsc-type.segment:Segment`
};

export const resourcesTypes: ResourceType[] = [
  ResourceTypeAll,
  ResourceTypeAccount,
  ResourceTypeIAM,
  ResourceTypeAccessToken,
  ResourceTypeRelayProxy,
  ResourceTypeProject,
  ResourceTypeEnv,
  ResourceTypeFlag,
  ResourceTypeSegment
];

export interface ResourceParamViewModel {
  val: string;
  resourceType: string;
  placeholder: ValPlaceholder;
  isAnyChecked: boolean;
  isInvalid: boolean
}

export const rscParamsDict: { [key in ResourceTypeEnum]: ResourceParamViewModel[] } = {
  [ResourceTypeEnum.All]: [],
  [ResourceTypeEnum.Account]: [],
  [ResourceTypeEnum.IAM]: [],
  [ResourceTypeEnum.AccessToken]: [],
  [ResourceTypeEnum.RelayProxy]: [],
  [ResourceTypeEnum.Project]: [
    {
      val: '',
      resourceType: ResourceTypeEnum.Project,
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
      resourceType: 'project',
      placeholder: {
        name: '{project}',
        displayName: $localize`:@@iam.policy.project:Project`
      },
      isAnyChecked: false,
      isInvalid: false
    },
    {
      val: '',
      resourceType: 'env',
      placeholder: {
        name: '{env}',
        displayName: $localize`:@@iam.policy.environment:Environment`
      },
      isAnyChecked: false,
      isInvalid: false
    }
  ],
  [ResourceTypeEnum.Flag]: [],
  [ResourceTypeEnum.Segment]: [],
};

export const permissionActions: { [key: string]: IamPolicyAction } = {
  All: {
    id: uuidv4(),
    name: '*',
    resourceType: ResourceTypeEnum.All,
    displayName: $localize`:@@iam.action.all:All`,
    description: $localize`:@@iam.action.all:All`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },
  CanAccessProject: {
    id: uuidv4(),
    name: 'CanAccessProject',
    resourceType: ResourceTypeEnum.Project,
    displayName: $localize`:@@iam.action.can-access-project:Can access project`,
    description: $localize`:@@iam.action.can-access-project:Can access project`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  CreateProject: {
    id: uuidv4(),
    name: 'CreateProject',
    resourceType: ResourceTypeEnum.Project,
    displayName: $localize`:@@iam.action.create-projects:Create projects`,
    description: $localize`:@@iam.action.create-projects:Create projects`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },
  DeleteProject: {
    id: uuidv4(),
    name: 'DeleteProject',
    resourceType: ResourceTypeEnum.Project,
    displayName: $localize`:@@iam.action.delete-projects:Delete projects`,
    description: $localize`:@@iam.action.delete-projects:Delete projects`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  UpdateProjectSettings: {
    id: uuidv4(),
    name: 'UpdateProjectSettings',
    resourceType: ResourceTypeEnum.Project,
    displayName: $localize`:@@iam.action.update-project-settings:Update project settings`,
    description: $localize`:@@iam.action.update-project-settings:Update project settings`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  CreateEnv: {
    id: uuidv4(),
    name: 'CreateEnv',
    resourceType: ResourceTypeEnum.Project,
    displayName: $localize`:@@iam.action.create-env:Create environment`,
    description: $localize`:@@iam.action.create-env:Create environment`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  CanAccessEnv: {
    id: uuidv4(),
    name: 'CanAccessEnv',
    resourceType: ResourceTypeEnum.Env,
    displayName: $localize`:@@iam.action.can-access-env:Can access environment`,
    description: $localize`:@@iam.action.can-access-env:Can access environment`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  DeleteEnv: {
    id: uuidv4(),
    name: 'DeleteEnv',
    resourceType: ResourceTypeEnum.Env,
    displayName: $localize`:@@iam.action.delete-envs:Delete environments`,
    description: $localize`:@@iam.action.delete-envs:Delete environments`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  UpdateEnvSettings: {
    id: uuidv4(),
    name: 'UpdateEnvSettings',
    resourceType: ResourceTypeEnum.Env,
    displayName: $localize`:@@iam.action.update-env-settings:Update environment settings`,
    description: $localize`:@@iam.action.update-env-settings:Update environment settings`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  DeleteEnvSecret: {
    id: uuidv4(),
    name: 'DeleteEnvSecret',
    resourceType: ResourceTypeEnum.Env,
    displayName: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
    description: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  CreateEnvSecret: {
    id: uuidv4(),
    name: 'CreateEnvSecret',
    resourceType: ResourceTypeEnum.Env,
    displayName: $localize`:@@iam.action.create-env-secret:Create environment secret`,
    description: $localize`:@@iam.action.create-env-secret:Create environment secret`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },
  UpdateEnvSecret: {
    id: uuidv4(),
    name: 'UpdateEnvSecret',
    resourceType: ResourceTypeEnum.Env,
    displayName: $localize`:@@iam.action.update-env-secret:Update environment secret`,
    description: $localize`:@@iam.action.update-env-secret:Update environment secret`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: true
  },

  // feature flag
  ManageFeatureFlag: {
    id: uuidv4(),
    name: 'ManageFeatureFlag',
    resourceType: ResourceTypeEnum.Flag,
    displayName: $localize`:@@iam.action.manage-feature-flag:Manage feature flag`,
    description: $localize`:@@iam.action.manage-feature-flag:Manage feature flag`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },

  // segment
  ManageSegment: {
    id: uuidv4(),
    name: 'ManageSegment',
    resourceType: ResourceTypeEnum.Segment,
    displayName: $localize`:@@iam.action.manage-segment:Manage segment`,
    description: $localize`:@@iam.action.manage-segment:Manage segment`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },

  // account
  UpdateOrgName: {
    id: uuidv4(),
    name: 'UpdateOrgName',
    resourceType: ResourceTypeEnum.Account,
    displayName: $localize`:@@iam.action.update-org-name:Update org name`,
    description: $localize`:@@iam.action.update-org-name:Update org name`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },

  // iam
  CanManageIAM: {
    id: uuidv4(),
    name: 'CanManageIAM',
    resourceType: ResourceTypeEnum.IAM,
    displayName: $localize`:@@iam.action.iam:IAM`,
    description: $localize`:@@iam.action.iam:IAM`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },

  // access tokens
  ListAccessTokens: {
    id: uuidv4(),
    name: 'ListAccessTokens',
    resourceType: ResourceTypeEnum.AccessToken,
    displayName: $localize`:@@iam.action.list-access-tokens:List access tokens`,
    description: $localize`:@@iam.action.list-access-tokens:List access tokens`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },
  ManageServiceAccessTokens: {
    id: uuidv4(),
    name: 'ManageServiceAccessTokens',
    resourceType: ResourceTypeEnum.AccessToken,
    displayName: $localize`:@@iam.action.manage-service-access-tokens:Manage service access tokens`,
    description: $localize`:@@iam.action.manage-service-access-tokens:Manage service access tokens`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },
  ManagePersonalAccessTokens: {
    id: uuidv4(),
    name: 'ManagePersonalAccessTokens',
    resourceType: ResourceTypeEnum.AccessToken,
    displayName: $localize`:@@iam.action.manage-personal-access-tokens:Manage personal access tokens`,
    description: $localize`:@@iam.action.manage-personal-access-tokens:Manage personal access tokens`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },

  // relay proxy
  ListRelayProxies: {
    id: uuidv4(),
    name: 'ListRelayProxies',
    resourceType: ResourceTypeEnum.RelayProxy,
    displayName: $localize`:@@iam.action.list-relay-proxies:List relay proxies`,
    description: $localize`:@@iam.action.list-relay-proxies:List relay proxies`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },
  ManageRelayProxies: {
    id: uuidv4(),
    name: 'ManageRelayProxies',
    resourceType: ResourceTypeEnum.RelayProxy,
    displayName: $localize`:@@iam.action.manage-relay-proxies:Manage relay proxies`,
    description: $localize`:@@iam.action.manage-relay-proxies:Manage relay proxies`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },
}

// check if the resource is a general resource
// if returns false, that means the actions which cannot be applied to a specific resource should be hidden
// ex: CreateProject should not be available for a specific project: project/abc
export function isResourceGeneral(type: ResourceTypeEnum, rn: string): boolean {
  const generalResourceTypes = [ResourceTypeEnum.All, ResourceTypeEnum.Account, ResourceTypeEnum.IAM, ResourceTypeEnum.AccessToken, ResourceTypeEnum.RelayProxy];
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
