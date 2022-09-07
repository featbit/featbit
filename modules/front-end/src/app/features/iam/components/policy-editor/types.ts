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
    displayName: '全部'
  },
  {
    type: ResourceTypeEnum.General,
    pattern: generalResourceRNPattern.project,
    displayName: '通用'
  },
  {
    type: ResourceTypeEnum.Project,
    pattern: 'project/{project}',
    displayName: '项目'
  },
  {
    type: ResourceTypeEnum.Env,
    pattern: 'project/{project}:env/{env}',
    displayName: '环境'
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
      displayName: '全部操作'
    },
  ],
  [`${ResourceTypeEnum.General},account`]: [
    {
      id: uuidv4(),
      name: permissionActions.UpdateOrgName,
      displayName: '修改机构名称'
    },
  ],
  [`${ResourceTypeEnum.General},iam`]: [
    {
      id: uuidv4(),
      name: permissionActions.CanManageIAM,
      displayName: '权限管理'
    },
  ],
  [`${ResourceTypeEnum.General},project`]: [
    {
      id: uuidv4(),
      name: permissionActions.ListProjects,
      displayName: '查看项目列表'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateProject,
      displayName: '创建项目'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteProject,
      displayName: '删除项目'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateProjectInfo,
      displayName: '修改项目信息'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnv,
      displayName: '创建环境'
    },
    {
      id: uuidv4(),
      name: permissionActions.ListEnvs,
      displayName: '查看环境列表'
    },
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: '进入环境'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnv,
      displayName: '删除环境'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvInfo,
      displayName: '修改环境信息'
    },
  ],
  [ResourceTypeEnum.Project]: [
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: '进入环境'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteProject,
      displayName: '删除项目'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateProjectInfo,
      displayName: '修改项目'
    },
    {
      id: uuidv4(),
      name: permissionActions.ListEnvs,
      displayName: '查看环境列表'
    },
    {
      id: uuidv4(),
      name: permissionActions.CreateEnv,
      displayName: '创建环境'
    }
  ],
  [ResourceTypeEnum.Env]: [
    {
      id: uuidv4(),
      name: permissionActions.AccessEnvs,
      displayName: '进入环境'
    },
    {
      id: uuidv4(),
      name: permissionActions.DeleteEnv,
      displayName: '删除环境'
    },
    {
      id: uuidv4(),
      name: permissionActions.UpdateEnvInfo,
      displayName: '修改环境信息'
    }
  ]
}
