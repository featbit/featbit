const RAW_BASE_PATH =
  import.meta.env.VITE_BASE_PATH || import.meta.env.BASE_URL || "";

export const APP_BASE_PATH = RAW_BASE_PATH.replace(/\/+$/, "");

export function appPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${APP_BASE_PATH}${normalized}`;
}
