import { EnvironmentSetting } from "@shared/types";

export type CreateEnvPayload = {
  name: string;
  key: string;
  description?: string;
  settings: EnvironmentSetting
}

export type UpdateEnvPayload = {
  name: string;
  description?: string;
  settings: EnvironmentSetting
}
