
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
  UpdateProjectSettings: 'UpdateProjectSettings',
  ListEnvs: 'ListEnvs',
  CreateEnv: 'CreateEnv',
  DeleteEnv: 'DeleteEnv',
  UpdateEnvSettings: 'UpdateEnvSettings',
  DeleteEnvSecret: 'DeleteEnvSecret',
  CreateEnvSecret: 'CreateEnvSecret',
  UpdateEnvSecret: 'UpdateEnvSecret',

  // account
  UpdateOrgName: 'UpdateOrgName',

  // iam
  CanManageIAM: 'CanManageIAM'
}
