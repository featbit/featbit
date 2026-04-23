import { IOrganization, IProjectEnv, IWorkspace, License, WorkspacePlan } from "@shared/types";
import { CURRENT_ORGANIZATION, CURRENT_PROJECT, CURRENT_WORKSPACE } from "./localstorage-keys";
import { ResourceTypeEnum } from "@shared/policy";
import { BillingCycle } from "@core/components/pricing-plans/types";

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
    name: 'Growth',
    order: 2,
    includedMau: 40_000,
    extraMau: 30_000,
    totalMau: 70_000,
    fineGrainedAcEnabled: true,
    price: 149 + 20 * 3, // base price + extra MAU cost
    billingCycle: BillingCycle.MONTHLY,
    currentPeriodStart: new Date('2026-04-22'),
    currentPeriodEnd: new Date('2026-05-22'),
    subscriberSince: new Date('2026-01-01'),
  }
}
