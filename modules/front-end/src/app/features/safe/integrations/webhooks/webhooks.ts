import { Creator } from "@shared/users";

export interface Webhook {
  id: string;
  name: string;
  scopes: string[];
  url: string;
  secret: string;
  events: string[];
  headers: { key: string; value: string; }[];
  payloadTemplate: string;
  isActive: boolean;
  creator: Creator;
  lastTriggeredAt?: Date;
}

export const WebhookEvents = [
  { group: 'Feature Flag', label: "Update", value: "feature_flag.update" },
  { group: 'Feature Flag', label: "Create", value: "feature_flag.create" },
  { group: 'Feature Flag', label: "Delete", value: "feature_flag.delete" },

  { group: 'Segment', label: "Update", value: "segment.update" },
  { group: 'Segment', label: "Create", value: "segment.create" },
  { group: 'Segment', label: "Delete", value: "segment.delete" },
]

export interface PagedWebhook {
  totalCount: number;
  items: Webhook[];
}

export class WebhookFilter {
  name?: string;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.name = name ?? '';
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}