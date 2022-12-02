import { USER_PROFILE } from "./localstorage-keys";
import {IAuthProps} from "../types";
import {USER_IS_IN_SEGMENT, USER_IS_NOT_IN_SEGMENT} from "@shared/constants";
import {ICondition} from "@shared/rules";

export function getPathPrefix() {
  return location.pathname.match(/^(?<locale>\/en\/|\/zh\/)/i)?.groups['locale'] || '/';
}

export function getAuth() : IAuthProps | null {
  const auth = localStorage.getItem(USER_PROFILE);
  if (!auth) return null;
  return JSON.parse(auth);
}

export function getLocalStorageKey(key: string, isUserIndependant: boolean): string {
  const auth = getAuth();
  return !isUserIndependant && auth ? `${key}_${auth.id}` : key;
}

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function isNumeric(str: string) {
  if (typeof str != "string") return false // we only process strings!
  // @ts-ignore
  return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
    !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
}

/**
 * If you don't care about primitives and only objects then this function
 * is for you, otherwise look elsewhere.
 * This function will return `false` for any valid json primitive.
 * EG, 'true' -> false
 *     '123' -> false
 *     'null' -> false
 *     '"I'm a string"' -> false
 */
export function tryParseJSONObject (jsonString: string): boolean {
  try {
    const value = JSON.parse(jsonString);
    if (value === true || value === false || value === null || isNumeric(jsonString)) {
      return false;
    }

    if (value && typeof value === "object") {
      return true;
    }
  }
  catch (e) { }

  return false;
}

export function getPercentageFromRolloutPercentageArray(arr: number[]): number {
  const diff = arr[1] - arr[0];
  return getPercentageFromDecimal(diff);
}

export function getPercentageFromDecimal(param: number): number {
  return Number((param * 100).toFixed(12));
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

export function isSegmentRule(rule: ICondition | any): boolean {
  const segmentRuleProperties = [USER_IS_IN_SEGMENT, USER_IS_NOT_IN_SEGMENT];

  return segmentRuleProperties.includes(rule.property);
}

// determine if a rule operation is single operater
export function isSingleOperator(operationType: string): boolean {
  return !['string', 'number', 'regex', 'multi'].includes(operationType);
}

// the general trackBy function
// can be used in ngFor when the element can be changed
// this is necessary to improve the performance
export function trackByFunction(index: number, item: any) {
  if(!item) return null;
  return index;
}

export const isNumber = (value: number): boolean => {
  return typeof value === 'number' && isFinite(value);
}

export const deepCopy = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj));
}
