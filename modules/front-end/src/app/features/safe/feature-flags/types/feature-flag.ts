import { IVariation } from "@shared/rules";
import { SimpleUser } from "@shared/users";
import { getCurrentEnvRN } from "@utils/project-env";
import { NzModalService } from "ng-zorro-antd/modal";
import { NzMessageService } from "ng-zorro-antd/message";

export interface IFeatureFlagListModel {
  items: IFeatureFlagListItem[];
  totalCount: number;
}

export interface IFeatureFlagListItem {
  id: string;
  name: string;
  key: string;
  description: string;
  tags: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  variationType: string;
  serves: IVariationOverview,
  creator: SimpleUser,
  lastChange?: LastChange,

  // UI only
  isNew?: boolean
  isToggling?: boolean;
}

export type LastChange = {
  operator: SimpleUser;
  happenedAt: Date;
  comment: string;
}

export interface IVariationOverview {
  disabledVariation: string,
  enabledVariations: string[],
}

export type FeatureFlagListCheckItem = {
  id: string;
  name: string;
  checked: boolean;
}

export type CopyToEnvPrecheckResult = {
  id: string;
  keyCheck: boolean;
  targetUserCheck: boolean;
  targetRuleCheck: boolean;
  newProperties: string[];
  passed: boolean;
}

export interface ICopyToEnvResult {
  copiedCount: number;
}

export type CloneFlagPayload = {
  name: string;
  key: string;
  description: string;
  tags: string[];
}

export class IFeatureFlagListFilter {
  name?: string;
  isEnabled?: boolean;
  tags?: string[];
  isArchived?: boolean;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    isEnabled?: boolean,
    tags?: string[],
    archivedOnly?: boolean,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.name = name ?? '';
    this.isEnabled = isEnabled;
    this.tags = tags ?? [];
    this.isArchived = !!archivedOnly;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IFeatureFlagCreationPayload {
  name: string;
  key: string;
  description: string;
  tags?: string[];
  isEnabled: boolean;
  variationType: string;
  enabledVariationId: string;
  disabledVariationId: string;
  variations: IVariation[];
}

export const getFlagRN = (key: string, tags: string[]) => {
  const prefix = getCurrentEnvRN();

  if (!prefix) {
    return undefined;
  }

  let rn = `${prefix}:flag/${key}`;
  if (tags.length > 0) {
    rn = `${rn};${tags.join(",")}`;
  }

  return rn;
}

export function handleUpdateError(err: any, message: NzMessageService, modal: NzModalService) {
  if (err.errors && err.errors.length === 1 && err.errors[0] === 'Conflict') {
    modal.warning({
      nzTitle: $localize`:@@ff.conflict-detected:Conflict Detected`,
      nzContent: $localize`:@@ff.conflict-reload-message:This feature flag has been modified by another user, so your changes could not be applied. Reload the page to get the latest version and re-apply your changes.`,
      nzOkText: $localize`:@@common.reload:Reload`,
      nzClassName: 'warning-modal-dialog',
      nzWidth: '500px',
      nzClosable: false,
      nzCentered: true,
      nzOnOk: () => {
        window.location.reload();
      }
    });
  } else {
    message.error($localize `:@@common.operation-failed:Operation failed`);
  }
}
