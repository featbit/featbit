import { IOrganization, IProjectEnv } from "@shared/types";
import { CURRENT_ACCOUNT, CURRENT_PROJECT } from "./localstorage-keys";

export function getCurrentAccount(): IOrganization {
  const json = localStorage.getItem(CURRENT_ACCOUNT());
  if (json) {
    return JSON.parse(json);
  }

  return undefined;
}

export function getCurrentProjectEnv(): IProjectEnv {
  const json = localStorage.getItem(CURRENT_PROJECT());
  if (json) {
    return JSON.parse(json);
  }

  return undefined;
}
