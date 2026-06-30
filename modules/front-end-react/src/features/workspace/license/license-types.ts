import type { LicensePayload } from "../general/workspace-types";

export type LicenseStatus = "active" | "expired" | "expiring" | "missing";

export type LicenseFeature = {
  id: string;
  labelKey: string;
  descriptionKey: string;
};

export type DecodedLicense = LicensePayload & {
  plan?: string;
  sub?: string;
  wsId?: string;
  iat?: number;
  exp?: number;
  issuer?: string;
};
