import { IOrganization, IProjectEnv, IWorkspace } from "@shared/types";
import { CURRENT_ORGANIZATION, CURRENT_PROJECT, CURRENT_WORKSPACE } from "./localstorage-keys";

export function getCurrentWorkspace(): IWorkspace {
  const json = localStorage.getItem(CURRENT_WORKSPACE());
  if (json) {
    return JSON.parse(json);
  }

  return undefined;
}

export function getCurrentOrganization(): IOrganization {
  const json = localStorage.getItem(CURRENT_ORGANIZATION());
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
