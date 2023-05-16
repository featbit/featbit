import { getLocalStorageKey } from "./index";

export const LOGIN_REDIRECT_URL = 'login-redirect-url';
export const IDENTITY_TOKEN = 'token';
export const USER_PROFILE = 'auth';

export function CURRENT_PROJECT(): string {
  return getLocalStorageKey('current-project', false);
}

export function CURRENT_ORGANIZATION(): string {
  return getLocalStorageKey('current-organization', false);
}

export function CURRENT_USER_FILTER_ATTRIBUTE(envId: string): string {
  return `${getLocalStorageKey('current-user-search-filter-attribute', false)}_${envId}`;
}

export function CURRENT_LANGUAGE(): string {
  return getLocalStorageKey('current-lang', true);
}

export function GET_STARTED(): string {
  return getLocalStorageKey('get-started', false);
}
