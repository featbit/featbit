export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  headers: Record<string, string>;
  payloadTemplate: string;
  isActive: boolean;
  creator: string;

  // last triggered state
  lastTriggeredAt: Date;
  status: string;
}

export const WebhookEvents = [
  { group: 'Feature Flag', label: "Update", value: "feature_flag.update" },
  { group: 'Feature Flag', label: "Create", value: "feature_flag.create" },
  { group: 'Feature Flag', label: "Delete", value: "feature_flag.delete" },

  { group: 'Segment', label: "Update", value: "segment.update" },
  { group: 'Segment', label: "Create", value: "segment.create" },
  { group: 'Segment', label: "Delete", value: "segment.delete" },
]
