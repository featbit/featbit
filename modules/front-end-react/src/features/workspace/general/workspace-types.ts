import type { WorkspaceOidcSettings } from "../workspace-api";

export type LicensePayload = {
  features?: string[];
};

export type IdentityFormValues = {
  name: string;
  key: string;
};

export type SsoFormValues = WorkspaceOidcSettings;
