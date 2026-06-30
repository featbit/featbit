import type { DecodedLicense, LicenseFeature, LicenseStatus } from "./license-types";

const LICENSE_EXPIRING_DAYS_THRESHOLD = 30;

function decodeBase64UrlJson<T>(value: string): T | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(paddedBase64)) as T;
  } catch {
    return null;
  }
}

export function parseLicense(license: string | undefined) {
  const payload = license?.split(".")[1];
  return payload ? decodeBase64UrlJson<DecodedLicense>(payload) : null;
}

export function toDate(value: number | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value < 10_000_000_000 ? value * 1000 : value);
}

export function formatDate(value: number | undefined, lang: "en" | "zh") {
  const date = toDate(value);
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

export function daysUntilExpiration(license: DecodedLicense | null) {
  const expiresAt = toDate(license?.exp)?.getTime();
  if (!expiresAt) {
    return -1;
  }

  return Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
}

export function displayPlan(plan: string | undefined) {
  if (!plan) {
    return "-";
  }

  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function getLicenseStatus(license: DecodedLicense | null): LicenseStatus {
  if (!license || !toDate(license.exp)) {
    return "missing";
  }

  const remainingDays = daysUntilExpiration(license);
  if (remainingDays <= 0) {
    return "expired";
  }

  return remainingDays <= LICENSE_EXPIRING_DAYS_THRESHOLD ? "expiring" : "active";
}

export function isFeatureGranted(feature: LicenseFeature, license: DecodedLicense | null, status: LicenseStatus) {
  if (!license || status === "expired" || status === "missing") {
    return false;
  }

  const features = license.features ?? [];
  return features.includes("*") || features.includes(feature.id);
}
