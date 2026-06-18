// Browser-side absolute URL for the FeatBit API.
export const FEATBIT_API_URL = (
  import.meta.env.VITE_FEATBIT_API_URL || "http://localhost:5000"
).replace(/\/+$/, "");

export const FEATBIT_API_V1 = `${FEATBIT_API_URL}/api/v1`;

export const FEATBIT_BROWSER_API_URL = (
  import.meta.env.VITE_FEATBIT_API_URL ||
  "http://localhost:5000"
).replace(/\/+$/, "");

export const FEATBIT_BROWSER_API_V1 = FEATBIT_BROWSER_API_URL.endsWith("/api/v1")
  ? FEATBIT_BROWSER_API_URL
  : `${FEATBIT_BROWSER_API_URL}/api/v1`;

export const FEATBIT_APP_URL = (
  import.meta.env.VITE_FEATBIT_APP_URL || ""
).replace(/\/+$/, "");

export function featbitAppPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${FEATBIT_APP_URL}${normalized}`;
}
