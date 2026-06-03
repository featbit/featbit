export enum UserOrigin {
  Local = "Local",
  Sso = "Sso",
  OAuth = "OAuth",
}

export enum OAuthProviderName {
  GitHub = "GitHub",
  Google = "Google",
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
  origin: UserOrigin;
}

export interface LoginToken {
  token: string;
  isSsoFirstLogin: boolean;
}

export interface OAuthProvider {
  name: OAuthProviderName | string;
  authorizeUrl: string;
  icon?: string;
}

export interface SsoPreCheck {
  isEnabled: boolean;
  workspaceKey?: string;
}

export interface Workspace {
  id: string;
  name: string;
  key: string;
}

export interface Organization {
  id: string;
  name: string;
  key: string;
  initialized: boolean;
}

export enum SecretType {
  Client = "client",
  Server = "server",
}

export interface EnvSecret {
  id: string;
  name: string;
  type: SecretType;
  value: string;
}

export interface Environment {
  id: string;
  projectId: string;
  name: string;
  key: string;
  description?: string;
  secrets?: EnvSecret[];
}

export interface Project {
  id: string;
  name: string;
  key: string;
  environments: Environment[];
}

export interface ProjectEnv {
  projectId: string;
  projectName: string;
  projectKey: string;
  envId: string;
  envKey: string;
  envName: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  errors?: string[];
  data?: T;
}
