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
}

export enum ResourceTypeEnum {
  All = '*',
  General = 'general',
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
    type: ResourceTypeEnum.General,
    pattern: generalResourceRNPattern.project,
    displayName: $localize`:@@iam.rsc-type.general:General`
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
  [ResourceTypeEnum.General]: [],
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
  [`${ResourceTypeEnum.General},account`]: [
    permissionActions.UpdateOrgName,
    permissionActions.ListAccessTokens,
    permissionActions.CreateServiceAccessTokens,
    permissionActions.CreatePersonalAccessTokens,
  ],
  [`${ResourceTypeEnum.General},iam`]: [
    permissionActions.CanManageIAM,
  ],
  [`${ResourceTypeEnum.General},project`]: [ // for all projects
    permissionActions.ListProjects,
    permissionActions.CreateProject,
    permissionActions.DeleteProject,
    permissionActions.UpdateProjectSettings,
    permissionActions.ListEnvs,
    permissionActions.CreateEnv,
    permissionActions.AccessEnvs,
    permissionActions.DeleteEnv,
    permissionActions.UpdateEnvSettings,
    permissionActions.DeleteEnvSecret,
    permissionActions.CreateEnvSecret,
    permissionActions.UpdateEnvSecret,
  ],
  [ResourceTypeEnum.Project]: [ // for a specific project
    permissionActions.AccessEnvs,
    permissionActions.DeleteProject,
    permissionActions.UpdateProjectSettings,
    permissionActions.ListEnvs,
    permissionActions.CreateEnv,
    permissionActions.DeleteEnvSecret,
    permissionActions.CreateEnvSecret,
    permissionActions.UpdateEnvSecret,
  ],
  [ResourceTypeEnum.Env]: [ // for a specific environment
    permissionActions.AccessEnvs,
    permissionActions.DeleteEnv,
    permissionActions.UpdateEnvSettings,
    permissionActions.DeleteEnvSecret,
    permissionActions.CreateEnvSecret,
    permissionActions.UpdateEnvSecret,
  ]
}
