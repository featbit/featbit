import { getLocalStorageKey } from "./index";

export const LOGIN_REDIRECT_URL = 'login-redirect-url';
export const IDENTITY_TOKEN = 'token';
export const USER_PROFILE = 'auth';

export function CURRENT_PROJECT(): string {
  return getLocalStorageKey('current-project');
}

export function CURRENT_ACCOUNT(): string {
  return getLocalStorageKey('current-account');
}

export function CURRENT_USER_FILTER_ATTRIBUTE(envId: number): string {
  return `${getLocalStorageKey('current-user-search-filter-attribute')}_${envId}`;
}
