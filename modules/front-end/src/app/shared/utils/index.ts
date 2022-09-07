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

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function randomString(length: number): string {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let password = "";
  for (let i = 0; i <= length; i++) {
    const randomNumber = Math.floor(Math.random() * chars.length);
    password += chars.substring(randomNumber, randomNumber +1);
  }
  return password;
}

export function encodeURIComponentFfc(url: string): string {
  return encodeURIComponent(url).replace(/\(/g, "%28").replace(/\)/g, '%29');
}
