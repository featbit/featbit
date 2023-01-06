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
    displayName: 'All'
  },
  {
    type: ResourceTypeEnum.General,
    pattern: generalResourceRNPattern.project,
    displayName: 'General'
  },
  {
    type: ResourceTypeEnum.Project,
    pattern: 'project/{project}',
    displayName: 'Project'
  },
  {
    type: ResourceTypeEnum.Env,
    pattern: 'project/{project}:env/{env}',
    displayName: 'Environment'
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
        displayName: '项目名称'
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
        displayName: '项目'
      },
      isAnyChecked: false,
      isInvalid: false
    },
    {
      val: '',
      resourceType: 'env',
      placeholder: {
        name: '{env}',
        displayName: '环境'
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
      displayName: 'All'
    },
  ],
  [`${ResourceTypeEnum.General},account`]: [
    {
      id: uuidv4(),
      name: permissionActions.UpdateOrgName,
      displayName: 'Update org name'
    },
  ],
  [`${ResourceTypeEnum.General},iam`]: [
    {
      id: uuidv4(),
      name: permissionActions.CanManageIAM,
      displayName: 'IAM'
    },
  ],
  [`${ResourceTypeEnum.General},project`]: [ // for all projects
    {
      id: uuidv4(),
      name: permissionActions.ListProjects,
      displayName: 'List projects'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateProject,
      displayName: 'Create projects'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteProject,
      displayName: 'Delete projects'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateProjectInfo,
      displayName: 'Update project info'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnv,
      displayName: 'Create environment'
    },
    {
      id: uuidv4(),
      name: permissionActions.ListEnvs,
      displayName: 'List environments'
    },
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: 'Access environments'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnv,
      displayName: 'Delete environment'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvInfo,
      displayName: 'Update environment info'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnvSecret,
      displayName: 'Delete environment secret'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnvSecret,
      displayName: 'Create environment secret'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvSecret,
      displayName: 'Update environment secret'
    },
  ],
  [ResourceTypeEnum.Project]: [ // for a specific project
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: 'Access environments'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteProject,
      displayName: 'Delete projects'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateProjectInfo,
      displayName: 'Update project info'
    },
    {
      id: uuidv4(),
      name: permissionActions.ListEnvs,
      displayName: 'List environments'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnv,
      displayName: 'Create environment'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnvSecret,
      displayName: 'Delete environment secret'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnvSecret,
      displayName: 'Create environment secret'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvSecret,
      displayName: 'Update environment secret'
    },
  ],
  [ResourceTypeEnum.Env]: [ // for a specific environment
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: 'Access environments'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnv,
      displayName: 'Delete environments'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvInfo,
      displayName: 'Update environment info'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnvSecret,
      displayName: 'Delete environment secret'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnvSecret,
      displayName: 'Create environment secret'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvSecret,
      displayName: 'Update environment secret'
    },
  ]
}
