import { IOrganizationPermissions, IOrganizationSetting } from "@shared/types";

export enum FlagSortedBy {
  CreatedAt = "created_at",
  Key = "key"
}

export type UpdateOrganizationPayload = {
  name: string;
  settings: IOrganizationSetting,
  defaultPermissions: IOrganizationPermissions
}
