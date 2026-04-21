import { IOrganization, IProjectEnv, IWorkspace, License, WorkspacePlan } from "@shared/types";
import { CURRENT_ORGANIZATION, CURRENT_PROJECT, CURRENT_WORKSPACE } from "./localstorage-keys";
import { ResourceTypeEnum } from "@shared/policy";

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

export function getCurrentEnvRN() {
  const projEnv = getCurrentProjectEnv();
  if (projEnv) {
    return `${ResourceTypeEnum.Project}/${projEnv.projectKey}:${ResourceTypeEnum.Env}/${projEnv.envKey}`;
  }

  return undefined;
}

export function getCurrentLicense(): License {
  const workspace = getCurrentWorkspace();
  return workspace ? new License(workspace.license) : undefined;
}

export function getCurrentPlan(): WorkspacePlan {
  return {
    key: 'growth',
    order: 2,
    totalMau: 40_000 + 30_000,
    addons: ['fineGrainedAccessControl']
  }
}
