export interface IResponse {
  success: boolean,
  errors: string[],
  data: any
}

export interface IRuleIdDispatchKey {
  ruleId: string,
  dispatchKey: string
}

export interface IUserType {
  id: string;
  name: string;
  keyId: string;
  customizedProperties?: [{name: string, value: string}];

  isNew?: boolean; // only for front end
}

export interface IUserProp {
  id: string;
  name: string;
  presetValues: IUserPropertyPresetValue[];
  usePresetValuesOnly: boolean;
  isBuiltIn: boolean;
  isDigestField: boolean;
  remark: string;

  // front end use
  isNew?: boolean;
  isSaving?: boolean;
  isEditing?: boolean;
  isDeleting?: boolean;
}

export interface IUserPropertyPresetValue {
  id: string;
  value: string;
  description: string;
}

export interface IAuthProps {
  id: string;
  email: string;
  name: string;
}

export interface IOrganization {
  id: string,
  initialized: boolean,
  name: string
}

export interface IOnboarding {
  organizationName: string,
  projectName: string,
  projectKey: string,
  environments: string[]
}

export interface IProjectEnv {
  projectId: string,
  projectName: string,
  projectKey: string,
  envId: string,
  envKey: string,
  envName: string,
  envSecret: string
}

export interface IProject {
  id: string,
  name: string,
  key: string,
  environments: IEnvironment[]
}

export interface IEnvironment {
  id: string,
  projectId: string,
  name: string,
  key: string,
  description: string,
  secrets: ISecret[]
}

export interface ISecret {
  id: string,
  name: string,
  type: SecretTypeEnum,
  value: string
}

export enum SecretTypeEnum {
  Client = 'client',
  Server = 'server'
}

export interface EnvironmentSetting {
  id: string;
  type: string;
  key: string;
  value: string;
  tag?: string;
  remark?: string;
}

export const EnvironmentSettingTypes = {
  SyncUrls: 'sync-urls',
}
