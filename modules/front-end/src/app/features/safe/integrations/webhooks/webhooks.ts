export interface Webhook {
  id: string;
  name: string;
  status: string;
  url: string;
  lastTriggeredAt: Date;
  createdAt: string;
  creator: string;
}
