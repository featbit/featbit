export type AuthMode = "login" | "sso";
export type Lang = "en" | "zh";
export type LoginErrorKey = "incorrectEmailOrPassword" | "loginError";

export function resolveLang(value: string | undefined): Lang {
  return value === "zh" ? "zh" : "en";
}
