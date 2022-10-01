export interface IResponse {
  success: boolean,
  errors: string[],
  data: any
}

export interface IUserType {
  id: string;
  name: string;
  email: string;
  country: string;
  keyId: string;
  customizedProperties: [{name: string, value: string}];

  isNew?: boolean; // only for front end
}

export interface IEnvUserProperty {
  environmentId: number;
  userProperties: IUserProp[];
  userTags: IUserTag[];
}

export interface IUserProp {
  id: string;
  name: string;
  presetValues: IUserPropertyPresetValue[];
  usePresetValuesOnly: boolean;
  isBuiltIn: boolean;
  isArchived: boolean;
  isDigestField: boolean;
  remark: string;

  // front end use
  isNew?: boolean;
  isSaving?: boolean;
  isEditing?: boolean;
  isDeleting?: boolean;
}

export interface IUserTag {
  id: string;
  source: string;
  requestProperty: string;
  userProperty: string;
  isArchived: boolean;

  // front end use
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
  id: number,
  initialized: boolean,
  name: string
}

export interface IOrganizationProjectEnv {
  organization: IOrganization,
  projectEnv: IProjectEnv
}

export interface IProjectEnv {
  projectId: number,
  projectName: string,
  envId: number,
  envName: string,
  envSecret: string
}

export interface IProject {
  id: number,
  name: string,
  environments: IEnvironment[]
}

export interface IEnvironment {
  id: number,
  projectId: number,
  name: string,
  description: string,
  secret: string
}

export interface IAccountUser {
  userId: string,
  userName: string,
  email: string,
  role: string,
  initialPassword: string
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

export enum EnvKeyNameEnum {
  Secret = "Secret"
}

export interface IEnvKey {
  keyName: EnvKeyNameEnum,
  keyValue?: string
}
