import {generalResourceRNPattern, permissionActions} from "@shared/permissions";
import {uuidv4} from "@utils/index";

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
    {
      id: uuidv4(),
      name: permissionActions.All,
      displayName: $localize`:@@iam.action.all:All`,
      description: $localize`:@@iam.action.all:All`,
      isOpenAPIApplicable: false
    },
  ],
  [`${ResourceTypeEnum.General},account`]: [
    {
      id: uuidv4(),
      name: permissionActions.UpdateOrgName,
      displayName: $localize`:@@iam.action.update-org-name:Update org name`,
      description: $localize`:@@iam.action.update-org-name:Update org name`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.ListAccessTokens,
      displayName: $localize`:@@iam.action.list-access-tokens:List access tokens`,
      description: $localize`:@@iam.action.list-access-tokens:List access tokens`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateServiceAccessTokens,
      displayName: $localize`:@@iam.action.create-service-access-tokens:Create service access tokens`,
      description: $localize`:@@iam.action.create-service-access-tokens:Create service access tokens`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.CreatePersonalAccessTokens,
      displayName: $localize`:@@iam.action.create-personal-access-tokens:Create personal access tokens`,
      description: $localize`:@@iam.action.create-personal-access-tokens:Create personal access tokens`,
      isOpenAPIApplicable: true
    },
  ],
  [`${ResourceTypeEnum.General},iam`]: [
    {
      id: uuidv4(),
      name: permissionActions.CanManageIAM,
      displayName: $localize`:@@iam.action.iam:IAM`,
      description: $localize`:@@iam.action.iam:IAM`,
      isOpenAPIApplicable: true
    },
  ],
  [`${ResourceTypeEnum.General},project`]: [ // for all projects
    {
      id: uuidv4(),
      name: permissionActions.ListProjects,
      displayName: $localize`:@@iam.action.list-projects:List projects`,
      description: $localize`:@@iam.action.list-projects:List projects`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateProject,
      displayName: $localize`:@@iam.action.create-projects:Create projects`,
      description: $localize`:@@iam.action.create-projects:Create projects`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteProject,
      displayName: $localize`:@@iam.action.delete-projects:Delete projects`,
      description: $localize`:@@iam.action.delete-projects:Delete projects`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateProjectSettings,
      displayName: $localize`:@@iam.action.update-project-settings:Update project settings`,
      description: $localize`:@@iam.action.update-project-settings:Update project settings`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.ListEnvs,
      displayName: $localize`:@@iam.action.list-envs:List environments`,
      description: $localize`:@@iam.action.list-envs:List environments`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnv,
      displayName: $localize`:@@iam.action.create-env:Create environment`,
      description: $localize`:@@iam.action.create-env:Create environment`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: $localize`:@@iam.action.access-envs:Access environments`,
      description: $localize`:@@iam.action.access-envs:Access environments`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnv,
      displayName: $localize`:@@iam.action.delete-envs:Delete environments`,
      description: $localize`:@@iam.action.delete-envs:Delete environments`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvSettings,
      displayName: $localize`:@@iam.action.update-env-settings:Update environment settings`,
      description: $localize`:@@iam.action.update-env-settings:Update environment settings`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnvSecret,
      displayName: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
      description: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnvSecret,
      displayName: $localize`:@@iam.action.create-env-secret:Create environment secret`,
      description: $localize`:@@iam.action.create-env-secret:Create environment secret`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvSecret,
      displayName: $localize`:@@iam.action.update-env-secret:Update environment secret`,
      description: $localize`:@@iam.action.update-env-secret:Update environment secret`,
      isOpenAPIApplicable: true
    },
  ],
  [ResourceTypeEnum.Project]: [ // for a specific project
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: $localize`:@@iam.action.access-envs:Access environments`,
      description: $localize`:@@iam.action.access-envs:Access environments`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteProject,
      displayName: $localize`:@@iam.action.delete-projects:Delete projects`,
      description: $localize`:@@iam.action.delete-projects:Delete projects`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateProjectSettings,
      displayName: $localize`:@@iam.action.update-project-settings:Update project settings`,
      description: $localize`:@@iam.action.update-project-settings:Update project settings`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.ListEnvs,
      displayName: $localize`:@@iam.action.list-envs:List environments`,
      description: $localize`:@@iam.action.list-envs:List environments`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnv,
      displayName: $localize`:@@iam.action.create-env:Create environment`,
      description: $localize`:@@iam.action.create-env:Create environment`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnvSecret,
      displayName: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
      description: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnvSecret,
      displayName: $localize`:@@iam.action.create-env-secret:Create environment secret`,
      description: $localize`:@@iam.action.create-env-secret:Create environment secret`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvSecret,
      displayName: $localize`:@@iam.action.update-env-secret:Update environment secret`,
      description: $localize`:@@iam.action.update-env-secret:Update environment secret`,
      isOpenAPIApplicable: true
    },
  ],
  [ResourceTypeEnum.Env]: [ // for a specific environment
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: $localize`:@@iam.action.access-envs:Access environments`,
      description: $localize`:@@iam.action.access-envs:Access environments`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnv,
      displayName: $localize`:@@iam.action.delete-envs:Delete environments`,
      description: $localize`:@@iam.action.delete-envs:Delete environments`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvSettings,
      displayName: $localize`:@@iam.action.update-env-settings:Update environment settings`,
      description: $localize`:@@iam.action.update-env-settings:Update environment settings`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnvSecret,
      displayName: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
      description: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnvSecret,
      displayName: $localize`:@@iam.action.create-env-secret:Create environment secret`,
      description: $localize`:@@iam.action.create-env-secret:Create environment secret`,
      isOpenAPIApplicable: true
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvSecret,
      displayName: $localize`:@@iam.action.update-env-secret:Update environment secret`,
      description: $localize`:@@iam.action.update-env-secret:Update environment secret`,
      isOpenAPIApplicable: true
    },
  ]
}
