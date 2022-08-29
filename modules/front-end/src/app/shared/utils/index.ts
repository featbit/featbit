import { USER_PROFILE } from "./localstorage-keys";
import {IAuthProps} from "../types";

export function getAuth() : IAuthProps | null {
    const auth = localStorage.getItem(USER_PROFILE);
    if (!auth) return null;
    return JSON.parse(auth);
}

export function getLocalStorageKey(key: string): string {
  const auth = getAuth();
  return auth ? `${key}_${auth.id}` : key;
}
