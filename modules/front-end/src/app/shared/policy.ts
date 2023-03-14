import {generalResourceRNPattern, permissionActions} from "@shared/permissions";

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
  Project = 'project',
  Env = 'env',
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

export const resourcesTypes: ResourceType[] = [
  {
    type: ResourceTypeEnum.All,
    pattern: generalResourceRNPattern.all,
    displayName: $localize`:@@iam.rsc-type.all:All`
  },
  {
    type: ResourceTypeEnum.Account,
    pattern: generalResourceRNPattern.account,
    displayName: $localize`:@@iam.rsc-type.account:Account`
  },
  {
    type: ResourceTypeEnum.IAM,
    pattern: generalResourceRNPattern.iam,
    displayName: $localize`:@@iam.rsc-type.iam:IAM`
  },
  {
    type: ResourceTypeEnum.AccessToken,
    pattern: generalResourceRNPattern.accessToken,
    displayName: $localize`:@@iam.rsc-type.access-token:Access token`
  },
  {
    type: ResourceTypeEnum.Project,
    pattern: 'project/{project}',
    displayName: $localize`:@@iam.rsc-type.project:Project`
  },
  {
    type: ResourceTypeEnum.Env,
    pattern: 'project/{project}:env/{env}',
    displayName: $localize`:@@iam.rsc-type.env:Environment`
  }
];

export interface ResourceParamViewModel {
  val: string;
  resourceType: string;
  placeholder: ValPlaceholder;
  isAnyChecked: boolean;
  isInvalid: boolean
}

export const rscParamsDict: {[key in ResourceTypeEnum]: ResourceParamViewModel[]} = {
  [ResourceTypeEnum.All]: [],
  [ResourceTypeEnum.Account]: [],
  [ResourceTypeEnum.IAM]: [],
  [ResourceTypeEnum.AccessToken]: [],
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
};

export const resourceActionsDict: {[key: string]: IamPolicyAction[]} = {
  [ResourceTypeEnum.All]: [
    permissionActions.All,
  ],
  [ResourceTypeEnum.Account]: [
    permissionActions.UpdateOrgName
  ],
  [ResourceTypeEnum.IAM]: [
    permissionActions.CanManageIAM,
  ],
  [ResourceTypeEnum.AccessToken]: [
    permissionActions.ListAccessTokens,
    permissionActions.CreateServiceAccessTokens,
    permissionActions.CreatePersonalAccessTokens,
  ],
  [ResourceTypeEnum.Project]: [
    permissionActions.ListProjects,
    permissionActions.CreateProject,
    permissionActions.DeleteProject,
    permissionActions.UpdateProjectSettings,
    permissionActions.ListEnvs,
    permissionActions.CreateEnv,
  ],
  [ResourceTypeEnum.Env]: [
    permissionActions.AccessEnvs,
    permissionActions.DeleteEnv,
    permissionActions.UpdateEnvSettings,
    permissionActions.DeleteEnvSecret,
    permissionActions.CreateEnvSecret,
    permissionActions.UpdateEnvSecret,
  ]
}

// check if the resource is a general resource
// if returns false, that means the actions which cannot be applied to a specific resource should be hidden
// ex: ListProjects should not be avaible for a specific project: project/abc
export function isResourceGeneral(type: ResourceTypeEnum, rn: string): boolean {
  const generalResourceTypes = [ResourceTypeEnum.All, ResourceTypeEnum.Account, ResourceTypeEnum.IAM, ResourceTypeEnum.AccessToken];
  if (generalResourceTypes.includes(type)) {
    return true;
  }

  switch (type) {
    case ResourceTypeEnum.Project:
      return rn === generalResourceRNPattern.project;
    case ResourceTypeEnum.Env:
      return rn === generalResourceRNPattern.env;
  }

  return false;
}
