export interface IAuthProps {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
}

export interface ISubscriptionPlan {
  id: string,
  type: string
}

export interface IAccount {
  id: number,
  initialized: boolean,
  organizationName: string,
  plan?: ISubscriptionPlan
}

export interface IAccountProjectEnv {
  account: IAccount,
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
  secret: string,
  mobileSecret: string
}
