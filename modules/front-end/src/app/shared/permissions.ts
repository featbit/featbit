
export const generalResourceRNPattern = {
  all: '*',
  account: 'account',
  iam: 'iam',
  project: 'project',
}

export const permissionActions = {
  All: '*',

  ListProjects: 'ListProjects',
  CreateProject: 'CreateProject',
  DeleteProject: 'DeleteProject',
  AccessEnvs: 'AccessEnvs',
  UpdateProjectInfo: 'UpdateProjectInfo',
  ListEnvs: 'ListEnvs',
  CreateEnv: 'CreateEnv',
  DeleteEnv: 'DeleteEnv',
  UpdateEnvInfo: 'UpdateEnvInfo',

  // account
  UpdateOrgName: 'UpdateOrgName',

  // iam
  CanManageIAM: 'CanManageIAM'
}
