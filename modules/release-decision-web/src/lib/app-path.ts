const RAW_BASE_PATH =
  import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL || "";

export const APP_BASE_PATH = RAW_BASE_PATH.replace(/\/+$/, "");

export function appPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (
    normalized === "/release-decision-metrics" ||
    normalized.startsWith("/release-decision-metrics/") ||
    normalized === "/release-decision-layers" ||
    normalized.startsWith("/release-decision-layers/")
  ) {
    return normalized;
  }

  return `${APP_BASE_PATH}${normalized}`;
}
