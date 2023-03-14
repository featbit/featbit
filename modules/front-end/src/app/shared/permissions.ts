import { uuidv4 } from "@utils/index";
import { IamPolicyAction } from "@shared/policy";

export const generalResourceRNPattern = {
  all: '*',
  account: 'account/*',
  iam: 'iam/*',
  accessToken: 'access-token/*',
  project: 'project/*',
  env: 'project/*:env/*'
}

export const permissionActions: {[key: string]: IamPolicyAction} = {
  All: {
    id: uuidv4(),
    name: '*',
    displayName: $localize`:@@iam.action.all:All`,
    description: $localize`:@@iam.action.all:All`,
    isOpenAPIApplicable: false,
    isSpecificApplicable: false
  },
  ListProjects: {
    id: uuidv4(),
    name: 'ListProjects',
    displayName: $localize`:@@iam.action.list-projects:List projects`,
    description: $localize`:@@iam.action.list-projects:List projects`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },
  CreateProject: {
    id: uuidv4(),
    name: 'CreateProject',
    displayName: $localize`:@@iam.action.create-projects:Create projects`,
    description: $localize`:@@iam.action.create-projects:Create projects`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },
  DeleteProject: {
    id: uuidv4(),
    name: 'DeleteProject',
    displayName: $localize`:@@iam.action.delete-projects:Delete projects`,
    description: $localize`:@@iam.action.delete-projects:Delete projects`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  AccessEnvs: {
    id: uuidv4(),
    name: 'AccessEnvs',
    displayName: $localize`:@@iam.action.access-envs:Access environments`,
    description: $localize`:@@iam.action.access-envs:Access environments`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  UpdateProjectSettings: {
    id: uuidv4(),
    name: 'UpdateProjectSettings',
    displayName: $localize`:@@iam.action.update-project-settings:Update project settings`,
    description: $localize`:@@iam.action.update-project-settings:Update project settings`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  ListEnvs: {
    id: uuidv4(),
    name: 'ListEnvs',
    displayName: $localize`:@@iam.action.list-envs:List environments`,
    description: $localize`:@@iam.action.list-envs:List environments`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  CreateEnv:  {
    id: uuidv4(),
    name: 'CreateEnv',
    displayName: $localize`:@@iam.action.create-env:Create environment`,
    description: $localize`:@@iam.action.create-env:Create environment`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  DeleteEnv: {
    id: uuidv4(),
    name: 'DeleteEnv',
    displayName: $localize`:@@iam.action.delete-envs:Delete environments`,
    description: $localize`:@@iam.action.delete-envs:Delete environments`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  UpdateEnvSettings: {
    id: uuidv4(),
    name: 'UpdateEnvSettings',
    displayName: $localize`:@@iam.action.update-env-settings:Update environment settings`,
    description: $localize`:@@iam.action.update-env-settings:Update environment settings`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  DeleteEnvSecret: {
    id: uuidv4(),
    name: 'DeleteEnvSecret',
    displayName: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
    description: $localize`:@@iam.action.delete-env-secret:Delete environment secret`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  CreateEnvSecret: {
    id: uuidv4(),
    name: 'CreateEnvSecret',
    displayName: $localize`:@@iam.action.create-env-secret:Create environment secret`,
    description: $localize`:@@iam.action.create-env-secret:Create environment secret`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },
  UpdateEnvSecret: {
    id: uuidv4(),
    name: 'UpdateEnvSecret',
    displayName: $localize`:@@iam.action.update-env-secret:Update environment secret`,
    description: $localize`:@@iam.action.update-env-secret:Update environment secret`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: true
  },

  // account
  UpdateOrgName: {
    id: uuidv4(),
    name: 'UpdateOrgName',
    displayName: $localize`:@@iam.action.update-org-name:Update org name`,
    description: $localize`:@@iam.action.update-org-name:Update org name`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },

  // iam
  CanManageIAM: {
    id: uuidv4(),
    name: 'CanManageIAM',
    displayName: $localize`:@@iam.action.iam:IAM`,
    description: $localize`:@@iam.action.iam:IAM`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },

  // access tokens
  ListAccessTokens: {
    id: uuidv4(),
    name: 'ListAccessTokens',
    displayName: $localize`:@@iam.action.list-access-tokens:List access tokens`,
    description: $localize`:@@iam.action.list-access-tokens:List access tokens`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },
  CreateServiceAccessTokens: {
    id: uuidv4(),
    name: 'ManageServiceAccessTokens',
    displayName: $localize`:@@iam.action.manage-service-access-tokens:Manage service access tokens`,
    description: $localize`:@@iam.action.manage-service-access-tokens:Manage service access tokens`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },
  CreatePersonalAccessTokens: {
    id: uuidv4(),
    name: 'ManagePersonalAccessTokens',
    displayName: $localize`:@@iam.action.manage-personal-access-tokens:Manage personal access tokens`,
    description: $localize`:@@iam.action.manage-personal-access-tokens:Manage personal access tokens`,
    isOpenAPIApplicable: true,
    isSpecificApplicable: false
  },
}
