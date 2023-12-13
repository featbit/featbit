import { SimpleUser } from "@shared/users";

export interface Webhook {
  id: string;
  name: string;
  scopes: string[];
  scopeNames: string[];
  url: string;
  secret: string;
  events: string[];
  headers: { key: string; value: string; }[];
  payloadTemplateType: string;
  payloadTemplate: string;
  isActive: boolean;
  creator: SimpleUser;
  lastDelivery?: LastDelivery;
}

export interface LastDelivery {
  success: boolean;
  happenedAt: Date;
  response: number;
}

export const WebhookEvents = [
  { group: 'Feature Flag', label: "Created", value: "feature_flag.created" },
  { group: 'Feature Flag', label: "Toggled", value: "feature_flag.toggled" },
  { group: 'Feature Flag', label: "Archived", value: "feature_flag.archived" },
  { group: 'Feature Flag', label: "Restored", value: "feature_flag.restored" },
  { group: 'Feature Flag', label: "Variation Changed", value: "feature_flag.variation_changed" },
  { group: 'Feature Flag', label: "Off Variation Changed", value: "feature_flag.off_variation_changed" },
  { group: 'Feature Flag', label: "Default Rule Changed", value: "feature_flag.default_rule_changed" },
  { group: 'Feature Flag', label: "Target Users Changed", value: "feature_flag.target_users_changed" },
  { group: 'Feature Flag', label: "Targeting Rules Changed", value: "feature_flag.targeting_rules_changed" },
  { group: 'Feature Flag', label: "Basic Info Updated", value: "feature_flag.basic_info_updated" },
  { group: 'Feature Flag', label: "Deleted", value: "feature_flag.deleted" },

  { group: 'Segment', label: "Created", value: "segment.created" },
  { group: 'Segment', label: "Archived", value: "segment.archived" },
  { group: 'Segment', label: "Restored", value: "segment.restored" },
  { group: 'Segment', label: "Rules Changed", value: "segment.rules_changed" },
  { group: 'Segment', label: "Target Users Changed", value: "segment.target_users_changed" },
  { group: 'Segment', label: "Basic Info Updated", value: "segment.basic_info_updated" },
  { group: 'Segment', label: "Deleted", value: "segment.deleted" }
]

export interface PagedWebhook {
  totalCount: number;
  items: Webhook[];
}

export class WebhookFilter {
  name?: string;
  projectId?: string;
  envId: string;
  pageIndex: number;
  pageSize: number;

  constructor() {
    this.name = '';
    this.projectId = '';
    this.envId = '';
    this.pageIndex = 1;
    this.pageSize = 10;
  }
}